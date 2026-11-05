import { istHour, istToday, shiftIsoDate } from "@/lib/crm-usage";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { resolveUsageKey } from "@/server/lib/buildesk-usage";
import { readUsageSync, refreshUsageRange, writeUsageSync } from "@/server/lib/crm-usage-store";

const TICK_MS = 60_000;

let started = false;
let running = false;

/**
 * Between 00:10 and 06:00 IST, store yesterday's Buildesk usage for every connected account.
 * A successful day replaces the previous row. A failed fetch keeps a good saved day.
 */
export function startCrmUsageScheduler() {
  if (started) return;
  started = true;

  async function tick() {
    if (running) return;
    const now = new Date();
    const hour = istHour(now);
    const minute = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        minute: "2-digit",
      }).format(now),
    );
    const inWindow = (hour === 0 && minute >= 10) || (hour >= 1 && hour < 6);
    if (!inWindow) return;
    const yesterday = shiftIsoDate(istToday(now), -1);
    const db = getDb();
    const sync = readUsageSync(db);
    if (sync?.lastDay === yesterday && sync.status === "done") return;

    running = true;
    const portals = new Map(db.select().from(t.companyPortalAccess).all().map((row) => [row.companyId, row.slug]));
    const targets = db
      .select()
      .from(t.crmAccounts)
      .all()
      .flatMap((account) => {
        const key = resolveUsageKey(account.name, portals.get(account.id));
        return key ? [{ id: account.id, apiKey: key.apiKey }] : [];
      });
    writeUsageSync(db, { status: "running", message: `Saving ${yesterday} for ${targets.length} accounts` });
    console.log(`[crm-usage] nightly refresh started for ${yesterday} (${targets.length} accounts)`);
    let fetched = 0;
    let failed = 0;
    let kept = 0;
    try {
      let next = 0;
      async function worker() {
        while (next < targets.length) {
          const account = targets[next];
          next += 1;
          const result = await refreshUsageRange(db, account.id, account.apiKey, yesterday, yesterday, true);
          fetched += result.fetched;
          failed += result.failed;
          kept += result.kept;
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, targets.length) }, () => worker()));
      const message = `Saved ${yesterday}: ${fetched} updated, ${failed} failed, ${kept} kept previous`;
      writeUsageSync(db, { lastDay: yesterday, status: "done", message });
      console.log(`[crm-usage] ${message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nightly usage refresh failed";
      writeUsageSync(db, { status: "error", message });
      console.warn("[crm-usage]", error);
    } finally {
      running = false;
    }
  }

  console.log("[crm-usage] nightly refresh armed (00:10 IST, replaces yesterday)");
  setTimeout(() => void tick(), 20_000);
  setInterval(() => void tick(), TICK_MS);
}
