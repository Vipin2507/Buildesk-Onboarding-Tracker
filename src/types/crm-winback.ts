import type { Timestamps } from "./common";

export type CrmWinbackOutcome =
  | "none"
  | "interested"
  | "callback"
  | "not_interested"
  | "wrong_number"
  | "do_not_contact";

export type CrmWinbackCampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "done"
  | "cancelled";

export type CrmWinbackDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export type CrmWinbackContact = Timestamps & {
  id: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  mobileNormalized: string;
  email?: string;
  city?: string;
  outcome: CrmWinbackOutcome;
  notes?: string;
  ownerName?: string;
  tags: string[];
  lastContactedAt?: string;
  archived: boolean;
};

export type CrmWinbackCampaign = Timestamps & {
  id: string;
  name: string;
  channel: "whatsapp";
  body: string;
  status: CrmWinbackCampaignStatus;
  scheduledAt?: string;
  waveSize: number;
  createdByUserId?: string;
  createdByName?: string;
  startedAt?: string;
  finishedAt?: string;
  recipientCount: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
};

export type CrmWinbackDelivery = Timestamps & {
  id: string;
  campaignId: string;
  contactId: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  renderedBody?: string;
  status: CrmWinbackDeliveryStatus;
  errorMessage?: string;
  waveNumber: number;
  sentAt?: string;
};

export const CRM_WINBACK_OUTCOME_LABELS: Record<CrmWinbackOutcome, string> = {
  none: "Not contacted",
  interested: "Interested",
  callback: "Callback",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  do_not_contact: "Do not contact",
};
