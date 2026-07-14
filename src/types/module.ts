import type { Timestamps } from "./common";

export type ModuleKey =
  | "post-sales"
  | "vendor-management"
  | "labor-management"
  | "customer-app"
  | "construction-management"
  | "project-management";

export type CompanyModule = {
  moduleKey: ModuleKey;
  label: string;
  optedIn: boolean;
  optedOnDate?: string;
  /** Module-level Live timestamp when marked live. */
  liveAt?: string;
  /** Optional POC override for this module. */
  pocName?: string;
  pocMobile?: string;
};

export type TemplateStatus = "not-required" | "not-sent" | "sent" | "received";
export type UploadStatus = "not-uploaded" | "uploaded";
export type ApprovalStatus = "not-submitted" | "pending-approval" | "approved" | "rejected";

export type StepStatus =
  | "not_started"
  | "template_sent"
  | "data_uploaded"
  | "pending_approval"
  | "approved"
  | "rejected";

export type PostSalesStep = {
  id: string;
  key: string;
  label: string;
  requiresTemplate: boolean;
  templateStatus: TemplateStatus;
  templateSentOn?: string;
  uploadStatus: UploadStatus;
  uploadedFile?: { name: string; uploadedAt: string; recordCount?: number };
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedOn?: string;
  remarks?: string;
  order: number;
};

export type PostSalesProject = Timestamps & {
  id: string;
  companyId: string;
  projectNumber: string;
  projectName: string;
  steps: PostSalesStep[];
};
