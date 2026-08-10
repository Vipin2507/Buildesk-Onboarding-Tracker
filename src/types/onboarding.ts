import type { Timestamps } from "./common";

export type ChecklistPhase = "collected" | "uploaded" | "live";

/** Minimal shape for sequential Collected → Uploaded → Live toggles. */
export type ChecklistPhaseState = {
  collected: boolean;
  uploaded: boolean;
  live: boolean;
  collectedAt?: string;
  uploadedAt?: string;
  liveAt?: string;
  notApplicable: boolean;
};

export type OnboardingChecklistItem = Timestamps &
  ChecklistPhaseState & {
  id: string;
  projectId: string;
  section: string;
  label: string;
  remarks: string;
  /** Explicit owner; dashboard falls back to the company's onboarding manager. */
  assigneeUserId?: string;
  /** Optional target date used for upcoming/overdue work. */
  dueDate?: string;
  /**
   * `default` = standard onboarding template item.
   * `required-document` = customer-required doc added from Documents tab.
   */
  source?: "default" | "required-document";
};

export type UploadType = "unit" | "customer" | "booking" | "payment";

export type UnitUpload = Timestamps & {
  id: string;
  projectId: string;
  type: UploadType;
  fileName: string;
  recordCount: number;
  uploadedAt: string;
};

export type CustomerRecord = Timestamps & {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  phone: string;
};

export type PaymentRecord = Timestamps & {
  id: string;
  projectId: string;
  customerName: string;
  amount: number;
  status: "pending" | "received" | "overdue";
};
