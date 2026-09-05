import type { AutomationLog } from "@/types/automation";

const MAX_LOGS = 500;

export type AutomationLogConfigKey = "automation" | "crm-automation";

/** Keep logs durable without blowing SQLite with huge webhook bodies. */
export function slimAutomationLog(log: AutomationLog): AutomationLog {
  return {
    ...log,
    requestPayload: slimPayload(log.requestPayload),
    responseSummary: log.responseSummary?.slice(0, 500),
    errorMessage: log.errorMessage?.slice(0, 500),
  };
}

export function slimAutomationLogs(logs: AutomationLog[]): AutomationLog[] {
  return logs.slice(0, MAX_LOGS).map(slimAutomationLog);
}

function slimPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" && value.length > 2_000) {
      out[key] = `${value.slice(0, 2_000)}…`;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = slimPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Persist a single log entry to SQLite (fire-and-forget). */
export function syncAutomationLogToServer(key: AutomationLogConfigKey, log: AutomationLog) {
  void import("@/lib/api")
    .then(({ appendAutomationLog }) =>
      appendAutomationLog({ data: { key, log: slimAutomationLog(log) } }),
    )
    .catch((err) => {
      console.warn(`[automation-log] failed to persist log to ${key}`, err);
    });
}

/** Clear all logs in SQLite for a config key. */
export function clearAutomationLogsOnServer(key: AutomationLogConfigKey) {
  void import("@/lib/api")
    .then(({ clearAutomationLogs }) => clearAutomationLogs({ data: { key } }))
    .catch((err) => {
      console.warn(`[automation-log] failed to clear logs for ${key}`, err);
    });
}

/** Load latest logs from SQLite into a store. */
export async function fetchAutomationLogsFromServer(
  key: AutomationLogConfigKey,
): Promise<AutomationLog[]> {
  const { getAutomationLogs } = await import("@/lib/api");
  const logs = await getAutomationLogs({ data: { key } });
  return (Array.isArray(logs) ? logs : []) as AutomationLog[];
}
