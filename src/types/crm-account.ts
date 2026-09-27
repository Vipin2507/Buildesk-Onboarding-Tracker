import type { Timestamps } from "./common";
import type { CompanyType } from "./company";

/** CRM customer account — separate from ERP Company records */
export type CrmAccount = Timestamps & {
  id: string;
  name: string;
  /** Client / portal user identifier */
  userId?: string;
  companyType: CompanyType;
  /** Legacy primary contact — kept in sync with owner fields */
  contact: string;
  phone: string;
  email: string;
  city: string;
  state?: string;
  country?: string;
  region?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  pocName?: string;
  pocMobile?: string;
  pocEmail?: string;
  salesManagerName?: string;
  accountManagerName?: string;
  supportManager1?: string;
  supportManager2?: string;
  startDate?: string;
  endDate?: string;
  annualLicense?: boolean;
  dealSize?: number;
  usersPurchased?: number;
  valuePerUser?: number;
  totalCost?: number;
  paymentReceived?: number;
  pendingAmount?: number;
  /**
   * Lifetime ledger total frozen at renew time. Pending/received for the current deal
   * are computed as max(0, lifetimeReceived − paymentCycleBaseline).
   */
  paymentCycleBaseline?: number;
  /** `endDate` value for which the 30-day renewal bell notification was already sent. */
  renewalWindowNotifiedForEndDate?: string;
  /** GST rate applied to deal value (deal size is inclusive of GST). */
  gstPercent?: number;
  installmentCount?: number;
  installments?: CrmAccountInstallment[];
  healthScore?: number;
  status: "active" | "onboarding" | "live" | "suspended" | "inactive" | "closed";
  /** Reason noted when marking suspended or inactive */
  statusRemarks?: string;
  /** WAHA WhatsApp group JID (`…@g.us`) bound for the account chat tab */
  whatsappGroupId?: string;
  /** Cached group subject / display name */
  whatsappGroupName?: string;
};

export type CrmAccountInstallment = {
  id?: string;
  amount: number;
  dueDate: string;
  /** Extra dues after the original deal is collected. */
  kind?: "renewal";
};
