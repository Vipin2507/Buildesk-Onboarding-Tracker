import { formatRelativeTime } from "@/types/common";

export type CrmLastEngagedKind =
  | "query"
  | "task"
  | "meeting"
  | "visit"
  | "update"
  | "whatsapp";

export const CRM_LAST_ENGAGED_KIND_LABEL: Record<CrmLastEngagedKind, string> = {
  query: "Query",
  task: "Task",
  meeting: "Meeting",
  visit: "Visit",
  update: "Update",
  whatsapp: "WhatsApp",
};

export type CrmLastEngaged = {
  at: string;
  kind: CrmLastEngagedKind;
};

function consider(
  current: CrmLastEngaged | null,
  at: string | null | undefined,
  kind: CrmLastEngagedKind,
): CrmLastEngaged | null {
  const value = at?.trim();
  if (!value) return current;
  // Prefer ISO / sortable strings; WhatsApp unix is converted upstream.
  if (!current || value > current.at) return { at: value, kind };
  return current;
}

function unixSecondsToIso(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const ms = seconds < 1e12 ? seconds * 1000 : seconds;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Latest meaningful engagement per CRM account from local/server-backed sources.
 * WhatsApp timestamps may be unix seconds (converted here when passed as numbers).
 */
export function buildCrmAccountLastEngagedMap(input: {
  accountIds: Iterable<string>;
  accountUpdatedAt?: Iterable<{ id: string; updatedAt?: string | null }>;
  queries?: Iterable<{ companyId: string; updatedAt?: string | null; createdAt?: string | null }>;
  tasks?: Iterable<{ companyId: string; updatedAt?: string | null; createdAt?: string | null }>;
  bookings?: Iterable<{
    companyId: string;
    updatedAt?: string | null;
    createdAt?: string | null;
    startsAt?: string | null;
  }>;
  visits?: Iterable<{
    companyId: string;
    updatedAt?: string | null;
    createdAt?: string | null;
    scheduledAt?: string | null;
  }>;
  crmEvents?: Iterable<{ companyId: string; createdAt?: string | null }>;
  onboarding?: Iterable<{
    companyId: string;
    updatedAt?: string | null;
    stageUpdatedAt?: string | null;
    commLog?: { createdAt?: string | null }[];
  }>;
  whatsapp?: Iterable<{ accountId: string; timestamp: number | string }>;
}): Map<string, CrmLastEngaged> {
  const map = new Map<string, CrmLastEngaged>();
  const ids = new Set(input.accountIds);

  const set = (accountId: string, at: string | null | undefined, kind: CrmLastEngagedKind) => {
    if (!ids.has(accountId)) return;
    const next = consider(map.get(accountId) ?? null, at, kind);
    if (next) map.set(accountId, next);
  };

  for (const account of input.accountUpdatedAt ?? []) {
    set(account.id, account.updatedAt, "update");
  }
  for (const query of input.queries ?? []) {
    set(query.companyId, query.updatedAt || query.createdAt, "query");
  }
  for (const task of input.tasks ?? []) {
    set(task.companyId, task.updatedAt || task.createdAt, "task");
  }
  for (const booking of input.bookings ?? []) {
    set(
      booking.companyId,
      booking.updatedAt || booking.startsAt || booking.createdAt,
      "meeting",
    );
  }
  for (const visit of input.visits ?? []) {
    set(visit.companyId, visit.updatedAt || visit.scheduledAt || visit.createdAt, "visit");
  }
  for (const event of input.crmEvents ?? []) {
    set(event.companyId, event.createdAt, "update");
  }
  for (const record of input.onboarding ?? []) {
    set(record.companyId, record.stageUpdatedAt || record.updatedAt, "update");
    for (const entry of record.commLog ?? []) {
      set(record.companyId, entry.createdAt, "update");
    }
  }
  for (const row of input.whatsapp ?? []) {
    const at =
      typeof row.timestamp === "number"
        ? unixSecondsToIso(row.timestamp)
        : row.timestamp;
    set(row.accountId, at, "whatsapp");
  }

  return map;
}

export function formatCrmLastEngaged(engaged: CrmLastEngaged | null | undefined): string {
  if (!engaged?.at) return "—";
  return formatRelativeTime(engaged.at);
}

export function formatCrmLastEngagedKind(engaged: CrmLastEngaged | null | undefined): string {
  if (!engaged) return "";
  return CRM_LAST_ENGAGED_KIND_LABEL[engaged.kind];
}

/** Preset recency filters for the accounts Last engaged column. */
export type CrmLastEngagedRecencyFilter =
  | "all"
  | "never"
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "older_30d"
  | "older_90d";

export const CRM_LAST_ENGAGED_RECENCY_OPTIONS: {
  value: CrmLastEngagedRecencyFilter;
  label: string;
}[] = [
  { value: "all", label: "Any engagement" },
  { value: "never", label: "Never engaged" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "older_30d", label: "Older than 30 days" },
  { value: "older_90d", label: "Older than 90 days" },
];

export const CRM_LAST_ENGAGED_KIND_OPTIONS: {
  value: "all" | CrmLastEngagedKind;
  label: string;
}[] = [
  { value: "all", label: "Any channel" },
  ...(Object.entries(CRM_LAST_ENGAGED_KIND_LABEL) as [CrmLastEngagedKind, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
];

function daysSinceEngaged(at: string, now: Date): number | null {
  const ms = new Date(at).getTime();
  if (Number.isNaN(ms)) return null;
  return (now.getTime() - ms) / 86_400_000;
}

export function matchesCrmLastEngagedRecency(
  engaged: CrmLastEngaged | null | undefined,
  filter: CrmLastEngagedRecencyFilter,
  now = new Date(),
): boolean {
  if (filter === "all") return true;
  if (filter === "never") return !engaged?.at;
  if (!engaged?.at) return false;
  const days = daysSinceEngaged(engaged.at, now);
  if (days == null || days < 0) return false;
  switch (filter) {
    case "7d":
      return days <= 7;
    case "14d":
      return days <= 14;
    case "30d":
      return days <= 30;
    case "90d":
      return days <= 90;
    case "older_30d":
      return days > 30;
    case "older_90d":
      return days > 90;
    default:
      return true;
  }
}

export function matchesCrmLastEngagedKind(
  engaged: CrmLastEngaged | null | undefined,
  kind: string,
): boolean {
  if (!kind || kind === "all") return true;
  if (!engaged) return false;
  return engaged.kind === kind;
}

/** YYYY-MM-DD range on last engaged timestamp (empty bounds ignored). */
export function matchesCrmLastEngagedDateRange(
  engaged: CrmLastEngaged | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;
  if (!engaged?.at) return false;
  const value = engaged.at.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (from && value < from.slice(0, 10)) return false;
  if (to && value > to.slice(0, 10)) return false;
  return true;
}
