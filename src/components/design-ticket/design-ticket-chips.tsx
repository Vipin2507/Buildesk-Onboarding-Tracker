import { Pill } from "@/components/status-pill";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";

export function DesignTicketStatusPill({ status }: { status: DesignTicketStatus }) {
  const tone =
    status === "open"
      ? "info"
      : status === "in-progress"
        ? "warning"
        : status === "resolved"
          ? "success"
          : "muted";
  return <Pill tone={tone}>{DESIGN_TICKET_STATUS_LABEL[status]}</Pill>;
}

export function DesignTicketPriorityChip({ priority }: { priority: DesignTicketPriority }) {
  const tone =
    priority === "high" ? "danger" : priority === "medium" ? "warning" : "success";
  return <Pill tone={tone}>{DESIGN_TICKET_PRIORITY_LABEL[priority]}</Pill>;
}

export const DESIGN_TICKET_STATUSES: DesignTicketStatus[] = [
  "open",
  "in-progress",
  "resolved",
  "closed",
];

export const DESIGN_TICKET_PRIORITIES: DesignTicketPriority[] = ["low", "medium", "high"];
