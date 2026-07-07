import type { Timestamps } from "./common";

export type TrainingStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";

export type TrainingSession = Timestamps & {
  id: string;
  type: string;
  trainerId: string;
  companyId?: string;
  projectId?: string;
  date: string;
  attendance: string;
  recording: string;
  status: TrainingStatus;
};
