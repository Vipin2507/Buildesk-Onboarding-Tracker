import type { Timestamps } from "./common";

export type ChecklistPhase = "collected" | "uploaded" | "live";

export type OnboardingChecklistItem = Timestamps & {
  id: string;
  projectId: string;
  section: string;
  label: string;
  collected: boolean;
  uploaded: boolean;
  live: boolean;
  /** ISO timestamp when Collected was marked (cleared when unchecked). */
  collectedAt?: string;
  /** ISO timestamp when Uploaded was marked. */
  uploadedAt?: string;
  /** ISO timestamp when Live was marked. */
  liveAt?: string;
  /** When true, item is skipped for this project and counts as complete. */
  notApplicable: boolean;
  remarks: string;
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
