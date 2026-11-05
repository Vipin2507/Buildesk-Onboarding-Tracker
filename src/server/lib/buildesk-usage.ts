import fs from "node:fs";
import path from "node:path";

import { usageRecommendations } from "@/lib/crm-usage";
import { normalizeAccountName } from "@/lib/portal-slug-identity";
import type {
  CrmUsageDay,
  CrmUsageDetail,
  CrmUsageExecutive,
  CrmUsageScanRow,
} from "@/types/crm-usage";

const ACTIVITY_ENDPOINT =
  "https://buildeskapi.azurewebsites.net/api/GetExecutiveAcitvitySummaryReport";
const CALL_ENDPOINT = "https://buildeskapi.azurewebsites.net/api/GetCallLogReportCountUserwise";
const BOOKING_ENDPOINT =
  "https://buildeskapi.azurewebsites.net/api/GetDashboardBookingCountSummaryDaywise";

const CRM_KEYS = [
  "FollowupCount",
  "MeetingsCount",
  "SiteVisitScheduledCount",
  "SiteVisitConductedCount",
  "NewSitevisitCount",
  "SitevisitCompletedCount",
  "NewBookingCount",
  "BookingCount",
  "CPAddedCount",
  "CPContactedCount",
  "CustomerCount",
  "LeadLostCount",
] as const;

const CACHE_TTL_MS = 15 * 60 * 1000;

type Counts = Record<string, number>;

type Report = {
  executives: CrmUsageExecutive[];
  leads: number;
  followups: number;
  meetings: number;
  visitsScheduled: number;
  visitsConducted: number;
  bookings: number | null;
  calls: number;
  connectedCalls: number;
  activeUsers: number;
  executiveCount: number;
  crmScore: number;
  activityScore: number;
  hasCrmActivity: boolean;
  hasCalls: boolean;
  leadOnly: boolean;
  usageType: string;
  bookingWarning: string;
  callWarning: string;
  bookingDaily: { date: string; count: number }[];
};

const reportCache = new Map<string, { at: number; report: Report }>();

type MonitorClient = { apiKey: string; userCount: number };

let monitorCache: {
  mtimeMs: number;
  byName: Map<string, MonitorClient>;
  byLoose: Map<string, MonitorClient>;
} | null = null;

function looseAccountName(value: string) {
  return normalizeAccountName(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(pvt|private|ltd|limited|llp|inc|the|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asInt(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function leadCount(row: Counts) {
  return Math.max(row.TotalLeads ?? 0, row.LeadCount ?? 0, row.OnlyLeadCount ?? 0, row.NewLeadCount ?? 0);
}

function scheduledVisits(row: Counts) {
  return Math.max(row.SiteVisitScheduledCount ?? 0, row.NewSitevisitCount ?? 0);
}

function conductedVisits(row: Counts) {
  return Math.max(row.SiteVisitConductedCount ?? 0, row.SitevisitCompletedCount ?? 0);
}

function bookingCount(row: Counts) {
  return Math.max(row.BookingCount ?? 0, row.NewBookingCount ?? 0);
}

function hasCrm(row: Counts) {
  return CRM_KEYS.some((key) => (row[key] ?? 0) > 0);
}

function hasCalls(row: Counts) {
  return (row.TotalCall ?? 0) > 0 || (row.TotalConnectedCall ?? 0) > 0 || (row.TotalOutGoingCall ?? 0) > 0 || (row.TotalIncomingCall ?? 0) > 0;
}

export function isBuildeskDashboardKey(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function emptyMonitor() {
  return { byName: new Map<string, MonitorClient>(), byLoose: new Map<string, MonitorClient>() };
}

export function loadMonitorClients() {
  const file = path.join(process.cwd(), "buildesk_v7", "clients.json");
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return emptyMonitor();
  }
  if (monitorCache && monitorCache.mtimeMs === mtimeMs) return monitorCache;
  const byName = new Map<string, MonitorClient>();
  const looseOwners = new Map<string, string>();
  const byLoose = new Map<string, MonitorClient>();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (!row || typeof row !== "object") continue;
        const record = row as { name?: unknown; apiKey?: unknown; userCount?: unknown };
        const name = normalizeAccountName(typeof record.name === "string" ? record.name : "");
        const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
        if (!name || !apiKey) continue;
        const client = { apiKey, userCount: asInt(record.userCount) };
        byName.set(name, client);
        const loose = looseAccountName(name);
        if (!loose) continue;
        const owner = looseOwners.get(loose);
        if (!owner) {
          looseOwners.set(loose, name);
          byLoose.set(loose, client);
        } else if (owner !== name) {
          byLoose.delete(loose);
        }
      }
    }
  } catch {
    return emptyMonitor();
  }
  monitorCache = { mtimeMs, byName, byLoose };
  return monitorCache;
}

export function resolveUsageKey(
  accountName: string,
  portalSlug: string | undefined,
): { apiKey: string; source: "portal" | "monitor"; monitorUsers: number } | null {
  const slug = portalSlug?.trim() ?? "";
  const monitor = loadMonitorClients();
  const exact = monitor.byName.get(normalizeAccountName(accountName));
  const loose = monitor.byLoose.get(looseAccountName(accountName));
  const matched = exact ?? loose;
  // The health-monitor catalog is the verified Buildesk dashboard key.
  // A portal slug can also be a UUID, including keys that are not the dashboard id.
  if (matched) {
    return { apiKey: matched.apiKey, source: "monitor", monitorUsers: matched.userCount };
  }
  if (isBuildeskDashboardKey(slug)) {
    return { apiKey: slug, source: "portal", monitorUsers: 0 };
  }
  return null;
}

function addDays(iso: string, delta: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function eachDay(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    if (days.length > 120) break;
  }
  return days;
}

async function requestBuildesk(
  endpoint: string,
  apiKey: string,
  from: string,
  to: string,
  milliseconds: boolean,
) {
  const fromSuffix = milliseconds ? "T00:00:00.000" : "T00:00:00";
  const toSuffix = milliseconds ? "T23:59:59.999" : "T23:59:59";
  const params = { FromDate: from + fromSuffix, ToDate: to + toSuffix };
  const url = `${endpoint}?jsonData=${encodeURIComponent(JSON.stringify(params))}`;
  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: "application/json",
      "User-Agent": "Buildesk-Compass-Usage/1.0",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`Buildesk API returned HTTP ${response.status}`);
  }
  const data = (await response.json()) as { Success?: boolean; Message?: string; Data?: unknown };
  if (!data || data.Success !== true) {
    throw new Error(data?.Message || "Buildesk API reported failure");
  }
  return data.Data;
}

function countsFromRow(raw: Record<string, unknown>): Counts {
  const counts: Counts = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" || (typeof value === "string" && value.trim() && !Number.isNaN(Number(value)))) {
      counts[key] = asInt(value);
    }
  }
  return counts;
}

function executiveFrom(raw: Record<string, unknown>, counts: Counts): CrmUsageExecutive {
  const name = String(raw.Executive || raw.User || raw.Name || "Unknown").trim() || "Unknown";
  const leads = leadCount(counts);
  const calls = counts.TotalCall ?? 0;
  const crm = hasCrm(counts);
  const callsOn = hasCalls(counts);
  return {
    name,
    team: String(raw.Team || "").trim(),
    leads,
    followups: counts.FollowupCount ?? 0,
    meetings: counts.MeetingsCount ?? 0,
    visitsScheduled: scheduledVisits(counts),
    visitsConducted: conductedVisits(counts),
    bookings: bookingCount(counts),
    calls,
    connectedCalls: counts.TotalConnectedCall ?? 0,
    hasCrmActivity: crm,
    hasCalls: callsOn,
    leadOnly: leads > 0 && !crm && !callsOn,
    productive: callsOn || crm,
  };
}

function alignBookingDays(
  dayNumbers: number[],
  counts: number[],
  from: string,
  to: string,
): Record<string, number> | null {
  const pairs = dayNumbers.map((day, index) => [day, counts[index] ?? 0] as const);
  const expected: string[] = [];
  let cursor = to;
  while (cursor >= from) {
    expected.push(cursor);
    cursor = addDays(cursor, -1);
    if (expected.length > 120) break;
  }
  function align(sequence: readonly (readonly [number, number])[]) {
    const mapped: Record<string, number> = {};
    for (const day of expected) mapped[day] = 0;
    let index = 0;
    for (const day of expected) {
      const dayNum = Number(day.slice(8, 10));
      if (index < sequence.length && sequence[index][0] === dayNum) {
        mapped[day] = sequence[index][1];
        index += 1;
      }
    }
    return index === sequence.length ? mapped : null;
  }
  return align(pairs) ?? align([...pairs].reverse());
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

function emptyScan(accountId: string, connected: boolean, error = ""): CrmUsageScanRow {
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

function toScan(accountId: string, report: Report): CrmUsageScanRow {
  return {
    accountId,
    ok: true,
    connected: true,
    error: "",
    leads: report.leads,
    followups: report.followups,
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
  };
}

async function fetchReport(apiKey: string, from: string, to: string, fresh = false): Promise<Report> {
  const cacheKey = `${apiKey}|${from}|${to}`;
  if (!fresh) {
    const cached = reportCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.report;
  }

  let data: unknown;
  try {
    data = await requestBuildesk(ACTIVITY_ENDPOINT, apiKey, from, to, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Buildesk API request failed";
    throw new Error(message.replace(apiKey, "••••"));
  }

  const rawRows = Array.isArray(data) ? data.filter((row) => row && typeof row === "object") : [];
  const byName = new Map<string, { raw: Record<string, unknown>; counts: Counts }>();
  for (const rawValue of rawRows) {
    const raw = rawValue as Record<string, unknown>;
    const counts = countsFromRow(raw);
    const name = String(raw.Executive || raw.User || raw.Name || "Unknown").trim() || "Unknown";
    byName.set(name.toLowerCase(), { raw, counts });
  }

  let callWarning = "";
  try {
    const callData = await requestBuildesk(CALL_ENDPOINT, apiKey, from, to, false);
    const callRows = Array.isArray(callData) ? callData : [];
    for (const rawValue of callRows) {
      if (!rawValue || typeof rawValue !== "object") continue;
      const raw = rawValue as Record<string, unknown>;
      const name = String(raw.Executive || raw.User || raw.Name || "Unknown").trim() || "Unknown";
      const key = name.toLowerCase();
      const existing = byName.get(key) ?? { raw: { Executive: name }, counts: {} as Counts };
      const callCounts = countsFromRow(raw);
      for (const metric of [
        "TotalCall",
        "TotalConnectedCall",
        "TotalOutGoingCall",
        "TotalIncomingCall",
        "IncomingUnAnswered",
        "OutgoingUnAnswered",
        "MissedCall",
        "RejectedCall",
      ]) {
        if (metric in callCounts) existing.counts[metric] = callCounts[metric];
      }
      byName.set(key, existing);
    }
  } catch (error) {
    callWarning = error instanceof Error ? error.message : "Call-log report unavailable";
  }

  const executives = [...byName.values()]
    .map(({ raw, counts }) => executiveFrom(raw, counts))
    .sort((a, b) => Number(b.productive) - Number(a.productive) || b.leads + b.followups + b.calls - (a.leads + a.followups + a.calls));

  const totals: Counts = {};
  for (const entry of byName.values()) {
    for (const [key, value] of Object.entries(entry.counts)) {
      totals[key] = (totals[key] ?? 0) + value;
    }
  }

  const leads = leadCount(totals);
  const followups = totals.FollowupCount ?? 0;
  const meetings = totals.MeetingsCount ?? 0;
  const visitsScheduled = scheduledVisits(totals);
  const visitsConducted = conductedVisits(totals);
  let bookings: number | null = bookingCount(totals);
  const calls = totals.TotalCall ?? 0;
  const connectedCalls = totals.TotalConnectedCall ?? 0;
  const callActivity = hasCalls(totals);
  const activeUsers = executives.filter((person) => person.productive).length;

  let bookingWarning = "";
  let bookingDaily: { date: string; count: number }[] = [];
  try {
    const bookingData = await requestBuildesk(BOOKING_ENDPOINT, apiKey, from, to, true);
    const payload = bookingData && typeof bookingData === "object" ? (bookingData as { Days?: unknown; Count?: unknown }) : null;
    if (!payload || !Array.isArray(payload.Days) || !Array.isArray(payload.Count)) {
      throw new Error("Booking API returned an unexpected payload");
    }
    if (payload.Days.length !== payload.Count.length) {
      throw new Error("Booking API returned mismatched day counts");
    }
    const mapped = alignBookingDays(payload.Days.map(asInt), payload.Count.map(asInt), from, to);
    if (!mapped) throw new Error("Booking days could not be aligned to the selected dates");
    bookingDaily = Object.entries(mapped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
    bookings = bookingDaily.reduce((sum, day) => sum + day.count, 0);
  } catch (error) {
    bookingWarning = error instanceof Error ? error.message : "Daywise booking API unavailable";
    if (!bookings) bookings = null;
  }

  const crmActivity = hasCrm(totals) || (bookings ?? 0) > 0;
  const leadOnly = leads > 0 && !crmActivity && !callActivity;
  const crmScore =
    leads +
    followups +
    visitsScheduled +
    visitsConducted +
    meetings +
    (bookings ?? 0) +
    (totals.CPAddedCount ?? 0) +
    (totals.CPContactedCount ?? 0) +
    (totals.CustomerCount ?? 0) +
    (totals.LeadLostCount ?? 0);

  const usageType = callActivity && crmActivity
    ? "Calls + CRM"
    : callActivity
      ? "Calls only"
      : leadOnly
        ? "Lead receiving but no activity"
        : crmActivity
          ? "CRM activity"
          : "No tracked activity";

  const report: Report = {
    executives,
    leads,
    followups,
    meetings,
    visitsScheduled,
    visitsConducted,
    bookings,
    calls,
    connectedCalls,
    activeUsers,
    executiveCount: executives.length,
    crmScore,
    activityScore: calls + crmScore,
    hasCrmActivity: crmActivity,
    hasCalls: callActivity,
    leadOnly,
    usageType,
    bookingWarning,
    callWarning,
    bookingDaily,
  };
  reportCache.set(cacheKey, { at: Date.now(), report });
  return report;
}

export async function scanUsageAccounts(
  accounts: { id: string; apiKey: string | null }[],
  from: string,
  to: string,
): Promise<CrmUsageScanRow[]> {
  return mapPool(accounts, 4, async (account) => {
    if (!account.apiKey) return emptyScan(account.id, false, "No Buildesk API key");
    try {
      const report = await fetchReport(account.apiKey, from, to);
      return toScan(account.id, report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Buildesk API request failed";
      return emptyScan(account.id, true, message.slice(0, 240));
    }
  });
}

export async function loadUsageDetail(
  accountId: string,
  apiKey: string,
  from: string,
  to: string,
  licensedUsers: number,
): Promise<CrmUsageDetail> {
  const report = await fetchReport(apiKey, from, to);
  const scan = toScan(accountId, report);
  return {
    ...scan,
    from,
    to,
    executives: report.executives,
    bookingDaily: report.bookingDaily,
    recommendations: usageRecommendations({
      leads: report.leads,
      calls: report.calls,
      followups: report.followups,
      visitsScheduled: report.visitsScheduled,
      visitsConducted: report.visitsConducted,
      bookings: report.bookings,
      activeUsers: report.activeUsers,
      licensedUsers,
      hasCrmActivity: report.hasCrmActivity,
      hasCalls: report.hasCalls,
      leadOnly: report.leadOnly,
      bookingWarning: report.bookingWarning,
    }),
  };
}

export async function fetchUsageDay(apiKey: string, day: string, fresh = false) {
  return fetchReport(apiKey, day, day, fresh);
}

export async function loadUsageDays(apiKey: string, from: string, to: string): Promise<CrmUsageDay[]> {
  const days = eachDay(from, to);
  return mapPool(days, 3, async (date) => {
    try {
      const report = await fetchReport(apiKey, date, date);
      return {
        date,
        saved: true,
        ok: true,
        error: "",
        hasCrmActivity: report.hasCrmActivity,
        leadOnly: report.leadOnly,
        hasCalls: report.hasCalls,
        leads: report.leads,
        followups: report.followups,
        visitsScheduled: report.visitsScheduled,
        visitsConducted: report.visitsConducted,
        bookings: report.bookings,
        calls: report.calls,
        connectedCalls: report.connectedCalls,
        activeUsers: report.activeUsers,
        score: report.activityScore,
        fetchedAt: "",
      };
    } catch (error) {
      return {
        date,
        saved: false,
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 180) : "Fetch failed",
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
  });
}
