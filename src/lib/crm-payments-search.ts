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
  "renewal",
  "suspended",
  "suspend_and_close",
] as const;

export type CrmPaymentStatusTabId = (typeof CRM_PAYMENT_STATUS_TAB_IDS)[number];

/** Legacy Sales/Customer Lost filters map onto Suspend and Close (not inactive). */
function normalizePaymentStatusTab(value: unknown): CrmPaymentStatusTabId | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "sales_lost" || value === "customer_lost") {
    return "suspend_and_close";
  }
  if (value === "lost") return undefined;
  if (CRM_PAYMENT_STATUS_TAB_IDS.includes(value as CrmPaymentStatusTabId)) {
    return value as CrmPaymentStatusTabId;
  }
  return undefined;
}

export const crmPaymentsSearchSchema = z.object({
  status: z.preprocess(normalizePaymentStatusTab, z.enum(CRM_PAYMENT_STATUS_TAB_IDS).optional()),
  salesManager: z.string().optional(),
  supportManager1: z.string().optional(),
  supportManager2: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["nextDueDate", "overdueAmount", "collectionPercent", "renewalDate"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type CrmPaymentsSearch = z.infer<typeof crmPaymentsSearchSchema>;

export function parseCrmPaymentStatusTab(value: unknown): CrmPaymentStatusTabId {
  return normalizePaymentStatusTab(value) ?? "all";
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
