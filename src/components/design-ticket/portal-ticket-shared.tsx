import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { DesignTicketSection, TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { usePortalContentScope } from "@/components/portal-content-context";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
  type DesignTicket,
  type DesignTicketPriority,
  type DesignTicketStatus,
} from "@/types/design-ticket";

export type PortalTicketFilter = "all" | "pending" | "open" | "in-progress";

export const PORTAL_TICKET_FILTERS: PortalTicketFilter[] = [
  "all",
  "pending",
  "open",
  "in-progress",
];

export function parsePortalTicketFilter(value: unknown): PortalTicketFilter {
  if (typeof value === "string" && PORTAL_TICKET_FILTERS.includes(value as PortalTicketFilter)) {
    return value as PortalTicketFilter;
  }
  return "all";
}

export function matchesPortalTicketFilter(
  status: DesignTicket["status"],
  filter: PortalTicketFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return status === "open" || status === "in-progress";
  return status === filter;
}

export function portalTicketFilterLabel(filter: PortalTicketFilter): string {
  switch (filter) {
    case "all":
      return "All active tickets";
    case "pending":
      return "Pending tickets";
    case "open":
      return "Open tickets";
    case "in-progress":
      return "In progress";
    default:
      return "Tickets";
  }
}

export function PortalTicketStatusBadge({ status }: { status: DesignTicketStatus }) {
  return (
    <span className="portal-status-badge" data-status={status}>
      {DESIGN_TICKET_STATUS_LABEL[status]}
    </span>
  );
}

export function PortalTicketPriorityBadge({ priority }: { priority: DesignTicketPriority }) {
  return (
    <span className="portal-priority-badge" data-priority={priority}>
      {DESIGN_TICKET_PRIORITY_LABEL[priority]}
    </span>
  );
}

export function PortalTicketListSkeleton() {
  return (
    <div className="card-soft space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function PortalTicketTableCard({
  title,
  action,
  children,
  delay = 0,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const inPortalContent = usePortalContentScope();

  if (inPortalContent) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay, ease: TICKET_EASE }}
        className={cn("portal-content-section", className)}
      >
        <div className="portal-content-card">
          {title || action ? (
            <div className="portal-content-card-header">
              {title ? <h2 className="portal-content-card-title">{title}</h2> : <span />}
              {action}
            </div>
          ) : null}
          <div className="portal-content-card-body">{children}</div>
        </div>
      </motion.section>
    );
  }

  return (
    <DesignTicketSection title={title} action={action} delay={delay} className={className}>
      <div className="card-soft overflow-hidden p-1">{children}</div>
    </DesignTicketSection>
  );
}

const activeColumns = [
  {
    key: "ticketNumber",
    header: "Ticket ID",
    render: (r: DesignTicket) => <span className="portal-ticket-id">{r.ticketNumber}</span>,
    sortable: true,
  },
  {
    key: "subject",
    header: "Subject",
    render: (r: DesignTicket) => r.subject,
    sortable: true,
  },
  {
    key: "status",
    header: "Status",
    render: (r: DesignTicket) => <PortalTicketStatusBadge status={r.status} />,
  },
  {
    key: "priority",
    header: "Priority",
    render: (r: DesignTicket) => <PortalTicketPriorityBadge priority={r.priority} />,
  },
  {
    key: "updatedAt",
    header: "Last updated",
    render: (r: DesignTicket) => formatDate(r.updatedAt),
    sortable: true,
  },
];

const solvedColumns = [
  {
    key: "ticketNumber",
    header: "Ticket ID",
    render: (r: DesignTicket) => <span className="portal-ticket-id">{r.ticketNumber}</span>,
    sortable: true,
  },
  { key: "subject", header: "Subject", render: (r: DesignTicket) => r.subject, sortable: true },
  {
    key: "resolvedAt",
    header: "Resolved",
    render: (r: DesignTicket) => formatDate(r.resolvedAt ?? r.updatedAt),
    sortable: true,
  },
  {
    key: "status",
    header: "Status",
    render: (r: DesignTicket) => <PortalTicketStatusBadge status={r.status} />,
  },
];

export function PortalActiveTicketsTable({
  rows,
  slug,
  onRowClick,
  pageSize = 12,
}: {
  rows: DesignTicket[];
  slug: string;
  onRowClick: (ticket: DesignTicket) => void;
  pageSize?: number;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No tickets found"
        description="Try a different filter or create a new request for our team."
        actionLabel="Create New Ticket"
        href={`/portal/${slug}/create-ticket`}
      />
    );
  }

  return (
    <div className="portal-data-table">
      <DataTable
        data={rows}
        getRowId={(r) => r.id}
        searchKeys={["ticketNumber", "subject", "category"]}
        pageSize={pageSize}
        density="compact"
        onRowClick={onRowClick}
        columns={activeColumns}
      />
    </div>
  );
}

export function PortalSolvedTicketsTable({
  rows,
  slug,
  onRowClick,
  pageSize = 12,
}: {
  rows: DesignTicket[];
  slug: string;
  onRowClick: (ticket: DesignTicket) => void;
  pageSize?: number;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No solved tickets yet"
        description="Resolved and closed tickets will appear here once our team completes your requests."
      />
    );
  }

  return (
    <div className="portal-data-table">
      <DataTable
        data={rows}
        getRowId={(r) => r.id}
        searchKeys={["ticketNumber", "subject"]}
        pageSize={pageSize}
        density="compact"
        onRowClick={onRowClick}
        columns={solvedColumns}
      />
    </div>
  );
}

export function PortalTicketMetaAside({ ticket }: { ticket: DesignTicket }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06, ease: TICKET_EASE }}
      className="card-soft grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-1"
    >
      <MetaItem label="Category" value={ticket.category ?? "—"} />
      <MetaItem label="Created" value={formatDate(ticket.createdAt)} />
      <MetaItem label="Last updated" value={formatDate(ticket.updatedAt)} />
      {ticket.resolvedAt ? (
        <MetaItem label="Resolved" value={formatDate(ticket.resolvedAt)} />
      ) : null}
    </motion.aside>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
