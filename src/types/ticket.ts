import type { Timestamps } from "./common";

export type TicketType = "Bug" | "Customization" | "Requirement";
export type TicketPriority = "Critical" | "High" | "Medium" | "Low";
export type TicketStatus =
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
};
