import type { Ticket, TicketActivity, TicketPriority, TicketStatus, TicketType } from "@/types";

const CLOSED_STATUSES = new Set<TicketStatus>(["Resolved", "Closed", "Released"]);

export function isTicketOpen(ticket: Pick<Ticket, "status" | "resolutionStatus">) {
  if (ticket.resolutionStatus === "Resolved") return false;
  return !CLOSED_STATUSES.has(ticket.status);
}

export function isTicketResolved(ticket: Pick<Ticket, "status" | "resolutionStatus" | "resolutionAt">) {
  return (
    ticket.resolutionStatus === "Resolved" ||
    CLOSED_STATUSES.has(ticket.status) ||
    Boolean(ticket.resolutionAt)
  );
}

/** Normalize raw SQLite / API ticket rows into the domain Ticket shape. */
export function mapTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id ?? ""),
    type: (row.type as TicketType) || "Bug",
    title: String(row.title ?? ""),
    priority: (row.priority as TicketPriority) || "Medium",
    status: (row.status as TicketStatus) || "Open",
    raisedOn: String(row.raisedOn ?? ""),
    eta: String(row.eta ?? ""),
    developerId: String(row.developerId ?? ""),
    companyId: String(row.companyId ?? ""),
    projectId: String(row.projectId ?? ""),
    description: String(row.description ?? ""),
    assignedUserId: (row.assignedUserId as string | null | undefined) || undefined,
    actionTaken: String(row.actionTaken ?? ""),
    backendAssigned: Boolean(row.backendAssigned),
    backendAssigneeId: (row.backendAssigneeId as string | null | undefined) || undefined,
    backendForwardedAt: (row.backendForwardedAt as string | null | undefined) || undefined,
    resolutionStatus:
      (row.resolutionStatus as Ticket["resolutionStatus"] | undefined) ?? "Not Resolved",
    resolutionAt: (row.resolutionAt as string | null | undefined) || undefined,
    etaRevisedAt: (row.etaRevisedAt as string | null | undefined) || undefined,
    resolutionNotes: String(row.resolutionNotes ?? ""),
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  };
}

export function mapTicketActivity(row: Record<string, unknown>): TicketActivity {
  return {
    id: String(row.id ?? ""),
    ticketId: String(row.ticketId ?? ""),
    eventType: String(row.eventType ?? ""),
    actorUserId: (row.actorUserId as string | null | undefined) || undefined,
    actorName: String(row.actorName ?? ""),
    remark: (row.remark as string | null | undefined) || undefined,
    oldValuesJson: (row.oldValuesJson as string | null | undefined) || undefined,
    newValuesJson: (row.newValuesJson as string | null | undefined) || undefined,
    createdAt: String(row.createdAt ?? ""),
  };
}
