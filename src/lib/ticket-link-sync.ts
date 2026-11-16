import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import type { TicketPriority, TicketStatus, TicketType } from "@/types/ticket";

/** Prevents DT ↔ TKT status sync from looping. */
let linkSyncDepth = 0;

export function withTicketLinkSyncGuard(fn: () => void) {
  if (linkSyncDepth > 0) return;
  linkSyncDepth += 1;
  try {
    fn();
  } finally {
    linkSyncDepth -= 1;
  }
}

export function isTicketLinkSyncing() {
  return linkSyncDepth > 0;
}

const DESIGN_TO_SUPPORT_STATUS: Record<DesignTicketStatus, TicketStatus> = {
  open: "Open",
  "in-progress": "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export function designStatusToSupportStatus(status: DesignTicketStatus): TicketStatus {
  return DESIGN_TO_SUPPORT_STATUS[status] ?? "Open";
}

/** Map Support Desk stage back to Design Ticket Tracking status. */
export function supportStatusToDesignStatus(status: TicketStatus): DesignTicketStatus {
  if (status === "Open" || status === "New") return "open";
  if (status === "Resolved") return "resolved";
  if (status === "Closed" || status === "Released") return "closed";
  // Pending, Assigned, In Progress, QA, Ready for Release → in progress
  return "in-progress";
}

export function designPriorityToSupportPriority(priority: DesignTicketPriority): TicketPriority {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

const TICKET_TYPES = new Set<TicketType>([
  "Bug",
  "Feature Request",
  "Customization",
  "Enhancement",
  "Requirement",
  "Other",
]);

export function designCategoryToSupportType(category?: string | null): TicketType {
  const value = category?.trim();
  if (value && TICKET_TYPES.has(value as TicketType)) return value as TicketType;
  if (value === "Dashboard Issue" || value === "Development") return "Bug";
  if (value === "Design" || value === "Banner Design") return "Customization";
  return "Other";
}
