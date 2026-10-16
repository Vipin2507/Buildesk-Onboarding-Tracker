import type { Timestamps } from "./common";
import type { CompanyPaymentStatus } from "./company";

export type CompanyPaymentMethod =
  | "Bank transfer"
  | "UPI"
  | "Cheque"
  | "Cash"
  | "Card"
  | "Other";

export const COMPANY_PAYMENT_METHODS: CompanyPaymentMethod[] = [
  "Bank transfer",
  "UPI",
  "Cheque",
  "Cash",
  "Card",
  "Other",
];

export type CompanyPaymentInstallmentStatus = "pending" | "paid" | "overdue" | "waived";

export const COMPANY_PAYMENT_INSTALLMENT_STATUSES: CompanyPaymentInstallmentStatus[] = [
  "pending",
  "paid",
  "overdue",
  "waived",
];

export type CompanyPaymentTransaction = Timestamps & {
  id: string;
  companyId: string;
  amount: number;
  paidDate: string;
  note?: string;
  method?: CompanyPaymentMethod | string;
  createdBy?: string;
};

export type CompanyPaymentInstallment = Timestamps & {
  id: string;
  companyId: string;
  sequence: number;
  label?: string;
  amount: number;
  dueDate: string;
  status: CompanyPaymentInstallmentStatus;
  notes?: string;
};

export type CompanyPaymentsSnapshot = {
  companyId: string;
  companyName: string;
  dealSize: number;
  paymentReceived: number;
  pendingAmount: number;
  paymentStatus: CompanyPaymentStatus;
  installmentCount: number;
  transactions: CompanyPaymentTransaction[];
  installments: CompanyPaymentInstallment[];
};

/** Due-window bucket for ERP hub filters (installment-derived). */
export type ErpPaymentDueBucket =
  | "overdue"
  | "due_this_week"
  | "due_this_month"
  | "upcoming"
  | "none";

/** Row for ERP /payments hub (separate from CRM payments list). */
export type ErpCompanyPaymentListItem = {
  companyId: string;
  companyName: string;
  city: string;
  commercialStatus?: string;
  dealSize: number;
  paymentReceived: number;
  pendingAmount: number;
  paymentStatus: CompanyPaymentStatus;
  /** @deprecated Prefer nextDueDate from installments. */
  installmentDueDate?: string;
  /** Earliest unpaid installment due date (YYYY-MM-DD). */
  nextDueDate?: string;
  nextDueAmount?: number;
  overdueAmount: number;
  overdueInstallmentCount: number;
  dueBucket: ErpPaymentDueBucket;
  transactionCount: number;
  collectionPercent: number;
};

export type ErpCompanyPaymentsSummary = {
  companyCount: number;
  totalDealSize: number;
  totalReceived: number;
  totalPending: number;
  totalOverdueAmount: number;
  overdueCompanyCount: number;
  dueThisWeekAmount: number;
  dueThisWeekCount: number;
  dueThisMonthAmount: number;
  dueThisMonthCount: number;
  collectionRatePercent: number;
  fullyPaidCount: number;
  pendingCount: number;
  partiallyPaidCount: number;
  naCount: number;
  statusCounts: Record<string, number>;
};
