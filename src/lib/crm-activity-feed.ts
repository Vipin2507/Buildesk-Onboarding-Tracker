import { CRM_STAGE_LABELS } from "@/data/crm-onboarding-defaults";
import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import type { CrmAccountTabId } from "@/lib/crm-route-search";
import type { ActivityKind } from "@/types";
import type { CrmAccount } from "@/types/crm-account";
import type { CrmEvent, ModuleSubscriptionEvent } from "@/types/crm";
import type { CrmImplementationStage, CrmOnboardingRecord } from "@/types/crm-onboarding";
import { BOOKING_STATUS_LABEL } from "@/types/booking";
import type { Ticket } from "@/types/ticket";
import type { ClientVisit, FollowUpTask } from "@/types/crm";
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
  | "communication"
  | "follow_up"
  | "visit";

export type CrmActivityItem = {
  id: string;
  what: string;
  who: string;
  createdAt: string;
  kind: ActivityKind;
  category: Exclude<CrmActivityCategory, "all">;
  accountId?: string;
  accountName?: string;
  /** Account executive / account manager on the CRM account. */
  teamExecutive?: string;
  teamSalesManager?: string;
  teamSupportManager1?: string;
  teamSupportManager2?: string;
  /** Primary user/executive shown in CRM activity table. */
  executive?: string;
  /** Lead or contact name tied to the activity. */
  leadContact?: string;
  /** Activity detail / remarks body. */
  remarks?: string;
  /** Next follow-up date (YYYY-MM-DD or ISO). */
  nextFollowUp?: string;
  /** Implementation tracker stage when category is tracker. */
  trackerStage?: CrmImplementationStage;
  href?: string;
};

export type CrmActivityManagerRole = "all" | "sales" | "support1" | "support2";

export type CrmActivityAccountMeta = {
  id: string;
  name: string;
  accountManagerName?: string;
  salesManagerName?: string;
  supportManager1?: string;
  supportManager2?: string;
};

export function crmActivityAccountHref(accountId?: string, tab?: CrmAccountTabId) {
  if (!accountId) return undefined;
  const base = `/crm/accounts/${accountId}`;
  if (!tab || tab === "dashboard") return base;
  return `${base}?tab=${tab}`;
}

export type CrmActivityDestination =
  | {
      kind: "account";
      accountId: string;
      tab?: CrmAccountTabId;
    }
  | { kind: "crm-ticket"; ticketId: string }
  | { kind: "support-ticket"; ticketId: string }
  | { kind: "bookings" }
  | { kind: "tasks"; taskId?: string }
  | { kind: "visits" };

export function crmActivityTrackerStageLabel(stage: CrmImplementationStage | string): string {
  if (stage === "customer_success") return "Go Live";
  return CRM_STAGE_LABELS[stage] ?? stage;
}

function crmActivityTrackerTab(stage?: CrmImplementationStage): CrmAccountTabId {
  if (stage === "go_live" || stage === "customer_success") return "golive";
  return "dashboard";
}

export function crmActivityOpenLabel(
  category: Exclude<CrmActivityCategory, "all">,
  trackerStage?: CrmImplementationStage,
): string {
  if (category === "tracker" && trackerStage && crmActivityTrackerTab(trackerStage) === "golive") {
    return "Open go-live";
  }
  const labels: Record<Exclude<CrmActivityCategory, "all">, string> = {
    follow_up: "Open tasks",
    visit: "Open visits",
    ticket: "Open ticket",
    support: "Open support",
    booking: "Open meetings",
    communication: "Open comms",
    module: "Open modules",
    tracker: "Open tracker",
    account: "Open account",
  };
  return labels[category];
}

export function crmActivityAccountTabForCategory(
  category: Exclude<CrmActivityCategory, "all">,
): CrmAccountTabId | undefined {
  switch (category) {
    case "follow_up":
      return "tasks";
    case "ticket":
      return "tickets";
    case "communication":
      return "comms";
    case "module":
      return "modules";
    case "tracker":
    case "account":
      return "dashboard";
    default:
      return undefined;
  }
}

function parseActivityEntityId(id: string): string | undefined {
  const match = /^(?:followup|visit|ticket|support|booking|crm-event|sub-event|comm)-(.+)$/.exec(id);
  return match?.[1];
}

export function resolveCrmActivityDestination(
  item: Pick<CrmActivityItem, "id" | "category" | "accountId" | "trackerStage">,
): CrmActivityDestination | null {
  const entityId = parseActivityEntityId(item.id);

  switch (item.category) {
    case "follow_up":
      if (item.accountId) {
        return { kind: "account", accountId: item.accountId, tab: "tasks" };
      }
      return entityId ? { kind: "tasks", taskId: entityId } : { kind: "tasks" };
    case "visit":
      return { kind: "visits" };
    case "ticket":
      return entityId ? { kind: "crm-ticket", ticketId: entityId } : null;
    case "support":
      return entityId ? { kind: "support-ticket", ticketId: entityId } : null;
    case "booking":
      return { kind: "bookings" };
    case "communication":
      return item.accountId
        ? { kind: "account", accountId: item.accountId, tab: "comms" }
        : null;
    case "module":
      return item.accountId
        ? { kind: "account", accountId: item.accountId, tab: "modules" }
        : null;
    case "tracker":
      return item.accountId
        ? {
            kind: "account",
            accountId: item.accountId,
            tab: crmActivityTrackerTab(item.trackerStage),
          }
        : null;
    case "account":
      return item.accountId
        ? { kind: "account", accountId: item.accountId, tab: "dashboard" }
        : null;
    default:
      return item.accountId
        ? {
            kind: "account",
            accountId: item.accountId,
            tab: crmActivityAccountTabForCategory(item.category),
          }
        : null;
  }
}

function teamForAccount(account: CrmAccount) {
  return {
    teamExecutive: account.accountManagerName?.trim() || undefined,
    teamSalesManager: account.salesManagerName?.trim() || undefined,
    teamSupportManager1: account.supportManager1?.trim() || undefined,
    teamSupportManager2: account.supportManager2?.trim() || undefined,
  };
}

function leadContactForAccount(account?: CrmAccount, override?: string) {
  if (override?.trim()) return override.trim();
  return (
    account?.pocName?.trim() ||
    account?.contact?.trim() ||
    account?.ownerName?.trim() ||
    undefined
  );
}

function resolveExecutive(actorName?: string): string | undefined {
  const name = actorName?.trim();
  return name || undefined;
}

function userName(
  userId: string | undefined,
  userNameById: Map<string, string>,
): string | undefined {
  if (!userId) return undefined;
  return userNameById.get(userId)?.trim() || undefined;
}

function withAccountContext(
  item: Omit<
    CrmActivityItem,
    | "teamExecutive"
    | "teamSalesManager"
    | "teamSupportManager1"
    | "teamSupportManager2"
    | "href"
    | "executive"
    | "leadContact"
    | "remarks"
  > & {
    executive?: string;
    leadContact?: string;
    remarks?: string;
  },
  account?: CrmAccount,
): CrmActivityItem {
  const accountId = item.accountId ?? account?.id;
  const accountName = item.accountName ?? account?.name;
  const team = teamForAccount(account ?? ({ id: accountId ?? "", name: accountName ?? "" } as CrmAccount));
  return {
    ...item,
    accountId,
    accountName,
    ...team,
    leadContact: leadContactForAccount(account, item.leadContact),
    executive: item.executive ?? resolveExecutive(item.who),
    remarks: item.remarks ?? item.what,
    href: crmActivityAccountHref(accountId, crmActivityAccountTabForCategory(item.category)),
  };
}

export function crmActivityManagerForRole(
  item: CrmActivityItem,
  role: Exclude<CrmActivityManagerRole, "all">,
): string | undefined {
  if (role === "sales") return item.teamSalesManager;
  if (role === "support1") return item.teamSupportManager1;
  return item.teamSupportManager2;
}

export function listCrmActivityManagerNames(
  accounts: CrmActivityAccountMeta[],
  role: CrmActivityManagerRole,
): string[] {
  const names = new Set<string>();
  for (const account of accounts) {
    if (role === "all" || role === "sales") {
      const n = account.salesManagerName?.trim();
      if (n) names.add(n);
    }
    if (role === "all" || role === "support1") {
      const n = account.supportManager1?.trim();
      if (n) names.add(n);
    }
    if (role === "all" || role === "support2") {
      const n = account.supportManager2?.trim();
      if (n) names.add(n);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function listCrmActivitySalesManagerNames(accounts: CrmActivityAccountMeta[]): string[] {
  return listCrmActivityManagerNames(accounts, "sales");
}

export function listCrmActivitySupportManager1Names(accounts: CrmActivityAccountMeta[]): string[] {
  return listCrmActivityManagerNames(accounts, "support1");
}

export function listCrmActivitySupportManager2Names(accounts: CrmActivityAccountMeta[]): string[] {
  return listCrmActivityManagerNames(accounts, "support2");
}

export const CRM_ACTIVITY_CATEGORY_LABEL: Record<
  Exclude<CrmActivityCategory, "all">,
  string
> = {
  account: "Account events",
  tracker: "Implementation",
  module: "Modules",
  booking: "Meetings",
  support: "Portal support",
  ticket: "Ticket tracking",
  communication: "Communications",
  follow_up: "Follow-up",
  visit: "Site visit",
};

export const CRM_ACTIVITY_STATUS_LABEL: Record<ActivityKind, string> = {
  success: "Completed",
  info: "In progress",
  warning: "Needs attention",
  danger: "Failed / cancelled",
};

export function crmActivityExecutiveDisplay(
  item: Pick<CrmActivityItem, "executive">,
): string {
  return item.executive?.trim() || "—";
}

export function listCrmActivityExecutiveNames(items: CrmActivityItem[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    const n = item.executive?.trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function listCrmActivityLeadContactNames(items: CrmActivityItem[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    const n = item.leadContact?.trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

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
    hostUserId?: string;
  }[];
  tickets: Ticket[];
  followUpTasks?: FollowUpTask[];
  clientVisits?: ClientVisit[];
  users?: { id: string; name: string }[];
}): CrmActivityItem[] {
  const accountById = new Map(input.accounts.map((a) => [a.id, a]));
  const nameById = new Map(input.accounts.map((a) => [a.id, a.name]));
  const userNameById = new Map((input.users ?? []).map((u) => [u.id, u.name]));
  const todayYmd = new Date().toISOString().slice(0, 10);
  const events: CrmActivityItem[] = [];

  for (const e of input.crmEvents) {
    if (!input.accountIds.has(e.companyId)) continue;
    const account = accountById.get(e.companyId);
    events.push(
      withAccountContext(
        {
          id: `crm-event-${e.id}`,
          what: formatCrmEventLabel(e, nameById.get(e.companyId) ?? "Account"),
          who: e.actorName,
          executive: resolveExecutive(e.actorName),
          createdAt: e.createdAt,
          kind: crmEventKind(e.eventType),
          category: "account",
          accountId: e.companyId,
          accountName: nameById.get(e.companyId) ?? "Account",
        },
        account,
      ),
    );
  }

  for (const e of input.subscriptionEvents) {
    if (!input.accountIds.has(e.companyId)) continue;
    const account = accountById.get(e.companyId);
    const accountName = nameById.get(e.companyId) ?? "Account";
    events.push(
      withAccountContext(
        {
          id: `sub-event-${e.id}`,
          what: `${String(e.moduleKey).replace(/_/g, " ")} → ${e.newStatus}`,
          who: e.actorName ?? "System",
          executive: resolveExecutive(e.actorName) ?? "System",
          createdAt: e.createdAt,
          kind: crmEventKind(e.newStatus),
          category: "module",
          accountId: e.companyId,
          accountName,
        },
        account,
      ),
    );
  }

  for (const t of input.designTickets) {
    if (!input.accountIds.has(t.companyId)) continue;
    const account = accountById.get(t.companyId);
    const accountName = nameById.get(t.companyId) ?? "Account";
    events.push(
      withAccountContext(
        {
          id: `support-${t.id}`,
          what: `${t.ticketNumber}: ${t.subject}`,
          who: t.createdBy.name || accountName,
          executive: resolveExecutive(t.createdBy.name),
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
        },
        account,
      ),
    );
  }

  for (const t of input.tickets) {
    if (!input.accountIds.has(t.companyId)) continue;
    const account = accountById.get(t.companyId);
    const accountName = nameById.get(t.companyId) ?? "Account";
    const owner = userName(t.assignedUserId ?? t.developerId, userNameById);
    events.push(
      withAccountContext(
        {
          id: `ticket-${t.id}`,
          what: `${t.type}: ${t.title}`,
          who: owner ?? "—",
          executive: owner,
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
        },
        account,
      ),
    );
  }

  for (const b of input.bookingAppointments) {
    if (!input.accountIds.has(b.companyId)) continue;
    const account = accountById.get(b.companyId);
    const accountName = nameById.get(b.companyId) ?? "Account";
    const host = userName(b.hostUserId, userNameById);
    events.push(
      withAccountContext(
        {
          id: `booking-${b.id}`,
          what: `Call ${BOOKING_STATUS_LABEL[b.status as keyof typeof BOOKING_STATUS_LABEL] ?? b.status} — ${b.guestName}`,
          who: host ?? "—",
          executive: host,
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
          leadContact: b.guestName,
          remarks: `Meeting with ${b.guestName}`,
        },
        account,
      ),
    );
  }

  for (const task of input.followUpTasks ?? []) {
    if (!input.accountIds.has(task.companyId)) continue;
    const account = accountById.get(task.companyId);
    const assignee = userName(task.assigneeUserId, userNameById);
    const creator = userName(task.createdByUserId, userNameById);
    const actor = creator ?? assignee;
    const overdue = Boolean(task.dueDate && task.dueDate < todayYmd && task.status !== "completed");
    events.push(
      withAccountContext(
        {
          id: `followup-${task.id}`,
          what: task.title,
          who: actor ?? "—",
          executive: actor,
          createdAt: task.updatedAt || task.createdAt,
          kind:
            task.status === "completed"
              ? "success"
              : task.status === "cancelled"
                ? "danger"
                : overdue
                  ? "warning"
                  : "info",
          category: "follow_up",
          accountId: task.companyId,
          accountName: nameById.get(task.companyId) ?? "Account",
          remarks: task.latestRemark ?? task.description ?? task.title,
          nextFollowUp: task.dueDate,
        },
        account,
      ),
    );
  }

  for (const visit of input.clientVisits ?? []) {
    if (!input.accountIds.has(visit.companyId)) continue;
    const account = accountById.get(visit.companyId);
    const assignee = userName(visit.assignedUserId, userNameById);
    const creator = userName(visit.createdByUserId, userNameById);
    const actor = assignee ?? creator;
    events.push(
      withAccountContext(
        {
          id: `visit-${visit.id}`,
          what: visit.purpose,
          who: actor ?? "—",
          executive: actor,
          createdAt: visit.updatedAt || visit.scheduledAt || visit.createdAt,
          kind:
            visit.status === "completed"
              ? "success"
              : visit.status === "cancelled" || visit.status === "no_show"
                ? "danger"
                : "info",
          category: "visit",
          accountId: visit.companyId,
          accountName: nameById.get(visit.companyId) ?? "Account",
          leadContact: visit.contactName,
          remarks: visit.remarks || visit.outcome || visit.notes || visit.purpose,
          nextFollowUp: visit.nextFollowUpDate,
        },
        account,
      ),
    );
  }

  for (const account of input.accounts) {
    const record = recordFor(account, input.records);
    for (const c of record.commLog) {
      events.push(
        withAccountContext(
          {
            id: `comm-${c.id}`,
            what: c.summary,
            who: c.loggedBy ?? "—",
            executive: resolveExecutive(c.loggedBy),
            createdAt: c.createdAt,
            kind: c.status === "failed" ? "danger" : "info",
            category: "communication",
            accountId: account.id,
            accountName: account.name,
          },
          account,
        ),
      );
    }
    if (record.updatedAt) {
      events.push(
        withAccountContext(
          {
            id: `stage-${account.id}-${record.tracker.stage}-${record.updatedAt}`,
            what: `Stage · ${crmActivityTrackerStageLabel(record.tracker.stage)}`,
            who: record.tracker.lastUpdatedBy ?? "—",
            executive: resolveExecutive(record.tracker.lastUpdatedBy),
            createdAt: record.updatedAt,
            kind: account.status === "live" ? "success" : "info",
            category: "tracker",
            trackerStage: record.tracker.stage,
            accountId: account.id,
            accountName: account.name,
          },
          account,
        ),
      );
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
    /** @deprecated Prefer salesManagerFilter / supportManager filters */
    managerRole?: CrmActivityManagerRole;
    /** @deprecated Prefer salesManagerFilter / supportManager filters */
    managerName?: string;
    salesManagerFilter?: string;
    supportManager1Filter?: string;
    supportManager2Filter?: string;
    executiveFilter?: string;
    /** Staff user who performed the activity (partial match). */
    userQuery?: string;
    /** Account executive / account manager on the CRM account (partial match). */
    accountExecutiveQuery?: string;
    /** Account name partial match (when accountId is not set). */
    accountQuery?: string;
    leadContactFilter?: string;
    /** Lead / contact partial match (when leadContactFilter is not set). */
    leadContactQuery?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): CrmActivityItem[] {
  const q = filters.query?.trim().toLowerCase();
  const rangeStart = filters.dateRange ? crmActivityRangeStart(filters.dateRange) : null;
  const managerRole = filters.managerRole ?? "all";
  const managerName = filters.managerName?.trim();
  const salesManagerFilter = filters.salesManagerFilter ?? "all";
  const supportManager1Filter = filters.supportManager1Filter ?? "all";
  const supportManager2Filter = filters.supportManager2Filter ?? "all";
  const executiveFilter = filters.executiveFilter ?? "all";
  const userQuery = filters.userQuery?.trim().toLowerCase();
  const accountExecutiveQuery = filters.accountExecutiveQuery?.trim().toLowerCase();
  const accountQuery = filters.accountQuery?.trim().toLowerCase();
  const leadContactFilter = filters.leadContactFilter ?? "all";
  const leadContactQuery = filters.leadContactQuery?.trim().toLowerCase();
  const dateFrom = filters.dateFrom?.trim();
  const dateTo = filters.dateTo?.trim();

  function matchesManagerField(
    assigned: string | undefined,
    filterValue: string,
  ): boolean {
    if (filterValue === "all") return true;
    if (filterValue === "unassigned") return !assigned?.trim();
    return crmSalesManagerNamesMatch(assigned, filterValue);
  }

  return items.filter((item) => {
    if (filters.category && filters.category !== "all" && item.category !== filters.category) {
      return false;
    }
    if (filters.accountId && filters.accountId !== "all") {
      if (item.accountId !== filters.accountId) return false;
    } else if (accountQuery) {
      if (!(item.accountName ?? "").toLowerCase().includes(accountQuery)) return false;
    }
    if (filters.kind && filters.kind !== "all" && item.kind !== filters.kind) {
      return false;
    }
    if (!matchesManagerField(item.teamSalesManager, salesManagerFilter)) return false;
    if (!matchesManagerField(item.teamSupportManager1, supportManager1Filter)) return false;
    if (!matchesManagerField(item.teamSupportManager2, supportManager2Filter)) return false;
    if (
      executiveFilter !== "all" &&
      !crmSalesManagerNamesMatch(item.executive, executiveFilter)
    ) {
      return false;
    }
    if (userQuery) {
      const actor = (item.executive ?? item.who ?? "").toLowerCase();
      if (!actor.includes(userQuery)) return false;
    }
    if (accountExecutiveQuery) {
      const exec = (item.teamExecutive ?? "").toLowerCase();
      if (!exec.includes(accountExecutiveQuery)) return false;
    }
    if (leadContactFilter !== "all") {
      if (!crmSalesManagerNamesMatch(item.leadContact, leadContactFilter)) return false;
    } else if (leadContactQuery) {
      if (!(item.leadContact ?? "").toLowerCase().includes(leadContactQuery)) return false;
    }
    const itemDay = item.createdAt.slice(0, 10);
    if (dateFrom && itemDay < dateFrom) return false;
    if (dateTo && itemDay > dateTo) return false;
    if (managerRole !== "all") {
      const assigned = crmActivityManagerForRole(item, managerRole);
      if (!assigned?.trim()) return false;
      if (managerName && managerName !== "all" && !crmSalesManagerNamesMatch(assigned, managerName)) {
        return false;
      }
    } else if (managerName && managerName !== "all") {
      const matchesTeam =
        crmSalesManagerNamesMatch(item.teamSalesManager, managerName) ||
        crmSalesManagerNamesMatch(item.teamSupportManager1, managerName) ||
        crmSalesManagerNamesMatch(item.teamSupportManager2, managerName) ||
        crmSalesManagerNamesMatch(item.teamExecutive, managerName);
      if (!matchesTeam) return false;
    }
    if (rangeStart && item.createdAt < rangeStart) return false;
    if (q) {
      const hay = [
        item.what,
        item.who,
        item.accountName ?? "",
        item.executive ?? "",
        item.leadContact ?? "",
        item.remarks ?? "",
        item.teamExecutive ?? "",
        item.teamSalesManager ?? "",
        item.teamSupportManager1 ?? "",
        item.teamSupportManager2 ?? "",
        CRM_ACTIVITY_CATEGORY_LABEL[item.category],
        CRM_ACTIVITY_STATUS_LABEL[item.kind],
      ]
        .join(" ")
        .toLowerCase();
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
    follow_up: 0,
    visit: 0,
  };
  for (const item of items) counts[item.category] += 1;
  return counts;
}
