import { z } from "zod";

export const crmDashboardSearchSchema = z.object({});

export type CrmDashboardSearch = z.infer<typeof crmDashboardSearchSchema>;

export const CRM_BOOKINGS_TAB_IDS = [
  "all",
  "pending",
  "upcoming",
  "past",
  "closed",
  "availability",
  "blocked",
  "calendar",
] as const;

export type CrmBookingsTabId = (typeof CRM_BOOKINGS_TAB_IDS)[number];

export const crmBookingsSearchSchema = z.object({
  tab: z.enum(CRM_BOOKINGS_TAB_IDS).optional(),
  google: z.enum(["connected", "error"]).optional(),
  googleError: z.string().optional(),
});

export type CrmBookingsSearch = z.infer<typeof crmBookingsSearchSchema>;

export function parseCrmBookingsTab(value: unknown): CrmBookingsTabId {
  if (typeof value === "string" && CRM_BOOKINGS_TAB_IDS.includes(value as CrmBookingsTabId)) {
    return value as CrmBookingsTabId;
  }
  return "pending";
}

export const CRM_TASKS_TAB_IDS = [
  "all",
  "my",
  "open",
  "overdue",
  "today",
  "list",
  "day",
  "week",
  "month",
] as const;

export type CrmTasksTabId = (typeof CRM_TASKS_TAB_IDS)[number];

export const crmTasksSearchSchema = z.object({
  tab: z.enum(CRM_TASKS_TAB_IDS).optional(),
  taskId: z.string().optional(),
});

export type CrmTasksSearch = z.infer<typeof crmTasksSearchSchema>;

export function parseCrmTasksTab(value: unknown): CrmTasksTabId {
  if (typeof value === "string" && CRM_TASKS_TAB_IDS.includes(value as CrmTasksTabId)) {
    return value as CrmTasksTabId;
  }
  return "all";
}

export const CRM_ACCOUNT_TAB_IDS = [
  "dashboard",
  "modules",
  "integrations",
  "masters",
  "migration",
  "training",
  "reports",
  "golive",
  "tasks",
  "meetings",
  "tickets",
  "queries",
  "comms",
] as const;

export type CrmAccountTabId = (typeof CRM_ACCOUNT_TAB_IDS)[number];

export const crmAccountSearchSchema = z.object({
  tab: z.enum(CRM_ACCOUNT_TAB_IDS).optional(),
  queryId: z.string().optional(),
});

export type CrmAccountSearch = z.infer<typeof crmAccountSearchSchema>;

export function parseCrmAccountTab(value: unknown): CrmAccountTabId {
  if (typeof value === "string" && CRM_ACCOUNT_TAB_IDS.includes(value as CrmAccountTabId)) {
    return value as CrmAccountTabId;
  }
  return "dashboard";
}

export const crmQueriesSearchSchema = z.object({
  status: z.enum(["all", "open", "resolved", "archived"]).optional(),
  queryId: z.string().optional(),
});

export type CrmQueriesSearch = z.infer<typeof crmQueriesSearchSchema>;

export function parseCrmQueriesStatus(
  value: unknown,
): "all" | "open" | "resolved" | "archived" {
  if (value === "open" || value === "resolved" || value === "archived") return value;
  return "all";
}
