import { z } from "zod";

import type { PaymentListFilterStatus } from "@/lib/crm-payment-allocation";

export const CRM_PAYMENT_STATUS_TAB_IDS = [
  "all",
  "overdue",
  "due_this_week",
  "due_this_month",
  "due_in_45_days",
  "due_in_90_days",
  "upcoming",
  "fully_paid",
] as const;

export type CrmPaymentStatusTabId = (typeof CRM_PAYMENT_STATUS_TAB_IDS)[number];

export const crmPaymentsSearchSchema = z.object({
  status: z.enum(CRM_PAYMENT_STATUS_TAB_IDS).optional(),
  salesManager: z.string().optional(),
  supportManager1: z.string().optional(),
  supportManager2: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["nextDueDate", "overdueAmount", "collectionPercent"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type CrmPaymentsSearch = z.infer<typeof crmPaymentsSearchSchema>;

export function parseCrmPaymentStatusTab(value: unknown): CrmPaymentStatusTabId {
  if (
    typeof value === "string" &&
    CRM_PAYMENT_STATUS_TAB_IDS.includes(value as CrmPaymentStatusTabId)
  ) {
    return value as CrmPaymentStatusTabId;
  }
  return "all";
}

export function crmPaymentsSearchToApiFilters(search: CrmPaymentsSearch) {
  return {
    status: (search.status ?? "all") as PaymentListFilterStatus,
    salesManagerName: search.salesManager,
    supportManager1: search.supportManager1,
    supportManager2: search.supportManager2,
    dueDateFrom: search.dueDateFrom,
    dueDateTo: search.dueDateTo,
    search: search.search,
    page: search.page ?? 1,
    pageSize: search.pageSize ?? 15,
    sortBy: search.sortBy ?? "nextDueDate",
    sortDir: search.sortDir ?? "asc",
  };
}
