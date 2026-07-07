import type { Timestamps } from "./common";

export type Labor = Timestamps & {
  id: string;
  name: string;
  role: string;
  phone: string;
  projectId?: string;
};

export type AttendanceRecord = Timestamps & {
  id: string;
  fileName: string;
  uploadedAt: string;
  recordCount: number;
  projectId?: string;
};
