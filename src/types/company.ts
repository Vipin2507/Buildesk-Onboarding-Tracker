import type { StatusKey, Timestamps } from "./common";

export type CompanyPlan = "Starter" | "Growth" | "Enterprise";
export type CompanyHealth = "Healthy" | "Moderate" | "Critical";

export type Company = Timestamps & {
  id: string;
  name: string;
  contact: string;
  designation: string;
  phone: string;
  email: string;
  city: string;
  onboardingManagerId: string;
  csmId: string;
  status: StatusKey;
  modules: string[];
  agreementDate: string;
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
