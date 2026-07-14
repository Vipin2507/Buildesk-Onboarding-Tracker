import type { StatusKey, Timestamps } from "./common";

export const PROJECT_OTHER_CHARGE_OPTIONS = [
  { key: "parking", label: "Parking" },
  { key: "floorRise", label: "Floor Rise" },
  { key: "clubHouse", label: "Club House" },
  { key: "legalCharges", label: "Legal Charges" },
  { key: "maintenance", label: "Maintenance" },
  { key: "plc", label: "PLC" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "corpusFund", label: "Corpus Fund" },
] as const;

export type ProjectOtherChargeKey = (typeof PROJECT_OTHER_CHARGE_OPTIONS)[number]["key"];

export const PROJECT_TYPES = [
  "Residential",
  "Commercial",
  "Mixed Use",
  "Plots",
  "Villa",
  "Affordable Housing",
] as const;

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
  /** When project onboarding / delivery started */
  startDate?: string;
  goLiveAt?: string;
  /** Project-level POC (independent of company POC). */
  pocName?: string;
  pocMobile?: string;
  /** Extended project information */
  address?: string;
  state?: string;
  pinCode?: string;
  totalTowers?: number;
  totalFloors?: number;
  agreementValue?: number;
  otherCharges?: ProjectOtherChargeKey[];
  customCharges?: string[];
  logoUrl?: string;
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
  { key: "projectSetup", label: "Project Setup", group: "Setup & Data", description: "Project record created and basic config confirmed." },
  { key: "existingDataUpload", label: "Existing Data Upload", group: "Setup & Data", description: "Legacy unit/customer data uploaded." },
  { key: "paymentUpload", label: "Payment Upload", group: "Setup & Data", description: "Historical payments imported." },
  { key: "dueMatching", label: "Due Matching", group: "Setup & Data", description: "Dues matched against ledger." },
  { key: "demandFormat", label: "Demand Format", group: "Document Formats", description: "Demand letter template configured." },
  { key: "receiptFormat", label: "Receipt Format", group: "Document Formats", description: "Receipt template configured." },
  { key: "agreementFormat", label: "Agreement Format", group: "Document Formats", description: "Agreement template configured." },
  { key: "allotmentLetterFormat", label: "Allotment Letter Format", group: "Document Formats", description: "Allotment letter template configured." },
  { key: "welcomeLetterFormat", label: "Welcome Letter Format", group: "Document Formats", description: "Welcome letter template configured." },
  { key: "customerApplication", label: "Customer Application", group: "Customer App", description: "Customer app provisioning started." },
  { key: "whiteLabelOrBuildesk", label: "White Label / Buildesk", group: "Customer App", description: "App mode (white-label or Buildesk) selected." },
  { key: "androidAppPublished", label: "Android App Published", group: "Customer App", description: "Android build published to store." },
  { key: "iosAppPublished", label: "iOS App Published", group: "Customer App", description: "iOS build published to App Store." },
  { key: "credentialsShared", label: "Credentials Shared", group: "Customer App", description: "Admin credentials shared with client." },
  { key: "appIntegrationRequired", label: "App Integration Required", group: "Integrations", description: "Decide whether the customer app needs backend integrations." },
  { key: "crmIntegration", label: "CRM Integration", group: "Integrations", description: "CRM sync connected and verified." },
  { key: "whatsappIntegration", label: "WhatsApp Integration", group: "Integrations", description: "WhatsApp / WATI channel live." },
  { key: "smsIntegration", label: "SMS Integration", group: "Integrations", description: "SMS gateway connected for triggers." },
  { key: "paymentsIntegration", label: "Payments Integration", group: "Integrations", description: "Payment gateway connected and tested." },
  { key: "integrationConnected", label: "All Required Integrations Connected", group: "Integrations", description: "Every required channel marked connected and live." },
  { key: "procurementManagement", label: "Procurement Management", group: "Procurement", description: "Vendor module enabled for the project." },
  { key: "materialDataUpdated", label: "Material Data Updated", group: "Procurement", description: "Material master loaded." },
  { key: "supplierDataUpdated", label: "Supplier Data Updated", group: "Procurement", description: "Supplier master loaded." },
  { key: "contractorDataUpdated", label: "Contractor Data Updated", group: "Procurement", description: "Contractor master loaded." },
  { key: "poFormat", label: "PO Format", group: "Procurement", description: "Purchase order format configured." },
  { key: "woFormat", label: "WO Format", group: "Procurement", description: "Work order format configured." },
  { key: "boqFormed", label: "BOQ Formed", group: "Procurement", description: "Bill of quantities prepared." },
  { key: "laborRosterSetup", label: "Labor Roster Setup", group: "Labor", description: "Workforce roster created." },
  { key: "attendanceConfigured", label: "Attendance Configured", group: "Labor", description: "Attendance upload / punch flow ready." },
  { key: "payrollReadiness", label: "Payroll Readiness", group: "Labor", description: "Payroll export mapping confirmed." },
  { key: "clientSignOff", label: "Client Sign-Off", group: "Close-out", description: "Client signed off onboarding." },
] as const;

export type ProjectProgressMilestoneKey = (typeof PROJECT_PROGRESS_MILESTONES)[number]["key"];

export type ProjectManualProgress = Timestamps & {
  projectId: string;
  /** Optional overrides when contact differs from company record. */
  contactPerson?: string;
  contactNumber?: string;
  checks: Partial<Record<ProjectProgressMilestoneKey, boolean>>;
  /** Milestones skipped for this project (count as complete). */
  notApplicable: Partial<Record<ProjectProgressMilestoneKey, boolean>>;
  remarks: string;
};
