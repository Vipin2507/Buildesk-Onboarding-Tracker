import type { StatusKey, Timestamps } from "./common";

export type Project = Timestamps & {
  id: string;
  name: string;
  companyId: string;
  type: string;
  units: number;
  city: string;
  rera: string;
  status: StatusKey;
  currentStep: number;
  goLiveAt?: string;
};

export type CustomerAppConfig = Timestamps & {
  projectId: string;
  mode: "buildesk" | "whitelabel";
  appName: string;
  primaryColor: string;
  logoUrl: string;
  supportEmail: string;
  supportPhone: string;
  publishStatus: "draft" | "review" | "published";
};

/** Manual onboarding progress milestones (checkable columns). */
export const PROJECT_PROGRESS_MILESTONES = [
  { key: "projectSetup", label: "Project Setup", group: "Setup & Data" },
  { key: "existingDataUpload", label: "Existing Data Upload", group: "Setup & Data" },
  { key: "paymentUpload", label: "Payment Upload", group: "Setup & Data" },
  { key: "dueMatching", label: "Due Matching", group: "Setup & Data" },
  { key: "demandFormat", label: "Demand Format", group: "Document Formats" },
  { key: "receiptFormat", label: "Receipt Format", group: "Document Formats" },
  { key: "agreementFormat", label: "Agreement Format", group: "Document Formats" },
  { key: "allotmentLetterFormat", label: "Allotment Letter Format", group: "Document Formats" },
  { key: "welcomeLetterFormat", label: "Welcome Letter Format", group: "Document Formats" },
  { key: "customerApplication", label: "Customer Application", group: "Customer App" },
  { key: "whiteLabelOrBuildesk", label: "White Label / Buildesk", group: "Customer App" },
  { key: "androidAppPublished", label: "Android App Published", group: "Customer App" },
  { key: "iosAppPublished", label: "iOS App Published", group: "Customer App" },
  { key: "credentialsShared", label: "Credentials Shared", group: "Customer App" },
  { key: "appIntegrationRequired", label: "App Integration Required", group: "Integrations" },
  { key: "integrationConnected", label: "Integration Connected", group: "Integrations" },
  { key: "procurementManagement", label: "Procurement Management", group: "Procurement" },
  { key: "materialDataUpdated", label: "Material Data Updated", group: "Procurement" },
  { key: "supplierDataUpdated", label: "Supplier Data Updated", group: "Procurement" },
  { key: "contractorDataUpdated", label: "Contractor Data Updated", group: "Procurement" },
  { key: "poFormat", label: "PO Format", group: "Procurement" },
  { key: "woFormat", label: "WO Format", group: "Procurement" },
  { key: "boqFormed", label: "BOQ Formed", group: "Procurement" },
  { key: "clientSignOff", label: "Client Sign-Off", group: "Close-out" },
] as const;

export type ProjectProgressMilestoneKey = (typeof PROJECT_PROGRESS_MILESTONES)[number]["key"];

export type ProjectManualProgress = Timestamps & {
  projectId: string;
  /** Optional overrides when contact differs from company record. */
  contactPerson?: string;
  contactNumber?: string;
  checks: Partial<Record<ProjectProgressMilestoneKey, boolean>>;
  remarks: string;
};
