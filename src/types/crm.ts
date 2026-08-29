import type { Timestamps } from "./common";
import type { ModuleKey } from "./module";

/* ---------- Module subscriptions ---------- */

export type ModuleSubscriptionStatus =
  | "inactive"
  | "active"
  | "paused"
  | "expired"
  | "cancelled";

export const MODULE_SUBSCRIPTION_STATUSES: ModuleSubscriptionStatus[] = [
  "inactive",
  "active",
  "paused",
  "expired",
  "cancelled",
];

export type ModuleSubscription = Timestamps & {
  id: string;
  companyId: string;
  moduleKey: ModuleKey;
  status: ModuleSubscriptionStatus;
  startDate: string;
  validUntil?: string;
  notes?: string;
};

export type ModuleSubscriptionEvent = {
  id: string;
  subscriptionId: string;
  companyId: string;
  moduleKey: ModuleKey;
  previousStatus?: ModuleSubscriptionStatus;
  newStatus: ModuleSubscriptionStatus;
  previousStartDate?: string;
  newStartDate?: string;
  previousValidUntil?: string;
  newValidUntil?: string;
  actorUserId?: string;
  actorName: string;
  reason?: string;
  createdAt: string;
};

/* ---------- Follow-up tasks ---------- */

export type FollowUpTaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type FollowUpTaskPriority = "low" | "medium" | "high" | "urgent";

export const FOLLOW_UP_TASK_STATUSES: FollowUpTaskStatus[] = [
  "open",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

export const FOLLOW_UP_TASK_PRIORITIES: FollowUpTaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export type FollowUpTaskType =
  | "on_call_phone"
  | "on_call_gmeet_teams"
  | "offline_site_visit"
  | "offline_office";

export const FOLLOW_UP_TASK_TYPES: FollowUpTaskType[] = [
  "on_call_phone",
  "on_call_gmeet_teams",
  "offline_site_visit",
  "offline_office",
];

export const FOLLOW_UP_TASK_TYPE_LABEL: Record<FollowUpTaskType, string> = {
  on_call_phone: "On Call Via Phone",
  on_call_gmeet_teams: "On Call Via GMeet / Teams",
  offline_site_visit: "Offline - Site Visit",
  offline_office: "Offline - Office",
};

export type FollowUpTaskSource = "manual" | "booking";

export type TaskProductScope = "erp" | "crm";

export type FollowUpTask = Timestamps & {
  id: string;
  /** ERP company id or CRM account id depending on productScope. */
  companyId: string;
  productScope?: TaskProductScope;
  onboardingProjectId?: string;
  postSalesProjectId?: string;
  sourceVisitId?: string;
  title: string;
  description?: string;
  status: FollowUpTaskStatus;
  priority: FollowUpTaskPriority;
  progressPercent: number;
  dueDate?: string;
  taskType?: FollowUpTaskType;
  startTime?: string;
  endTime?: string;
  startsAt?: string;
  endsAt?: string;
  durationMinutes?: number;
  /** Minutes beyond the planned schedule slot. */
  extraTimeMinutes?: number;
  /** Most recent remark added from the task panel. */
  latestRemark?: string;
  assigneeUserId?: string;
  assigneeUserIds?: string[];
  createdByUserId?: string;
  completedAt?: string;
  completedByUserId?: string;
  source?: FollowUpTaskSource;
  bookingAppointmentId?: string;
};

/* ---------- Client visits ---------- */

export type ClientVisitStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export const CLIENT_VISIT_STATUSES: ClientVisitStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
];

export type ClientVisit = Timestamps & {
  id: string;
  companyId: string;
  onboardingProjectId?: string;
  postSalesProjectId?: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  status: ClientVisitStatus;
  visitType?: string;
  purpose: string;
  location?: string;
  assignedUserId?: string;
  contactName?: string;
  contactPhone?: string;
  outcome?: string;
  remarks?: string;
  notes?: string;
  nextAction?: string;
  nextFollowUpDate?: string;
  createdByUserId?: string;
};

/* ---------- CRM events (immutable history) ---------- */

export type CrmEventEntityType = "task" | "visit" | "subscription" | "company";

export type CrmEvent = {
  id: string;
  companyId: string;
  entityType: CrmEventEntityType;
  taskId?: string;
  visitId?: string;
  subscriptionId?: string;
  eventType: string;
  actorUserId?: string;
  actorName: string;
  remark?: string;
  oldValuesJson?: string;
  newValuesJson?: string;
  progressPercent?: number;
  dueDate?: string;
  createdAt: string;
};
