import { z } from "zod";

import { COMPANY_PAYMENT_STATUSES } from "@/types/company";

export const ERP_PAYMENT_STATUS_TABS = [
  "all",
  "overdue",
  "due_this_week",
  "due_this_month",
  "upcoming",
  "fully_paid",
  "pending",
  "partially_paid",
  "na",
] as const;

export type ErpPaymentStatusTabId = (typeof ERP_PAYMENT_STATUS_TABS)[number];

export const erpPaymentsSearchSchema = z.object({
  status: z.enum(ERP_PAYMENT_STATUS_TABS).optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(["nextDueDate", "overdueAmount", "pendingAmount", "collectionPercent", "companyName"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type ErpPaymentsSearch = z.infer<typeof erpPaymentsSearchSchema>;

export function parseErpPaymentStatusTab(
  value: string | undefined,
): ErpPaymentStatusTabId {
  if (value && (ERP_PAYMENT_STATUS_TABS as readonly string[]).includes(value)) {
    return value as ErpPaymentStatusTabId;
  }
  return "all";
}

/** Legacy commercial status pills → tab ids. */
export function legacyStatusToTab(
  status: (typeof COMPANY_PAYMENT_STATUSES)[number] | "all" | undefined,
): ErpPaymentStatusTabId {
  if (!status || status === "all") return "all";
  if (status === "Fully paid") return "fully_paid";
  if (status === "Pending") return "pending";
  if (status === "NA") return "na";
  if (status === "Partially paid" || status === "Part payment subscription") {
    return "partially_paid";
  }
  return "all";
}
