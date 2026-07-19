import type { StatusKey, Timestamps } from "./common";
import type { CompanyModule } from "./module";

export type CompanyPlan = "Annual" | "Half-Yearly" | "AMC";
export type CompanyRegion = "NCR" | "South" | "West" | "Rest of India";
export type CompanyHealth = "Healthy" | "Moderate" | "Critical";

export const COMPANY_PLANS: CompanyPlan[] = ["Annual", "Half-Yearly", "AMC"];
export const COMPANY_REGIONS: CompanyRegion[] = ["NCR", "South", "West", "Rest of India"];

export function migrateLegacyPlan(plan: string): CompanyPlan {
  if (plan === "Annual" || plan === "Half-Yearly" || plan === "AMC") return plan;
  if (plan === "Starter") return "Annual";
  if (plan === "Growth") return "Half-Yearly";
  if (plan === "Enterprise") return "AMC";
  return "Annual";
}

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
  /** Login user id of the assigned sales agent (optional). */
  salesAgentId?: string;
  status: StatusKey;
  modules: CompanyModule[];
  agreementDate: string;
  startDate: string;
  goLiveTarget: string;
  planExpiry: string;
  plan: CompanyPlan;
  health: CompanyHealth;
  renewedAt?: string;
};

export type OtherCharge = Timestamps & {
  id: string;
  projectId: string;
  name: string;
  amount: number;
  type: string;
};
