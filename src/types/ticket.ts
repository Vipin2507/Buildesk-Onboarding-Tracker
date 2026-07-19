import type { Timestamps } from "./common";

export type TicketType =
  | "Bug"
  | "Feature Request"
  | "Customization"
  | "Enhancement"
  | "Requirement"
  | "Other";
export type TicketPriority = "Critical" | "High" | "Medium" | "Low";
export type TicketStatus =
  | "Open"
  | "Pending"
  | "Resolved"
  | "New"
  | "Assigned"
  | "In Progress"
  | "QA"
  | "Ready for Release"
  | "Released"
  | "Closed";

export type Ticket = Timestamps & {
  id: string;
  type: TicketType;
  title: string;
  priority: TicketPriority;
  status: TicketStatus;
  raisedOn: string;
  eta: string;
  developerId: string;
  companyId: string;
  projectId: string;
  description: string;
  /** Internal owner responsible for the ticket. */
  assignedUserId?: string;
  actionTaken?: string;
  backendAssigned: boolean;
  backendAssigneeId?: string;
  backendForwardedAt?: string;
  resolutionStatus: "Resolved" | "Not Resolved";
  resolutionAt?: string;
  /** Timestamp of the latest ETA revision. */
  etaRevisedAt?: string;
  resolutionNotes?: string;
};

export type TicketActivity = {
  id: string;
  ticketId: string;
  eventType: string;
  actorUserId?: string;
  actorName: string;
  remark?: string;
  oldValuesJson?: string;
  newValuesJson?: string;
  createdAt: string;
};
