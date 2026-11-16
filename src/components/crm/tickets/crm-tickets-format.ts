import { differenceInCalendarDays, isValid, parseISO } from "date-fns";

import type { DesignTicket, DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";

/** Active tickets open this many calendar days (or more) count as aging. */
export const TICKET_AGING_DAYS = 7;

export type TicketKpiFilter = "all" | "open" | "in-progress" | "resolved" | "aging";

export function parseTicketDate(value: string) {
  const raw = value.trim();
  const d = raw.includes("T") || raw.includes(" ") ? parseISO(raw) : new Date(raw);
  return isValid(d) ? d : null;
}

/** Calendar days from create → end. Closed/resolved tickets freeze at resolvedAt (not today). */
export function daysOpenForTicket(
  ticket: Pick<DesignTicket, "createdAt" | "resolvedAt" | "updatedAt" | "status">,
  now = new Date(),
): number {
  const created = parseTicketDate(ticket.createdAt);
  if (!created) return 0;
  const closed =
    ticket.status === "resolved" || ticket.status === "closed"
      ? (parseTicketDate(ticket.resolvedAt ?? ticket.updatedAt) ?? now)
      : now;
  return Math.max(0, differenceInCalendarDays(closed, created));
}

export function formatDaysOpen(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function isTicketAging(
  ticket: Pick<DesignTicket, "status" | "createdAt" | "resolvedAt" | "updatedAt">,
  daysOpen?: number,
) {
  if (!isDesignTicketActive(ticket.status)) return false;
  const days = daysOpen ?? daysOpenForTicket(ticket);
  return days >= TICKET_AGING_DAYS;
}

export function matchesTicketKpi(
  ticket: {
    status: DesignTicketStatus;
    priority: DesignTicketPriority;
    daysOpen: number;
  },
  kpiFilter: TicketKpiFilter,
) {
  if (kpiFilter === "open") return ticket.status === "open";
  if (kpiFilter === "in-progress") return ticket.status === "in-progress";
  if (kpiFilter === "resolved") return ticket.status === "resolved" || ticket.status === "closed";
  if (kpiFilter === "aging") return isDesignTicketActive(ticket.status) && ticket.daysOpen >= TICKET_AGING_DAYS;
  return true;
}

export function ticketCategoryLabel(category?: string | null) {
  const value = category?.trim();
  return value || "Uncategorized";
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; chart: string }> = {
  Bug: {
    bg: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
    chart: "#f43f5e",
  },
  "Feature Request": {
    bg: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
    chart: "#8b5cf6",
  },
  "Dashboard Issue": {
    bg: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    text: "text-amber-800 dark:text-amber-300",
    chart: "#f59e0b",
  },
  Design: {
    bg: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    chart: "#0ea5e9",
  },
  Development: {
    bg: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    text: "text-indigo-700 dark:text-indigo-300",
    chart: "#6366f1",
  },
  "Banner Design": {
    bg: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    text: "text-teal-700 dark:text-teal-300",
    chart: "#14b8a6",
  },
  Other: {
    bg: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    text: "text-slate-700 dark:text-slate-300",
    chart: "#64748b",
  },
  Uncategorized: {
    bg: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    chart: "#94a3b8",
  },
};

const FALLBACK_CHART = ["#009bff", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7"];

export function ticketCategoryStyle(category?: string | null) {
  const label = ticketCategoryLabel(category);
  return CATEGORY_STYLES[label] ?? {
    bg: "bg-primary/10 text-primary",
    text: "text-primary",
    chart: FALLBACK_CHART[Math.abs(hashString(label)) % FALLBACK_CHART.length],
  };
}

export function priorityDotClass(priority: DesignTicketPriority) {
  if (priority === "high") return "bg-rose-500";
  if (priority === "medium") return "bg-amber-500";
  return "bg-emerald-500";
}

export function statusPillClass(status: DesignTicketStatus) {
  if (status === "open") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  if (status === "in-progress") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  }
  if (status === "resolved") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function personInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
