import type { StatusKey, Timestamps } from "./common";
import type { CompanyModule } from "./module";

export type CompanyPlan = "Annual" | "Half-Yearly" | "AMC";
export type CompanyRegion = "NCR" | "South" | "West" | "Rest of India";
export type CompanyHealth = "Healthy" | "Moderate" | "Critical";

export type CompanyType =
  | "Real Estate Developer"
  | "Channel Partner"
  | "Broker"
  | "Mandate"
  | "CT"
  | "Agent";

export const COMPANY_PLANS: CompanyPlan[] = ["Annual", "Half-Yearly", "AMC"];

/** Commercial subscription status from bulk-import sheet. */
export type CompanyCommercialStatus = "Live" | "Unpaid" | "Canceled" | "Expired" | "Future";

export const COMPANY_COMMERCIAL_STATUSES = [
  "Live",
  "Unpaid",
  "Canceled",
  "Expired",
  "Future",
] as const satisfies readonly CompanyCommercialStatus[];

/** Full plan label from commercial bulk-import sheet. */
export type CompanyCommercialPlanName =
  | "Post Sales Annual License Plan"
  | "Buildesk Post Sales Annual License Plan"
  | "Buildesk Sales & Post Sales Module Annual Plan";

export const COMPANY_COMMERCIAL_PLAN_NAMES = [
  "Post Sales Annual License Plan",
  "Buildesk Post Sales Annual License Plan",
  "Buildesk Sales & Post Sales Module Annual Plan",
] as const satisfies readonly CompanyCommercialPlanName[];

/** Payment status from commercial bulk-import sheet. */
export type CompanyPaymentStatus =
  | "NA"
  | "Fully paid"
  | "Partially paid"
  | "Pending"
  | "Part payment subscription";

export const COMPANY_PAYMENT_STATUSES = [
  "NA",
  "Fully paid",
  "Partially paid",
  "Pending",
  "Part payment subscription",
] as const satisfies readonly CompanyPaymentStatus[];

export const COMPANY_REGIONS: CompanyRegion[] = ["NCR", "South", "West", "Rest of India"];
export const COMPANY_TYPES: CompanyType[] = [
  "Real Estate Developer",
  "Channel Partner",
  "Broker",
  "Mandate",
  "CT",
  "Agent",
];

export function migrateLegacyPlan(plan: string): CompanyPlan {
  if (plan === "Annual" || plan === "Half-Yearly" || plan === "AMC") return plan;
  if (plan === "Starter") return "Annual";
  if (plan === "Growth") return "Half-Yearly";
  if (plan === "Enterprise") return "AMC";
  return "Annual";
}

export type CompanyPaymentHistoryEntry = {
  id: string;
  date: string;
  amount: number;
  note?: string;
  method?: string;
};

export type Company = Timestamps & {
  id: string;
  name: string;
  contact: string;
  designation: string;
  phone: string;
  email: string;
  city: string;
  region: CompanyRegion;
  ownerName: string;
  ownerMobile: string;
  pocName: string;
  pocMobile: string;
  officeAddress?: string;
  gstNumber?: string;
  billingInfo?: string;
  onboardingManagerId: string;
  csmId: string;
  /** Login user id of the assigned sales agent / sales manager (optional). */
  salesAgentId?: string;
  status: StatusKey;
  modules: CompanyModule[];
  agreementDate: string;
  startDate: string;
  goLiveTarget: string;
  planExpiry: string;
  plan: CompanyPlan;
  /** Full commercial plan label from sheet (distinct from legacy plan tier). */
  planName?: CompanyCommercialPlanName;
  health: CompanyHealth;
  renewedAt?: string;

  /** CRM / commercial master fields */
  companyType?: CompanyType;
  state?: string;
  supportManager1Id?: string;
  supportManager2Id?: string;
  additionalSupportContactIds?: string[];
  annualLicense?: boolean;
  dealSize?: number;
  usersPurchased?: number;
  totalCost?: number;
  paymentReceived?: number;
  pendingAmount?: number;
  endDate?: string;
  paymentHistory?: CompanyPaymentHistoryEntry[];
  amountWithGst?: number;
  taxableAmount?: number;
  gstAmount?: number;
  paymentStatus?: CompanyPaymentStatus;
  /** Subscription status from commercial sheet (Live, Unpaid, Canceled, etc.) */
  commercialStatus?: CompanyCommercialStatus;
  installmentCount?: number;
  installmentAmount?: number;
  installmentDueDate?: string;
  cancelledOn?: string;
};

export type OtherCharge = Timestamps & {
  id: string;
  projectId: string;
  name: string;
  amount: number;
  type: string;
};
