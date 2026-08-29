import { z } from "zod";

export const ERP_TASKS_TAB_IDS = [
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

export type ErpTasksTabId = (typeof ERP_TASKS_TAB_IDS)[number];

export const erpTasksSearchSchema = z.object({
  tab: z.enum(ERP_TASKS_TAB_IDS).optional(),
  taskId: z.string().optional(),
});

export type ErpTasksSearch = z.infer<typeof erpTasksSearchSchema>;

export function parseErpTasksTab(value: unknown): ErpTasksTabId {
  if (typeof value === "string" && ERP_TASKS_TAB_IDS.includes(value as ErpTasksTabId)) {
    return value as ErpTasksTabId;
  }
  return "all";
}
