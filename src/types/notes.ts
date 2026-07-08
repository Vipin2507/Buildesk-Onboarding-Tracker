import type { Timestamps } from "./common";

export type AttachmentCategory =
  | "unit"
  | "customer"
  | "booking"
  | "payment"
  | "post-sales-step"
  | "document-template"
  | "attendance"
  | "other";

export type CompanyAttachment = Timestamps & {
  id: string;
  companyId: string;
  projectId?: string;
  fileName: string;
  /** Why this file was uploaded (e.g. "Unit configuration", "Payment plan"). */
  purpose: string;
  category: AttachmentCategory;
  /** Optional module / workflow context. */
  context?: string;
  recordCount?: number;
  uploadedBy: string;
  uploadedAt: string;
};

export type CompanyNote = Timestamps & {
  id: string;
  companyId: string;
  projectId?: string;
  body: string;
  author: string;
  pinned?: boolean;
};

export const ATTACHMENT_CATEGORY_LABEL: Record<AttachmentCategory, string> = {
  unit: "Unit configuration",
  customer: "Customer data",
  booking: "Booking data",
  payment: "Payment data",
  "post-sales-step": "Post Sales step",
  "document-template": "Document template",
  attendance: "Attendance",
  other: "Other",
};
