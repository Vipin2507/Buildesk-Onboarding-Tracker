const revision = {
  automation: 0,
  "crm-automation": 0,
};

export type AutomationConfigKey = "automation" | "crm-automation";

/** Highest config revision this browser has loaded or saved. Never moves backward. */
export function noteAutomationConfigRevision(key: AutomationConfigKey, value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return;
  if (n > revision[key]) revision[key] = n;
}

export function automationConfigRevision(key: AutomationConfigKey) {
  return revision[key];
}

type RuleLike = { id?: string; updatedAt?: string };

/** Keep the newer copy of each rule. Incoming wins ties so an intentional resave sticks. */
export function mergeAutomationRulesByUpdatedAt(existing: unknown, incoming: unknown): unknown[] {
  const existingRules = Array.isArray(existing) ? existing : [];
  const incomingRules = Array.isArray(incoming) ? incoming : [];
  const byId = new Map<string, RuleLike>();
  for (const rule of existingRules) {
    if (!rule || typeof rule !== "object") continue;
    const id = (rule as RuleLike).id;
    if (!id) continue;
    byId.set(id, rule as RuleLike);
  }
  for (const rule of incomingRules) {
    if (!rule || typeof rule !== "object") continue;
    const row = rule as RuleLike;
    if (!row.id) continue;
    const prev = byId.get(row.id);
    if (!prev || String(row.updatedAt ?? "") >= String(prev.updatedAt ?? "")) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}
