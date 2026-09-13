export const DPR_STATUSES = ["Pending", "In Progress", "Completed"] as const;
export type DprStatus = (typeof DPR_STATUSES)[number];

export const DPR_PRIORITIES = ["High", "Medium", "Low"] as const;
export type DprPriority = (typeof DPR_PRIORITIES)[number];

export type DprEntry = {
  id: string;
  executiveId: string;
  executiveName?: string;
  entryDate: string;
  category: string;
  subcategory: string;
  clientId: string | null;
  clientNameFreeText: string | null;
  clientDisplayName?: string;
  taskName: string;
  taskDescription: string | null;
  assignedTo: string | null;
  assignedToName?: string | null;
  status: DprStatus;
  priority: DprPriority;
  startTime: string;
  endTime: string | null;
  remarks: string | null;
  pendingReason: string | null;
  nextFollowUpDate: string | null;
  completionDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DprTemplateStep = {
  id: string;
  templateId: string;
  stepOrder: number;
  stepName: string;
};

export type DprTaskTemplate = {
  id: string;
  category: string;
  subcategory: string;
  templateName: string;
  description: string | null;
  steps: DprTemplateStep[];
};

export type DprSummary = {
  totalEntries: number;
  completedCount: number;
  pendingCount: number;
  inProgressCount: number;
  overdueFollowUpCount: number;
  completionRatePercent: number;
  highPriorityOpenCount?: number;
  loggedTodayCount?: number;
};

export type DprComplianceRow = {
  executiveId: string;
  name: string;
  role: string;
  hasSubmitted: boolean;
  entryCount: number;
};

export type DprDaySubmission = {
  executiveId: string;
  entryDate: string;
  submittedAt: string;
};
