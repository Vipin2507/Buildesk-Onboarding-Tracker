import { z } from "zod";

import type { DesignTicketStatus } from "@/types/design-ticket";

/** KPI / URL filter for Ticket Tracking list. */
export type TicketKpiFilter = "all" | "pending" | DesignTicketStatus;

export const TICKET_KPI_FILTERS: TicketKpiFilter[] = [
  "all",
  "pending",
  "open",
  "in-progress",
  "resolved",
  "closed",
];

export const ticketsSearchSchema = z.object({
  filter: z.enum(TICKET_KPI_FILTERS as [TicketKpiFilter, ...TicketKpiFilter[]]).optional(),
});

export type TicketsSearch = z.infer<typeof ticketsSearchSchema>;

export function parseTicketKpiFilter(value: unknown): TicketKpiFilter {
  if (typeof value === "string" && TICKET_KPI_FILTERS.includes(value as TicketKpiFilter)) {
    return value as TicketKpiFilter;
  }
  return "all";
}

export function matchesTicketKpiFilter(status: DesignTicketStatus, filter: TicketKpiFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return status === "open" || status === "in-progress";
  return status === filter;
}

export function ticketKpiFilterLabel(filter: TicketKpiFilter): string {
  switch (filter) {
    case "all":
      return "All tickets";
    case "pending":
      return "Pending tickets";
    case "open":
      return "Open tickets";
    case "in-progress":
      return "In progress";
    case "resolved":
      return "Resolved tickets";
    case "closed":
      return "Closed tickets";
    default:
      return "Tickets";
  }
}
