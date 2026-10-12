export type CrmWhatsappBroadcastStatus =
  | "pending"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type CrmWhatsappBroadcastDeliveryStatus =
  | "pending"
  | "sent"
  | "skipped"
  | "failed";

export type CrmWhatsappBroadcast = {
  id: string;
  /** ISO time when sending should start (or immediate). */
  scheduledAt: string;
  status: CrmWhatsappBroadcastStatus;
  /** Master template id when composed from a template; null for freeform. */
  templateId: string | null;
  templateName: string | null;
  /** Raw body with optional {{variables}} — rendered per account at send time. */
  body: string;
  createdByUserId: string | null;
  createdByName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  accountCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
};

export type CrmWhatsappBroadcastDelivery = {
  id: string;
  broadcastId: string;
  accountId: string;
  accountName: string;
  groupId: string | null;
  renderedBody: string | null;
  status: CrmWhatsappBroadcastDeliveryStatus;
  errorMessage: string | null;
  sentAt: string | null;
};
