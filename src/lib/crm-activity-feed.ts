import { CRM_STAGE_LABELS } from "@/data/crm-onboarding-defaults";
import type { ActivityKind } from "@/types";
import type { CrmAccount } from "@/types/crm-account";
import type { CrmEvent, ModuleSubscriptionEvent } from "@/types/crm";
import type { CrmOnboardingRecord } from "@/types/crm-onboarding";
import { BOOKING_STATUS_LABEL } from "@/types/booking";
import type { Ticket } from "@/types/ticket";
import {
  createCrmOnboardingRecord,
  ensureMasterDataFields,
} from "@/data/crm-onboarding-defaults";
import { resolveCrmMigrationCatalog } from "@/lib/crm-migration-catalog";
import { resolveCrmTrainingCatalogForCompany } from "@/lib/crm-training-catalog";

export type CrmActivityCategory =
  | "all"
  | "account"
  | "tracker"
  | "module"
  | "booking"
  | "support"
  | "ticket"
  | "communication";

export type CrmActivityItem = {
  id: string;
  what: string;
  who: string;
  createdAt: string;
  kind: ActivityKind;
  category: Exclude<CrmActivityCategory, "all">;
  accountId?: string;
  accountName?: string;
  href?: string;
};

export const CRM_ACTIVITY_CATEGORY_LABEL: Record<
  Exclude<CrmActivityCategory, "all">,
  string
> = {
  account: "Account events",
  tracker: "Implementation",
  module: "Modules",
  booking: "Bookings",
  support: "Portal support",
  ticket: "Ticket tracking",
  communication: "Communications",
};

function recordFor(account: CrmAccount, records: CrmOnboardingRecord[]): CrmOnboardingRecord {
  const found = records.find((r) => r.companyId === account.id);
  if (found) {
    return { ...found, ...ensureMasterDataFields(found) };
  }
  return createCrmOnboardingRecord(
    account.id,
    account.companyType,
    resolveCrmMigrationCatalog(),
    resolveCrmTrainingCatalogForCompany(account.companyType),
  );
}

function crmEventKind(eventType: string): ActivityKind {
  if (eventType.includes("completed") || eventType.includes("active") || eventType.includes("live")) {
    return "success";
  }
  if (eventType.includes("cancelled") || eventType.includes("expired") || eventType.includes("failed")) {
    return "danger";
  }
  if (eventType.includes("paused") || eventType.includes("blocked") || eventType.includes("overdue")) {
    return "warning";
  }
  return "info";
}

function formatCrmEventLabel(event: CrmEvent, accountName: string) {
  const label = event.eventType.replace(/_/g, " ");
  if (event.remark?.trim()) return `${label} — ${event.remark.trim()}`;
  return label;
}

export function buildCrmActivityFeed(input: {
  accounts: CrmAccount[];
  records: CrmOnboardingRecord[];
  accountIds: Set<string>;
  crmEvents: CrmEvent[];
  subscriptionEvents: ModuleSubscriptionEvent[];
  designTickets: {
    id: string;
    companyId: string;
    ticketNumber: string;
    subject: string;
    status: string;
    updatedAt: string;
    createdBy: { name: string };
  }[];
  bookingAppointments: {
    id: string;
    companyId: string;
    guestName: string;
    status: string;
    updatedAt: string;
    createdAt: string;
  }[];
  tickets: Ticket[];
}): CrmActivityItem[] {
  const nameById = new Map(input.accounts.map((a) => [a.id, a.name]));
  const events: CrmActivityItem[] = [];

  for (const e of input.crmEvents) {
    if (!input.accountIds.has(e.companyId)) continue;
    const accountName = nameById.get(e.companyId) ?? "Account";
    events.push({
      id: `crm-event-${e.id}`,
      what: formatCrmEventLabel(e, accountName),
      who: e.actorName,
      createdAt: e.createdAt,
      kind: crmEventKind(e.eventType),
      category: "account",
      accountId: e.companyId,
      accountName,
      href: `/crm/accounts/${e.companyId}`,
    });
  }

  for (const e of input.subscriptionEvents) {
    if (!input.accountIds.has(e.companyId)) continue;
    const accountName = nameById.get(e.companyId) ?? "Account";
    events.push({
      id: `sub-event-${e.id}`,
      what: `${String(e.moduleKey).replace(/_/g, " ")} → ${e.newStatus}`,
      who: e.actorName ?? "System",
      createdAt: e.createdAt,
      kind: crmEventKind(e.newStatus),
      category: "module",
      accountId: e.companyId,
      accountName,
      href: `/crm/accounts/${e.companyId}`,
    });
  }

  for (const t of input.designTickets) {
    if (!input.accountIds.has(t.companyId)) continue;
    const accountName = nameById.get(t.companyId) ?? "Account";
    events.push({
      id: `support-${t.id}`,
      what: `${t.ticketNumber}: ${t.subject}`,
      who: t.createdBy.name || accountName,
      createdAt: t.updatedAt,
      kind:
        t.status === "resolved" || t.status === "closed"
          ? "success"
          : t.status === "open"
            ? "warning"
            : "info",
      category: "support",
      accountId: t.companyId,
      accountName,
      href: `/crm/support/${t.id}`,
    });
  }

  for (const t of input.tickets) {
    if (!input.accountIds.has(t.companyId)) continue;
    const accountName = nameById.get(t.companyId) ?? "Account";
    events.push({
      id: `ticket-${t.id}`,
      what: `${t.type}: ${t.title}`,
      who: t.status,
      createdAt: t.updatedAt,
      kind:
        t.status === "Closed" || t.resolutionStatus === "Resolved"
          ? "success"
          : t.priority === "High" || t.priority === "Critical"
            ? "warning"
            : "info",
      category: "ticket",
      accountId: t.companyId,
      accountName,
      href: `/crm/tickets/${t.id}`,
    });
  }

  for (const b of input.bookingAppointments) {
    if (!input.accountIds.has(b.companyId)) continue;
    const accountName = nameById.get(b.companyId) ?? "Account";
    events.push({
      id: `booking-${b.id}`,
      what: `Call ${BOOKING_STATUS_LABEL[b.status as keyof typeof BOOKING_STATUS_LABEL] ?? b.status} — ${b.guestName}`,
      who: accountName,
      createdAt: b.updatedAt || b.createdAt,
      kind:
        b.status === "confirmed"
          ? "success"
          : b.status === "pending"
            ? "warning"
            : b.status === "cancelled" || b.status === "declined"
              ? "danger"
              : "info",
      category: "booking",
      accountId: b.companyId,
      accountName,
      href: "/crm/bookings",
    });
  }

  for (const account of input.accounts) {
    const record = recordFor(account, input.records);
    for (const c of record.commLog) {
      events.push({
        id: `comm-${c.id}`,
        what: c.summary,
        who: c.channel ? `${c.channel}` : account.name,
        createdAt: c.createdAt,
        kind: c.status === "failed" ? "danger" : "info",
        category: "communication",
        accountId: account.id,
        accountName: account.name,
        href: `/crm/accounts/${account.id}`,
      });
    }
    if (record.updatedAt) {
      events.push({
        id: `stage-${account.id}-${record.tracker.stage}-${record.updatedAt}`,
        what: `Stage · ${CRM_STAGE_LABELS[record.tracker.stage] ?? record.tracker.stage}`,
        who: record.tracker.lastUpdatedBy || account.accountManagerName || "Team",
        createdAt: record.updatedAt,
        kind: account.status === "live" ? "success" : "info",
        category: "tracker",
        accountId: account.id,
        accountName: account.name,
        href: `/crm/accounts/${account.id}`,
      });
    }
  }

  const seen = new Set<string>();
  return events
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((e) => {
      const key = `${e.id}\0${e.createdAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export type CrmActivityDateRange = "7d" | "30d" | "90d" | "all";

export function crmActivityRangeStart(range: CrmActivityDateRange): string | null {
  if (range === "all") return null;
  const d = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function filterCrmActivityItems(
  items: CrmActivityItem[],
  filters: {
    category?: CrmActivityCategory;
    accountId?: string;
    kind?: ActivityKind | "all";
    query?: string;
    dateRange?: CrmActivityDateRange;
  },
): CrmActivityItem[] {
  const q = filters.query?.trim().toLowerCase();
  const rangeStart = filters.dateRange ? crmActivityRangeStart(filters.dateRange) : null;

  return items.filter((item) => {
    if (filters.category && filters.category !== "all" && item.category !== filters.category) {
      return false;
    }
    if (filters.accountId && filters.accountId !== "all" && item.accountId !== filters.accountId) {
      return false;
    }
    if (filters.kind && filters.kind !== "all" && item.kind !== filters.kind) {
      return false;
    }
    if (rangeStart && item.createdAt < rangeStart) return false;
    if (q) {
      const hay = `${item.what} ${item.who} ${item.accountName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type CrmActivityDateGroup = "today" | "yesterday" | "week" | "earlier";

export function crmActivityDateGroup(iso: string): CrmActivityDateGroup {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (d >= startOfToday) return "today";
  if (d >= startOfYesterday) return "yesterday";
  if (d >= startOfWeek) return "week";
  return "earlier";
}

export const CRM_ACTIVITY_DATE_GROUP_LABEL: Record<CrmActivityDateGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  earlier: "Earlier",
};

export function groupCrmActivityByDate(items: CrmActivityItem[]) {
  const order: CrmActivityDateGroup[] = ["today", "yesterday", "week", "earlier"];
  const map = new Map<CrmActivityDateGroup, CrmActivityItem[]>();
  for (const g of order) map.set(g, []);
  for (const item of items) {
    map.get(crmActivityDateGroup(item.createdAt))!.push(item);
  }
  return order
    .map((key) => ({ key, label: CRM_ACTIVITY_DATE_GROUP_LABEL[key], items: map.get(key)! }))
    .filter((g) => g.items.length > 0);
}

export function countCrmActivityByCategory(items: CrmActivityItem[]) {
  const counts: Record<CrmActivityCategory, number> = {
    all: items.length,
    account: 0,
    tracker: 0,
    module: 0,
    booking: 0,
    support: 0,
    ticket: 0,
    communication: 0,
  };
  for (const item of items) counts[item.category] += 1;
  return counts;
}
