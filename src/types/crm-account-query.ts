export type CrmAccountQueryStatus = "open" | "resolved" | "archived";

export type CrmAccountQueryCategory =
  | "general"
  | "billing"
  | "technical"
  | "onboarding";

export type CrmAccountQueryMessageType = "text" | "image" | "voice" | "file" | "system";

export type CrmAccountQueryAttachment = {
  name: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
};

export type CrmAccountQuerySummary = {
  id: string;
  companyId: string;
  accountName?: string;
  title: string;
  status: CrmAccountQueryStatus;
  category?: CrmAccountQueryCategory;
  createdByUserId: string;
  createdByName: string;
  messageCount: number;
  lastMessagePreview?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmAccountQueryMessage = {
  id: string;
  queryId: string;
  authorUserId: string;
  authorName: string;
  messageType: CrmAccountQueryMessageType;
  body: string;
  attachments?: CrmAccountQueryAttachment[];
  createdAt: string;
};

export type CrmAccountQuery = {
  id: string;
  companyId: string;
  title: string;
  status: CrmAccountQueryStatus;
  category?: CrmAccountQueryCategory;
  createdByUserId: string;
  createdByName: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByName?: string;
  messages: CrmAccountQueryMessage[];
  createdAt: string;
  updatedAt: string;
};

export const CRM_ACCOUNT_QUERY_CATEGORY_LABEL: Record<CrmAccountQueryCategory, string> = {
  general: "General",
  billing: "Billing",
  technical: "Technical",
  onboarding: "Onboarding",
};

export const CRM_ACCOUNT_QUERY_STATUS_LABEL: Record<CrmAccountQueryStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  archived: "Archived",
};
