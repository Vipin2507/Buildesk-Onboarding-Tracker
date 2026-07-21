import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CountUp } from "@/components/count-up";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import { PageHeader, PageWrap } from "@/components/page-header";
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
    { label: "Open", value: stats.open },
    { label: "In Progress", value: stats.inProgress },
    { label: "Resolved", value: stats.resolved },
    { label: "Closed", value: stats.closed },
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
      <PageHeader
        title="Ticket Tracking"
        subtitle="Design & client support desk — triage tickets across all companies."
        actions={
          <Button variant="outline" asChild>
            <Link to="/tickets/links">Company Portal Links</Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map((k) => (
          <div key={k.label} className="card-soft p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-2xl font-semibold">
              <CountUp to={k.value} />
            </div>
          </div>
        ))}
      </div>

      <div className="card-soft mb-4 grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-xs">
          Company
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-9 w-full rounded-md border bg-card px-2 text-sm"
          >
            <option value="all">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 w-full rounded-md border bg-card px-2 text-sm"
          >
            <option value="all">All</option>
            {DESIGN_TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Priority
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            className="h-9 w-full rounded-md border bg-card px-2 text-sm"
          >
            <option value="all">All</option>
            {DESIGN_TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Created from
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
        </label>
        <label className="space-y-1 text-xs">
          Created to
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
        </label>
        <div className="flex items-end lg:col-span-5">
          <Button type="button" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
      </div>

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

      <div className="mt-6 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-center text-sm text-muted-foreground">
        Team replies, updates and status changes are visible to the client in real time.
      </div>

      {portalAccess.length > 0 ? (
        <div className="mt-4 text-xs text-muted-foreground">
          {portalAccess.filter((a) => a.isActive).length} active client portal
          {portalAccess.filter((a) => a.isActive).length === 1 ? "" : "s"} —{" "}
          <Link to="/tickets/links" className="text-primary hover:underline">
            manage links
          </Link>
        </div>
      ) : null}
    </PageWrap>
  );
}
