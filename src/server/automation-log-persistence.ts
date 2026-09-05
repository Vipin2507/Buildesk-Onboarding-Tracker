import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { nowIso } from "@/types";
import type { AutomationLog } from "@/types/automation";

export type AutomationConfigKey = "automation" | "crm-automation";

const MAX_LOGS = 500;

function readSnapshot(db: ReturnType<typeof getDb>, key: AutomationConfigKey) {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, key)).get();
  if (!row?.valueJson) return { row: undefined, snapshot: {} as Record<string, unknown> };
  try {
    return {
      row,
      snapshot: JSON.parse(row.valueJson) as Record<string, unknown>,
    };
  } catch {
    return { row, snapshot: {} as Record<string, unknown> };
  }
}

function writeSnapshot(
  db: ReturnType<typeof getDb>,
  key: AutomationConfigKey,
  snapshot: Record<string, unknown>,
  row: { key: string } | undefined,
) {
  const valueJson = JSON.stringify(snapshot);
  const now = nowIso();
  if (row) {
    db.update(t.appConfig)
      .set({ valueJson, updatedAt: now })
      .where(eq(t.appConfig.key, key))
      .run();
  } else {
    db.insert(t.appConfig).values({ key, valueJson, updatedAt: now }).run();
  }
}

export function readAutomationLogsFromConfig(
  db: ReturnType<typeof getDb>,
  key: AutomationConfigKey,
): AutomationLog[] {
  const { snapshot } = readSnapshot(db, key);
  return Array.isArray(snapshot.logs) ? (snapshot.logs as AutomationLog[]) : [];
}

/** Upsert a log entry into app_config (used by server cron and client API). */
export function appendAutomationLogToConfig(
  db: ReturnType<typeof getDb>,
  key: AutomationConfigKey,
  log: AutomationLog,
) {
  const { row, snapshot } = readSnapshot(db, key);
  const existing = Array.isArray(snapshot.logs) ? (snapshot.logs as AutomationLog[]) : [];
  const idx = existing.findIndex((entry) => entry.id === log.id);
  const nextLogs =
    idx >= 0
      ? existing.map((entry, i) => (i === idx ? log : entry))
      : [log, ...existing];
  writeSnapshot(db, key, { ...snapshot, logs: nextLogs.slice(0, MAX_LOGS) }, row);
}

export function replaceAutomationLogsInConfig(
  db: ReturnType<typeof getDb>,
  key: AutomationConfigKey,
  logs: AutomationLog[],
) {
  const { row, snapshot } = readSnapshot(db, key);
  writeSnapshot(db, key, { ...snapshot, logs: logs.slice(0, MAX_LOGS) }, row);
}
