import { z } from "zod";

export const CRM_DASHBOARD_TABS = ["overview", "activity"] as const;
export type CrmDashboardTab = (typeof CRM_DASHBOARD_TABS)[number];

export const crmDashboardSearchSchema = z.object({
  tab: z.enum(CRM_DASHBOARD_TABS).optional(),
});

export type CrmDashboardSearch = z.infer<typeof crmDashboardSearchSchema>;

export function parseCrmDashboardTab(value: unknown): CrmDashboardTab {
  return value === "activity" ? "activity" : "overview";
}

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
