import type { Timestamps } from "./common";

export type DocumentStatus = "Draft" | "Approved" | "Uploaded" | "Tested" | "Live";

export type DocumentTemplate = Timestamps & {
  id: string;
  name: string;
  category: string;
  status: DocumentStatus;
  projectId?: string;
  fileName?: string;
};
