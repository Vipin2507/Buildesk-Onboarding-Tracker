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
