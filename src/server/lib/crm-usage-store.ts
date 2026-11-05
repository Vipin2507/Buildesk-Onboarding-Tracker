import { and, eq, gte, lte } from "drizzle-orm";

import { eachIsoDay, usagePatternLabel, usageRecommendations } from "@/lib/crm-usage";
import { nowIso } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { fetchUsageDay } from "@/server/lib/buildesk-usage";
import type {
  CrmUsageAccountPage,
  CrmUsageBoardRow,
  CrmUsageDay,
  CrmUsagePersonTotal,
  CrmUsageRefreshResult,
  CrmUsageScanRow,
  CrmUsageSyncState,
} from "@/types/crm-usage";

type Db = ReturnType<typeof getDb>;
type DayRow = typeof t.crmUsageDays.$inferSelect;
type Report = Awaited<ReturnType<typeof fetchUsageDay>>;

function emptySummary(accountId: string, connected: boolean, error = ""): CrmUsageScanRow {
  return {
    accountId,
    ok: false,
    connected,
    error,
    leads: 0,
    followups: 0,
    visitsScheduled: 0,
    visitsConducted: 0,
    bookings: null,
    calls: 0,
    connectedCalls: 0,
    activeUsers: 0,
    executiveCount: 0,
    crmScore: 0,
    activityScore: 0,
    hasCrmActivity: false,
    hasCalls: false,
    leadOnly: false,
    usageType: connected ? "API error" : "Not connected",
    bookingWarning: "",
    callWarning: "",
  };
}

export function summarizeStoredDays(accountId: string, rows: DayRow[]): CrmUsageScanRow | null {
  if (!rows.length) return null;
  const okRows = rows.filter((row) => row.ok);
  if (!okRows.length) {
    return emptySummary(accountId, true, rows.find((row) => row.error)?.error || "The saved report failed");
  }
  let bookings = 0;
  let bookingsKnown = false;
  let bookingWarning = "";
  let callWarning = "";
  for (const row of okRows) {
    if (row.bookings == null) bookingWarning ||= "Some days have no booking total";
    else {
      bookings += row.bookings;
      bookingsKnown = true;
    }
    if (row.bookingWarning) bookingWarning = row.bookingWarning;
    if (row.callWarning) callWarning = row.callWarning;
  }
  const leads = okRows.reduce((sum, row) => sum + row.leads, 0);
  const followups = okRows.reduce((sum, row) => sum + row.followups, 0);
  const visitsScheduled = okRows.reduce((sum, row) => sum + row.visitsScheduled, 0);
  const visitsConducted = okRows.reduce((sum, row) => sum + row.visitsConducted, 0);
  const calls = okRows.reduce((sum, row) => sum + row.calls, 0);
  const connectedCalls = okRows.reduce((sum, row) => sum + row.connectedCalls, 0);
  const hasCrmActivity = okRows.some((row) => row.hasCrmActivity);
  const hasCalls = okRows.some((row) => row.hasCalls);
  const leadOnly = leads > 0 && !hasCrmActivity && !hasCalls;
  const usageType = hasCalls && hasCrmActivity
    ? "Calls + CRM"
    : hasCalls
      ? "Calls only"
      : leadOnly
        ? "Lead receiving but no activity"
        : hasCrmActivity
          ? "CRM activity"
          : "No tracked activity";
  return {
    accountId,
    ok: true,
    connected: true,
    error: "",
    leads,
    followups,
    visitsScheduled,
    visitsConducted,
    bookings: bookingsKnown ? bookings : null,
    calls,
    connectedCalls,
    activeUsers: Math.max(...okRows.map((row) => row.activeUsers)),
    executiveCount: Math.max(...okRows.map((row) => row.executiveCount)),
    crmScore: okRows.reduce((sum, row) => sum + row.crmScore, 0),
    activityScore: okRows.reduce((sum, row) => sum + row.activityScore, 0),
    hasCrmActivity,
    hasCalls,
    leadOnly,
    usageType,
    bookingWarning,
    callWarning,
  };
}

function toUsageDay(date: string, row: DayRow | undefined): CrmUsageDay {
  if (!row) {
    return {
      date,
      saved: false,
      ok: false,
      error: "Not saved",
      hasCrmActivity: false,
      leadOnly: false,
      hasCalls: false,
      leads: 0,
      followups: 0,
      visitsScheduled: 0,
      visitsConducted: 0,
      bookings: null,
      calls: 0,
      connectedCalls: 0,
      activeUsers: 0,
      score: 0,
      fetchedAt: "",
    };
  }
  return {
    date,
    saved: true,
    ok: row.ok,
    error: row.error,
    hasCrmActivity: row.hasCrmActivity,
    leadOnly: row.leadOnly,
    hasCalls: row.hasCalls,
    leads: row.leads,
    followups: row.followups,
    visitsScheduled: row.visitsScheduled,
    visitsConducted: row.visitsConducted,
    bookings: row.bookings,
    calls: row.calls,
    connectedCalls: row.connectedCalls,
    activeUsers: row.activeUsers,
    score: row.activityScore,
    fetchedAt: row.fetchedAt,
  };
}

function uniquePeople(report: Report) {
  const seen = new Map<string, number>();
  return report.executives.map((person) => {
    const count = (seen.get(person.name) ?? 0) + 1;
    seen.set(person.name, count);
    return { ...person, name: count === 1 ? person.name : `${person.name} (${count})` };
  });
}

export function replaceUsageDay(db: Db, accountId: string, day: string, report: Report) {
  const fetchedAt = nowIso();
  const people = uniquePeople(report);
  db.transaction((tx) => {
    tx.delete(t.crmUsagePeople)
      .where(and(eq(t.crmUsagePeople.accountId, accountId), eq(t.crmUsagePeople.day, day)))
      .run();
    tx.delete(t.crmUsageDays)
      .where(and(eq(t.crmUsageDays.accountId, accountId), eq(t.crmUsageDays.day, day)))
      .run();
    tx.insert(t.crmUsageDays)
      .values({
        accountId,
        day,
        ok: true,
        error: "",
        leads: report.leads,
        followups: report.followups,
        meetings: report.meetings,
        visitsScheduled: report.visitsScheduled,
        visitsConducted: report.visitsConducted,
        bookings: report.bookings,
        calls: report.calls,
        connectedCalls: report.connectedCalls,
        activeUsers: report.activeUsers,
        executiveCount: report.executiveCount,
        crmScore: report.crmScore,
        activityScore: report.activityScore,
        hasCrmActivity: report.hasCrmActivity,
        hasCalls: report.hasCalls,
        leadOnly: report.leadOnly,
        usageType: report.usageType,
        bookingWarning: report.bookingWarning,
        callWarning: report.callWarning,
        fetchedAt,
      })
      .run();
    for (let index = 0; index < people.length; index += 40) {
      const slice = people.slice(index, index + 40);
      tx.insert(t.crmUsagePeople)
        .values(
          slice.map((person) => ({
            accountId,
            day,
            name: person.name,
            team: person.team,
            leads: person.leads,
            followups: person.followups,
            meetings: person.meetings,
            visitsScheduled: person.visitsScheduled,
            visitsConducted: person.visitsConducted,
            bookings: person.bookings,
            calls: person.calls,
            connectedCalls: person.connectedCalls,
            hasCrmActivity: person.hasCrmActivity,
            hasCalls: person.hasCalls,
            leadOnly: person.leadOnly,
            productive: person.productive,
          })),
        )
        .run();
    }
  });
}

function saveFailure(db: Db, accountId: string, day: string, error: string) {
  const existing = db
    .select()
    .from(t.crmUsageDays)
    .where(and(eq(t.crmUsageDays.accountId, accountId), eq(t.crmUsageDays.day, day)))
    .get();
  if (existing?.ok) return "kept" as const;
  const fetchedAt = nowIso();
  db.transaction((tx) => {
    tx.delete(t.crmUsagePeople)
      .where(and(eq(t.crmUsagePeople.accountId, accountId), eq(t.crmUsagePeople.day, day)))
      .run();
    tx.delete(t.crmUsageDays)
      .where(and(eq(t.crmUsageDays.accountId, accountId), eq(t.crmUsageDays.day, day)))
      .run();
    tx.insert(t.crmUsageDays)
      .values({
        accountId,
        day,
        ok: false,
        error: error.slice(0, 240),
        fetchedAt,
      })
      .run();
  });
  return "failed" as const;
}

export async function refreshUsageRange(
  db: Db,
  accountId: string,
  apiKey: string,
  from: string,
  to: string,
  force: boolean,
): Promise<CrmUsageRefreshResult> {
  const result: CrmUsageRefreshResult = { fetched: 0, skipped: 0, failed: 0, kept: 0 };
  const existing = db
    .select()
    .from(t.crmUsageDays)
    .where(
      and(
        eq(t.crmUsageDays.accountId, accountId),
        gte(t.crmUsageDays.day, from),
        lte(t.crmUsageDays.day, to),
      ),
    )
    .all();
  const savedOk = new Set(existing.filter((row) => row.ok).map((row) => row.day));
  for (const day of eachIsoDay(from, to)) {
    if (!force && savedOk.has(day)) {
      result.skipped += 1;
      continue;
    }
    try {
      const report = await fetchUsageDay(apiKey, day, force);
      replaceUsageDay(db, accountId, day, report);
      result.fetched += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Buildesk API request failed";
      const outcome = saveFailure(db, accountId, day, message);
      if (outcome === "kept") result.kept += 1;
      else result.failed += 1;
    }
  }
  return result;
}

export function readUsageSync(db: Db): CrmUsageSyncState | null {
  const row = db.select().from(t.crmUsageSync).where(eq(t.crmUsageSync.id, "daily")).get();
  if (!row) return null;
  return {
    lastDay: row.lastDay,
    status: row.status,
    message: row.message,
    updatedAt: row.updatedAt,
  };
}

export function writeUsageSync(db: Db, patch: { lastDay?: string; status: string; message: string }) {
  const current = db.select().from(t.crmUsageSync).where(eq(t.crmUsageSync.id, "daily")).get();
  const values = {
    id: "daily",
    lastDay: patch.lastDay ?? current?.lastDay ?? "",
    status: patch.status,
    message: patch.message.slice(0, 500),
    updatedAt: nowIso(),
  };
  if (current) {
    db.update(t.crmUsageSync).set(values).where(eq(t.crmUsageSync.id, "daily")).run();
    return;
  }
  db.insert(t.crmUsageSync).values(values).run();
}

export function boardRowsForAccounts(
  db: Db,
  accounts: Omit<CrmUsageBoardRow, "savedDays" | "failedDays" | "expectedDays" | "lastFetchedAt" | "summary">[],
  from: string,
  to: string,
): CrmUsageBoardRow[] {
  const expectedDays = eachIsoDay(from, to).length;
  const stored = db
    .select()
    .from(t.crmUsageDays)
    .where(and(gte(t.crmUsageDays.day, from), lte(t.crmUsageDays.day, to)))
    .all();
  const byAccount = new Map<string, DayRow[]>();
  for (const row of stored) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push(row);
    byAccount.set(row.accountId, list);
  }
  return accounts
    .map((account) => {
      const rows = byAccount.get(account.id) ?? [];
      const okRows = rows.filter((row) => row.ok);
      const lastFetchedAt = rows.reduce((latest, row) => (row.fetchedAt > latest ? row.fetchedAt : latest), "");
      return {
        ...account,
        savedDays: okRows.length,
        failedDays: rows.length - okRows.length,
        expectedDays,
        lastFetchedAt,
        summary: account.connected ? summarizeStoredDays(account.id, rows) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function readUsageAccountPage(
  db: Db,
  account: CrmUsageAccountPage["account"],
  from: string,
  to: string,
): CrmUsageAccountPage {
  const dates = eachIsoDay(from, to);
  const stored = db
    .select()
    .from(t.crmUsageDays)
    .where(
      and(
        eq(t.crmUsageDays.accountId, account.id),
        gte(t.crmUsageDays.day, from),
        lte(t.crmUsageDays.day, to),
      ),
    )
    .all();
  const byDay = new Map(stored.map((row) => [row.day, row]));
  const days = dates.map((date) => toUsageDay(date, byDay.get(date)));
  const okRows = stored.filter((row) => row.ok);
  const summary = account.connected ? summarizeStoredDays(account.id, stored) : null;
  const peopleRows = db
    .select()
    .from(t.crmUsagePeople)
    .where(
      and(
        eq(t.crmUsagePeople.accountId, account.id),
        gte(t.crmUsagePeople.day, from),
        lte(t.crmUsagePeople.day, to),
      ),
    )
    .all();
  const peopleMap = new Map<string, CrmUsagePersonTotal>();
  for (const row of peopleRows) {
    const current = peopleMap.get(row.name) ?? {
      name: row.name,
      team: row.team,
      leads: 0,
      followups: 0,
      meetings: 0,
      visitsScheduled: 0,
      visitsConducted: 0,
      bookings: 0,
      calls: 0,
      connectedCalls: 0,
      hasCrmActivity: false,
      hasCalls: false,
      leadOnly: false,
      productive: false,
      activeDays: 0,
    };
    current.team ||= row.team;
    current.leads += row.leads;
    current.followups += row.followups;
    current.meetings += row.meetings;
    current.visitsScheduled += row.visitsScheduled;
    current.visitsConducted += row.visitsConducted;
    current.bookings += row.bookings;
    current.calls += row.calls;
    current.connectedCalls += row.connectedCalls;
    current.hasCrmActivity ||= row.hasCrmActivity;
    current.hasCalls ||= row.hasCalls;
    current.productive ||= row.productive;
    if (row.productive || row.hasCrmActivity || row.hasCalls) current.activeDays += 1;
    current.leadOnly = current.leads > 0 && !current.hasCrmActivity && !current.hasCalls;
    peopleMap.set(row.name, current);
  }
  const people = [...peopleMap.values()].sort(
    (a, b) => b.leads + b.followups + b.calls - (a.leads + a.followups + a.calls),
  );
  const recommendations = summary?.ok
    ? usageRecommendations({
        leads: summary.leads,
        calls: summary.calls,
        followups: summary.followups,
        visitsScheduled: summary.visitsScheduled,
        visitsConducted: summary.visitsConducted,
        bookings: summary.bookings,
        activeUsers: summary.activeUsers,
        licensedUsers: account.licensedUsers,
        hasCrmActivity: summary.hasCrmActivity,
        hasCalls: summary.hasCalls,
        leadOnly: summary.leadOnly,
        bookingWarning: summary.bookingWarning,
      })
    : [];
  return {
    account,
    from,
    to,
    expectedDays: dates.length,
    savedDays: okRows.length,
    failedDays: stored.length - okRows.length,
    lastFetchedAt: stored.reduce((latest, row) => (row.fetchedAt > latest ? row.fetchedAt : latest), ""),
    summary,
    days,
    people,
    recommendations,
    pattern: usagePatternLabel(days.filter((day) => day.saved && day.ok)),
  };
}
