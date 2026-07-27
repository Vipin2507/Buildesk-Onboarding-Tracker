import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  CheckCircle2,
  Clock,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import {
  DesignTicketPriorityChip,
  DesignTicketStatusPill,
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketInfoBanner,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  InternalTicketsNav,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { TicketCreateDialog } from "@/components/tickets/ticket-create-dialog";
import { PageWrap } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inDateRange } from "@/components/list-toolbar";
import {
  matchesTicketKpiFilter,
  ticketsSearchSchema,
  ticketKpiFilterLabel,
  type TicketKpiFilter,
} from "@/lib/ticket-tracking";
import { formatDate } from "@/lib/utils";
import {
  useCompanyPortalStore,
  useCompanyStore,
  useCurrentUser,
  useDesignTicketHighlights,
  useEmployeeStore,
  useUserStore,
} from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";

const UNASSIGNED = "__unassigned__";

export const Route = createFileRoute("/tickets")({
  validateSearch: (search) => ticketsSearchSchema.parse(search),
  component: TicketsLayout,
});

function TicketsLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <TicketsDashboard />;
}

type BulkAction = "assign" | "status" | "priority" | null;

function TicketsDashboard() {
  const navigate = useNavigate({ from: "/tickets" });
  const { filter: kpiFilter = "all" } = Route.useSearch();
  const tableRef = useRef<HTMLDivElement>(null);

  const currentUser = useCurrentUser();
  const tickets = useDesignTicketStore((s) => s.tickets);
  const deleteTicket = useDesignTicketStore((s) => s.deleteTicket);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const assignTicket = useDesignTicketStore((s) => s.assignTicket);
  const bulkDeleteTickets = useDesignTicketStore((s) => s.bulkDeleteTickets);
  const bulkAssignTickets = useDesignTicketStore((s) => s.bulkAssignTickets);
  const bulkUpdateStatus = useDesignTicketStore((s) => s.bulkUpdateStatus);
  const bulkUpdatePriority = useDesignTicketStore((s) => s.bulkUpdatePriority);
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<DesignTicketStatus>("in-progress");
  const [bulkPriority, setBulkPriority] = useState<DesignTicketPriority>("medium");
  const [deleteConfirm, setDeleteConfirm] = useState<{ mode: "single" | "bulk"; id?: string } | null>(
    null,
  );

  const actorName = currentUser?.name ?? "Team";

  const assigneeOptions = useMemo(
    () => [
      ...users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })),
      ...employees.map((e) => ({ id: e.id, name: e.name })),
    ],
    [users, employees],
  );

  const stats = useMemo(() => {
    const pending = tickets.filter((t) => matchesTicketKpiFilter(t.status, "pending")).length;
    return {
      total: tickets.length,
      pending,
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in-progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      closed: tickets.filter((t) => t.status === "closed").length,
    };
  }, [tickets]);

  const setKpiFilter = useCallback(
    (filter: TicketKpiFilter) => {
      void navigate({ search: { filter }, replace: true });
      if (filter === "pending") {
        setStatusFilter("all");
        setApplied((a) => ({ ...a, status: "all" }));
      } else if (filter !== "all") {
        setStatusFilter(filter);
        setApplied((a) => ({ ...a, status: filter }));
      } else {
        setStatusFilter("all");
        setApplied((a) => ({ ...a, status: "all" }));
      }
      window.setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    },
    [navigate],
  );

  useEffect(() => {
    if (kpiFilter === "all") return;
    if (kpiFilter === "pending") {
      setStatusFilter("all");
      setApplied((a) => ({ ...a, status: "all" }));
    } else {
      setStatusFilter(kpiFilter);
      setApplied((a) => ({ ...a, status: kpiFilter }));
    }
  }, [kpiFilter]);

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
      if (!matchesTicketKpiFilter(t.status, kpiFilter)) return false;
      if (applied.status !== "all" && t.status !== applied.status) return false;
      if (applied.priority !== "all" && t.priority !== applied.priority) return false;
      if (!inDateRange(t.createdAt, applied.dateFrom, applied.dateTo)) return false;
      return true;
    });
  }, [enriched, applied, kpiFilter]);

  const selectedCount = selectedIds.size;
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  function applyFilters() {
    setApplied({
      company: companyFilter,
      status: statusFilter,
      priority: priorityFilter,
      dateFrom,
      dateTo,
    });
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllSelection(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function runBulkAssign() {
    const assignee = assigneeOptions.find((a) => a.id === bulkAssigneeId);
    bulkAssignTickets(selectedList, bulkAssigneeId || undefined, assignee?.name ?? "Unassigned", actorName);
    toast.success(`Assigned ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  function runBulkStatus() {
    bulkUpdateStatus(selectedList, bulkStatus, actorName);
    toast.success(`Updated status on ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  function runBulkPriority() {
    bulkUpdatePriority(selectedList, bulkPriority, actorName);
    toast.success(`Updated priority on ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
    setBulkAction(null);
    setSelectedIds(new Set());
  }

  function confirmDelete() {
    if (deleteConfirm?.mode === "bulk") {
      bulkDeleteTickets(selectedList);
      toast.success(`Deleted ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
    } else if (deleteConfirm?.id) {
      deleteTicket(deleteConfirm.id);
      toast.success("Ticket deleted");
    }
    setDeleteConfirm(null);
  }

  const kpiCards = [
    {
      id: "all",
      label: "Total",
      value: stats.total,
      icon: Archive,
      onClick: () => setKpiFilter("all"),
      active: kpiFilter === "all",
    },
    {
      id: "pending",
      label: "Pending",
      value: stats.pending,
      tone: "text-primary",
      icon: Clock,
      onClick: () => setKpiFilter("pending"),
      active: kpiFilter === "pending",
    },
    {
      id: "open",
      label: "Open",
      value: stats.open,
      tone: "text-info",
      onClick: () => setKpiFilter("open"),
      active: kpiFilter === "open",
    },
    {
      id: "in-progress",
      label: "In Progress",
      value: stats.inProgress,
      tone: "text-warning-foreground",
      onClick: () => setKpiFilter("in-progress"),
      active: kpiFilter === "in-progress",
    },
    {
      id: "resolved",
      label: "Resolved",
      value: stats.resolved,
      tone: "text-success",
      icon: CheckCircle2,
      onClick: () => setKpiFilter("resolved"),
      active: kpiFilter === "resolved",
    },
    {
      id: "closed",
      label: "Closed",
      value: stats.closed,
      tone: "text-muted-foreground",
      onClick: () => setKpiFilter("closed"),
      active: kpiFilter === "closed",
    },
  ];

  return (
    <PageWrap>
      <DesignTicketPageHeader
        title="Ticket Tracking"
        subtitle="Client portal tickets — triage, assign, and resolve across all companies."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="gap-1.5 bg-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
            <Button variant="outline" className="gap-1.5" asChild>
              <Link to="/tickets/links">
                <Link2 className="h-4 w-4" />
                Portal Links
              </Link>
            </Button>
          </div>
        }
      />

      <InternalTicketsNav />

      <div className="mb-6">
        <DesignTicketKpiGrid items={kpiCards} columns={6} />
      </div>

      <motion.div
        variants={ticketSectionVariants}
        initial="hidden"
        animate="show"
        className="card-soft mb-4 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <DesignTicketFilterField label="Company">
          <DesignTicketSelect
            value={companyFilter}
            onChange={setCompanyFilter}
            options={[
              { value: "all", label: "All Companies" },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Status">
          <DesignTicketSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as typeof statusFilter)}
            options={[
              { value: "all", label: "All statuses" },
              ...DESIGN_TICKET_STATUSES.map((s) => ({
                value: s,
                label: DESIGN_TICKET_STATUS_LABEL[s],
              })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Priority">
          <DesignTicketSelect
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v as typeof priorityFilter)}
            options={[
              { value: "all", label: "All priorities" },
              ...DESIGN_TICKET_PRIORITIES.map((p) => ({
                value: p,
                label: DESIGN_TICKET_PRIORITY_LABEL[p],
              })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketDateField
          label="Created from"
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="From date"
        />
        <DesignTicketDateField
          label="Created to"
          value={dateTo}
          onChange={setDateTo}
          placeholder="To date"
        />
        <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-5">
          <Button type="button" className="w-full sm:w-auto" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
      </motion.div>

      <div ref={tableRef}>
        <DesignTicketSection title={ticketKpiFilterLabel(kpiFilter)} delay={0.12}>
          {selectedCount > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5"
            >
              <span className="text-sm font-medium">{selectedCount} selected</span>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setBulkAction("assign")}>
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("status")}>
                Change status
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("priority")}>
                Change priority
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => setDeleteConfirm({ mode: "bulk" })}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </motion.div>
          ) : null}

          {filtered.length === 0 ? (
            <EmptyState
              title="No tickets match"
              description={
                kpiFilter === "pending"
                  ? "No pending (open or in-progress) tickets. Try another card or create a ticket."
                  : "When a client submits from their portal, tickets appear here instantly."
              }
            />
          ) : (
            <DataTable
              data={filtered}
              getRowId={(r) => r.id}
              searchKeys={["ticketNumber", "subject", "companyName", "assigneeName"]}
              pageSize={12}
              selection={{
                selectedIds,
                onToggle: toggleSelection,
                onToggleAll: toggleAllSelection,
              }}
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
                <TicketRowActions
                  assigneeOptions={assigneeOptions}
                  currentUserId={currentUser?.id}
                  onAssign={(assigneeId, assigneeName) => {
                    assignTicket(row.id, assigneeId, assigneeName, actorName);
                    toast.success("Assignee updated");
                  }}
                  onStatus={(status) => {
                    updateStatus(row.id, status, actorName);
                    toast.success(`Status → ${DESIGN_TICKET_STATUS_LABEL[status]}`);
                  }}
                  onPriority={(priority) => {
                    updatePriority(row.id, priority, actorName);
                    toast.success("Priority updated");
                  }}
                  onDelete={() => setDeleteConfirm({ mode: "single", id: row.id })}
                />
              )}
            />
          )}
        </DesignTicketSection>
      </div>

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

      <TicketCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={companies}
        actorName={actorName}
        onCreated={(id) => void navigate({ to: "/tickets/$ticketId", params: { ticketId: id } })}
      />

      <ConfirmDeleteDialog
        open={deleteConfirm != null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={deleteConfirm?.mode === "bulk" ? `Delete ${selectedCount} tickets?` : "Delete ticket?"}
        description="This permanently removes the ticket and its message history."
        onConfirm={confirmDelete}
      />

      <Dialog open={bulkAction === "assign"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign {selectedCount} tickets</DialogTitle>
          </DialogHeader>
          <DesignTicketFilterField label="Assignee">
            <DesignTicketSelect
              value={bulkAssigneeId || UNASSIGNED}
              onChange={(v) => setBulkAssigneeId(v === UNASSIGNED ? "" : v)}
              options={[
                { value: UNASSIGNED, label: "Unassigned" },
                ...assigneeOptions.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </DesignTicketFilterField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button onClick={runBulkAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAction === "status"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change status ({selectedCount})</DialogTitle>
          </DialogHeader>
          <DesignTicketFilterField label="Status">
            <DesignTicketSelect
              value={bulkStatus}
              onChange={(v) => setBulkStatus(v as DesignTicketStatus)}
              options={DESIGN_TICKET_STATUSES.map((s) => ({
                value: s,
                label: DESIGN_TICKET_STATUS_LABEL[s],
              }))}
            />
          </DesignTicketFilterField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button onClick={runBulkStatus}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAction === "priority"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change priority ({selectedCount})</DialogTitle>
          </DialogHeader>
          <DesignTicketFilterField label="Priority">
            <DesignTicketSelect
              value={bulkPriority}
              onChange={(v) => setBulkPriority(v as DesignTicketPriority)}
              options={DESIGN_TICKET_PRIORITIES.map((p) => ({
                value: p,
                label: DESIGN_TICKET_PRIORITY_LABEL[p],
              }))}
            />
          </DesignTicketFilterField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button onClick={runBulkPriority}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrap>
  );
}

function TicketRowActions({
  assigneeOptions,
  currentUserId,
  onAssign,
  onStatus,
  onPriority,
  onDelete,
}: {
  assigneeOptions: { id: string; name: string }[];
  currentUserId?: string;
  onAssign: (assigneeId: string | undefined, assigneeName: string) => void;
  onStatus: (status: DesignTicketStatus) => void;
  onPriority: (priority: DesignTicketPriority) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Assignment
        </DropdownMenuLabel>
        {currentUserId ? (
          <DropdownMenuItem
            onClick={() => {
              const me = assigneeOptions.find((a) => a.id === currentUserId);
              if (me) onAssign(me.id, me.name);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Assign to me
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Assign to…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => onAssign(undefined, "Unassigned")}>Unassigned</DropdownMenuItem>
            <DropdownMenuSeparator />
            {assigneeOptions.map((a) => (
              <DropdownMenuItem key={a.id} onClick={() => onAssign(a.id, a.name)}>
                {a.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Ticket
        </DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {DESIGN_TICKET_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                {DESIGN_TICKET_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change priority</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {DESIGN_TICKET_PRIORITIES.map((p) => (
              <DropdownMenuItem key={p} onClick={() => onPriority(p)}>
                {DESIGN_TICKET_PRIORITY_LABEL[p]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
