import type { Timestamps } from "./common";

/** Design Desk / client portal ticket lifecycle (distinct from Support Desk TKT tickets). */
export type DesignTicketStatus = "open" | "in-progress" | "resolved" | "closed";
export type DesignTicketPriority = "low" | "medium" | "high";

export type DesignTicketMessageKind = "message" | "system";

export type DesignTicketAttachment = {
  name: string;
  url?: string;
};

export type DesignTicketMessage = {
  id: string;
  ticketId: string;
  kind: DesignTicketMessageKind;
  authorType: "client" | "team" | "system";
  authorName: string;
  message: string;
  attachments?: DesignTicketAttachment[];
  createdAt: string;
};

export type DesignTicket = Timestamps & {
  id: string;
  ticketNumber: string;
  companyId: string;
  subject: string;
  description: string;
  category?: string;
  priority: DesignTicketPriority;
  status: DesignTicketStatus;
  assigneeId?: string;
  createdBy: { type: "client" | "team"; name: string };
  resolvedAt?: string;
  messages: DesignTicketMessage[];
};

export type CompanyPortalAccess = Timestamps & {
  companyId: string;
  companyName: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  isActive: boolean;
};

export const DESIGN_TICKET_CATEGORIES = [
  "Banner Design",
  "Dashboard Issue",
  "Design",
  "Development",
  "Bug",
  "Feature Request",
  "Other",
] as const;

export const DESIGN_TICKET_STATUS_LABEL: Record<DesignTicketStatus, string> = {
  open: "Open",
  "in-progress": "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const DESIGN_TICKET_PRIORITY_LABEL: Record<DesignTicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
