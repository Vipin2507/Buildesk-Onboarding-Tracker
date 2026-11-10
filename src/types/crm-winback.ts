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

export type CrmWinbackMediaKind = "image" | "video" | "voice" | "file";

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
  mediaKind?: CrmWinbackMediaKind;
  mediaFilename?: string;
  mediaMimetype?: string;
  hasMedia?: boolean;
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

export type CrmWinbackTemplate = Timestamps & {
  id: string;
  name: string;
  category: string;
  body: string;
  active: boolean;
  sortOrder: number;
};

export const CRM_WINBACK_OUTCOME_LABELS: Record<CrmWinbackOutcome, string> = {
  none: "Not contacted",
  interested: "Interested",
  callback: "Callback",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  do_not_contact: "Do not contact",
};

export const CRM_WINBACK_TEMPLATE_VARIABLES = [
  { key: "companyName", label: "Company name" },
  { key: "contactPerson", label: "Contact person" },
  { key: "mobile", label: "Mobile" },
  { key: "clientName", label: "Client name (alias)" },
] as const;

export const CRM_WINBACK_DEFAULT_MESSAGE = [
  "Hi {{contactPerson}},",
  "",
  "We miss working with *{{companyName}}*. Ready to restart Buildesk CRM?",
  "",
  "Reply *YES* and we will connect you with your account team.",
].join("\n");
