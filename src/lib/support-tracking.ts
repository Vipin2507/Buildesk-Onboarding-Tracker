import type { Ticket, TicketPriority, TicketStatus } from "@/types";
import { isTicketOpen, isTicketResolved } from "@/lib/tickets";

/** KPI / URL filter for Support Desk list. */
export type SupportKpiFilter = "all" | "open" | "in-progress" | "critical" | "resolved";

export const SUPPORT_KPI_FILTERS: SupportKpiFilter[] = [
  "all",
  "open",
  "in-progress",
  "critical",
  "resolved",
];

const IN_PROGRESS_STATUSES = new Set<TicketStatus>([
  "In Progress",
  "Assigned",
  "QA",
  "Ready for Release",
  "Pending",
  "New",
]);

export function parseSupportKpiFilter(value: unknown): SupportKpiFilter {
  if (typeof value === "string" && SUPPORT_KPI_FILTERS.includes(value as SupportKpiFilter)) {
    return value as SupportKpiFilter;
  }
  return "all";
}

export function matchesSupportKpiFilter(
  ticket: Pick<Ticket, "status" | "priority" | "resolutionStatus" | "resolutionAt">,
  filter: SupportKpiFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "open") return isTicketOpen(ticket);
  if (filter === "resolved") return isTicketResolved(ticket);
  if (filter === "critical") return isTicketOpen(ticket) && ticket.priority === "Critical";
  if (filter === "in-progress") {
    return isTicketOpen(ticket) && IN_PROGRESS_STATUSES.has(ticket.status);
  }
  return true;
}

export function supportKpiFilterLabel(filter: SupportKpiFilter): string {
  switch (filter) {
    case "all":
      return "All tickets";
    case "open":
      return "Open tickets";
    case "in-progress":
      return "In progress";
    case "critical":
      return "Critical open";
    case "resolved":
      return "Resolved / closed";
    default:
      return "Tickets";
  }
}

export const SUPPORT_PRIORITIES: TicketPriority[] = ["Critical", "High", "Medium", "Low"];

export const SUPPORT_TYPES = [
  "Bug",
  "Feature Request",
  "Customization",
  "Enhancement",
  "Requirement",
  "Other",
] as const;
