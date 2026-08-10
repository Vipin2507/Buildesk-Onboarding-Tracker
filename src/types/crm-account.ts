import type { Timestamps } from "./common";
import type { CompanyType } from "./company";

/** CRM customer account — separate from ERP Company records */
export type CrmAccount = Timestamps & {
  id: string;
  name: string;
  companyType: CompanyType;
  contact: string;
  phone: string;
  email: string;
  city: string;
  state?: string;
  region?: string;
  ownerName?: string;
  pocName?: string;
  pocMobile?: string;
  salesManagerName?: string;
  accountManagerName?: string;
  supportManager1?: string;
  supportManager2?: string;
  startDate?: string;
  endDate?: string;
  annualLicense?: boolean;
  dealSize?: number;
  usersPurchased?: number;
  totalCost?: number;
  paymentReceived?: number;
  pendingAmount?: number;
  healthScore?: number;
  status: "active" | "onboarding" | "live" | "churned";
};
