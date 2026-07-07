import type { Timestamps } from "./common";

export type Material = Timestamps & { id: string; name: string; category: string; unit: string };
export type Supplier = Timestamps & { id: string; name: string; contact: string; phone: string };
export type Contractor = Timestamps & { id: string; name: string; contact: string; phone: string };

export type POStatus = "Pending" | "Approved" | "Delivered" | "Cancelled";
export type WOStatus = "Pending" | "Approved" | "In Progress" | "Completed" | "Cancelled";
export type BOQStatus = "Draft" | "Submitted" | "Approved";

export type PurchaseOrder = Timestamps & {
  id: string;
  number: string;
  supplierId: string;
  projectId?: string;
  date: string;
  status: POStatus;
  amount: number;
};

export type WorkOrder = Timestamps & {
  id: string;
  number: string;
  contractorId: string;
  projectId?: string;
  date: string;
  status: WOStatus;
  amount: number;
};

export type BOQ = Timestamps & {
  id: string;
  name: string;
  projectId: string;
  status: BOQStatus;
};

export type ApprovalFlow = Timestamps & {
  id: string;
  name: string;
  stages: string[];
};
