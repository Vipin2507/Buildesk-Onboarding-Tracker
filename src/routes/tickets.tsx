import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketInfoBanner,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  InternalTicketsNav,
  TICKET_EASE,
  ticketSelectClass,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { inDateRange } from "@/components/list-toolbar";
import { formatDate } from "@/lib/utils";
import {
  useCompanyPortalStore,
  useCompanyStore,
  useCurrentUser,
  useDesignTicketStats,
  useDesignTicketHighlights,
  useEmployeeStore,
  useUserStore,
} from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";

export const Route = createFileRoute("/tickets")({
  component: TicketsLayout,
});

function TicketsLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <TicketsDashboard />;
}

function TicketsDashboard() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const tickets = useDesignTicketStore((s) => s.tickets);
  const deleteTicket = useDesignTicketStore((s) => s.deleteTicket);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const assignTicket = useDesignTicketStore((s) => s.assignTicket);
  const stats = useDesignTicketStats();
  const highlights = useDesignTicketHighlights();
  const companies = useCompanyStore((s) => s.companies);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const portalAccess = useCompanyPortalStore((s) => s.access);

  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | DesignTicketStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | DesignTicketPriority>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [applied, setApplied] = useState({
    company: "all",
    status: "all" as "all" | DesignTicketStatus,
    priority: "all" as "all" | DesignTicketPriority,
    dateFrom: "",
    dateTo: "",
  });

  const actorName = currentUser?.name ?? "Team";

  const enriched = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        companyName: companies.find((c) => c.id === t.companyId)?.name ?? "—",
        assigneeName:
          users.find((u) => u.id === t.assigneeId)?.name ??
          employees.find((e) => e.id === t.assigneeId)?.name ??
          "Unassigned",
        isNew: highlights.includes(t.id),
      })),
    [tickets, companies, users, employees, highlights],
  );

  const filtered = useMemo(() => {
    return enriched.filter((t) => {
      if (applied.company !== "all" && t.companyId !== applied.company) return false;
      if (applied.status !== "all" && t.status !== applied.status) return false;
      if (applied.priority !== "all" && t.priority !== applied.priority) return false;
      if (!inDateRange(t.createdAt, applied.dateFrom, applied.dateTo)) return false;
      return true;
    });
  }, [enriched, applied]);

  const kpiCards = [
    { label: "Total Tickets", value: stats.total },
    { label: "Open", value: stats.open, tone: "text-info" },
    { label: "In Progress", value: stats.inProgress, tone: "text-warning-foreground" },
    { label: "Resolved", value: stats.resolved, tone: "text-success" },
    { label: "Closed", value: stats.closed, tone: "text-muted-foreground" },
  ];

  function applyFilters() {
    setApplied({
      company: companyFilter,
      status: statusFilter,
      priority: priorityFilter,
      dateFrom,
      dateTo,
    });
  }

  return (
    <PageWrap>
      <DesignTicketPageHeader
        title="Ticket Tracking"
        subtitle="Design & client support desk — triage tickets across all companies."
        actions={
          <Button variant="outline" className="gap-1.5" asChild>
            <Link to="/tickets/links">
              <Link2 className="h-4 w-4" />
              Portal Links
            </Link>
          </Button>
        }
      />

      <InternalTicketsNav />

      <div className="mb-6">
        <DesignTicketKpiGrid items={kpiCards} columns={5} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: TICKET_EASE }}
        className="card-soft mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <label className="space-y-1.5 text-xs font-medium">
          Company
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className={ticketSelectClass}>
            <option value="all">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className={ticketSelectClass}
          >
            <option value="all">All</option>
            {DESIGN_TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Priority
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            className={ticketSelectClass}
          >
            <option value="all">All</option>
            {DESIGN_TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Created from
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10" />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Created to
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10" />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-5">
          <Button type="button" className="w-full sm:w-auto" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
      </motion.div>

      <DesignTicketSection title="Recent Tickets" delay={0.12}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            description="When a client submits a ticket from their portal, it will appear here instantly."
          />
        ) : (
          <DataTable
          data={filtered}
          getRowId={(r) => r.id}
          hideSearch
          pageSize={12}
          onRowClick={(row) => void navigate({ to: "/tickets/$ticketId", params: { ticketId: row.id } })}
          columns={[
            {
              key: "ticketNumber",
              header: "Ticket ID",
              render: (r) => (
                <span className="inline-flex items-center gap-2">
                  {r.ticketNumber}
                  {r.isNew ? (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      New
                    </span>
                  ) : null}
                </span>
              ),
              sortable: true,
            },
            { key: "subject", header: "Subject", render: (r) => r.subject, sortable: true },
            { key: "companyName", header: "Company", render: (r) => r.companyName, sortable: true },
            {
              key: "priority",
              header: "Priority",
              render: (r) => <DesignTicketPriorityChip priority={r.priority} />,
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <DesignTicketStatusPill status={r.status} />,
            },
            { key: "assigneeName", header: "Assignee", render: (r) => r.assigneeName },
            { key: "createdAt", header: "Created", render: (r) => formatDate(r.createdAt), sortable: true },
            { key: "updatedAt", header: "Updated", render: (r) => formatDate(r.updatedAt), sortable: true },
          ]}
          actions={(row) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = users[0]?.id;
                    if (next) {
                      assignTicket(row.id, next, users[0]!.name, actorName);
                      toast.success("Assignee updated");
                    }
                  }}
                >
                  Quick assign to me / first user
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    updateStatus(row.id, "in-progress", actorName);
                    toast.success("Status → In Progress");
                  }}
                >
                  Mark In Progress
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTicket(row.id);
                    toast.success("Ticket deleted");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
        )}
      </DesignTicketSection>

      <div className="mt-6 space-y-4">
        <DesignTicketInfoBanner>
          Team replies, updates and status changes are visible to the client in real time.
        </DesignTicketInfoBanner>

        {portalAccess.length > 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            {portalAccess.filter((a) => a.isActive).length} active client portal
            {portalAccess.filter((a) => a.isActive).length === 1 ? "" : "s"} —{" "}
            <Link to="/tickets/links" className="text-primary hover:underline">
              manage links
            </Link>
          </p>
        ) : null}
      </div>
    </PageWrap>
  );
}
