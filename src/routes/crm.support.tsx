import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Kanban, List, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar, TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { EntityFormModal } from "@/components/entity-form-modal";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { TICKET_KANBAN_COLUMNS } from "@/data/constants";
import { useSessionFilterState } from "@/hooks/use-session-filter";
import { CRM_TICKET_PROJECT_ID, filterCrmTickets } from "@/lib/crm-tickets";
import { isTicketOpen } from "@/lib/tickets";
import { SUPPORT_PRIORITIES, SUPPORT_TYPES } from "@/lib/support-tracking";
import { cn, formatDate } from "@/lib/utils";
import {
  useAuthStore,
  useCrmAccountStore,
  useTicketStore,
  useUserStore,
} from "@/stores";
import type { Ticket, TicketPriority, TicketStatus, TicketType } from "@/types";
import { nowIso } from "@/types/common";

export const Route = createFileRoute("/crm/support")({
  component: CrmSupportLayout,
});

const SUPPORT_LIST_FILTER_DEFAULTS = {
  kpiFilter: "all" as "all" | "open" | "critical" | "resolved",
  accountFilter: "all",
  typeFilter: "all",
  priorityFilter: "all",
  tableSearch: "",
};

const KPI_CHIPS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "critical", label: "Critical" },
  { id: "resolved", label: "Resolved" },
] as const;

type KpiFilterId = (typeof KPI_CHIPS)[number]["id"];

type FilterTone = "muted" | "warning" | "success" | "danger" | "info";

const FILTER_BOX_COUNT_TONE: Record<FilterTone, string> = {
  muted: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-primary",
  danger: "text-destructive",
};

function filterTone(id: KpiFilterId): FilterTone {
  if (id === "open") return "info";
  if (id === "critical") return "danger";
  if (id === "resolved") return "success";
  return "muted";
}

function matchesKpi(ticket: Ticket, kpiFilter: KpiFilterId) {
  if (kpiFilter === "open") return isTicketOpen(ticket);
  if (kpiFilter === "critical") return ticket.priority === "Critical" && isTicketOpen(ticket);
  if (kpiFilter === "resolved") return ticket.status === "Resolved" || ticket.status === "Closed";
  return true;
}

function CrmSupportLayout() {
  const childMatches = useChildMatches();
  const isDetail = childMatches.some((m) => m.routeId.includes("$ticketId"));
  if (isDetail) return <Outlet />;
  return <CrmSupportDeskPage />;
}

function CrmSupportDeskPage() {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const tickets = useTicketStore((s) => s.tickets);
  const addTicket = useTicketStore((s) => s.addTicket);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const currentUser = useAuthStore((s) => s.user);
  const users = useUserStore((s) => s.users);

  const crmTickets = useMemo(() => filterCrmTickets(tickets), [tickets]);
  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? "Account";
  }, [accounts]);

  const [view, setView] = useState<"board" | "list">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Customization" as TicketType,
    priority: "Medium" as TicketPriority,
    accountId: "",
  });

  const [listFilters, setListFilters] = useSessionFilterState(
    "crm.support.list",
    SUPPORT_LIST_FILTER_DEFAULTS,
  );
  const { kpiFilter, accountFilter, typeFilter, priorityFilter, tableSearch } = listFilters;

  const setKpiFilter = useCallback(
    (value: KpiFilterId) => setListFilters({ kpiFilter: value }),
    [setListFilters],
  );
  const setAccountFilter = useCallback(
    (value: string) => setListFilters({ accountFilter: value }),
    [setListFilters],
  );
  const setTypeFilter = useCallback(
    (value: string) => setListFilters({ typeFilter: value }),
    [setListFilters],
  );
  const setPriorityFilter = useCallback(
    (value: string) => setListFilters({ priorityFilter: value }),
    [setListFilters],
  );
  const setTableSearch = useCallback(
    (value: string) => setListFilters({ tableSearch: value }),
    [setListFilters],
  );

  const kpiCounts = useMemo(
    () => ({
      all: crmTickets.length,
      open: crmTickets.filter((t) => isTicketOpen(t)).length,
      critical: crmTickets.filter((t) => t.priority === "Critical" && isTicketOpen(t)).length,
      resolved: crmTickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length,
    }),
    [crmTickets],
  );

  const filtered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return crmTickets.filter((t) => {
      if (!matchesKpi(t, kpiFilter)) return false;
      if (accountFilter !== "all" && t.companyId !== accountFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        accountName(t.companyId).toLowerCase().includes(q)
      );
    });
  }, [crmTickets, kpiFilter, accountFilter, typeFilter, priorityFilter, tableSearch, accountName]);

  const activeFilterCount = [
    kpiFilter !== "all",
    accountFilter !== "all",
    typeFilter !== "all",
    priorityFilter !== "all",
    Boolean(tableSearch),
  ].filter(Boolean).length;

  const assignees = useMemo(
    () => users.filter((u) => u.active && (u.productScope === "crm" || u.role === "Admin")),
    [users],
  );

  function clearFilters() {
    setListFilters({ ...SUPPORT_LIST_FILTER_DEFAULTS });
  }

  function applyFilters() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function createTicket() {
    if (!form.title.trim()) {
      toast.error("Enter a title");
      return;
    }
    if (!form.accountId) {
      toast.error("Select a CRM account");
      return;
    }
    const today = nowIso().slice(0, 10);
    const ticket = addTicket({
      companyId: form.accountId,
      projectId: CRM_TICKET_PROJECT_ID,
      title: form.title.trim().startsWith("[CRM]")
        ? form.title.trim()
        : `[CRM] ${form.title.trim()}`,
      description: form.description.trim() || "CRM support ticket",
      type: form.type,
      priority: form.priority,
      status: "Open",
      raisedOn: today,
      eta: today,
      developerId: currentUser?.id ?? "",
      assignedUserId: currentUser?.id,
    });
    toast.success("Ticket created");
    setCreateOpen(false);
    setForm({
      title: "",
      description: "",
      type: "Customization",
      priority: "Medium",
      accountId: "",
    });
    void navigate({ to: "/crm/support/$ticketId", params: { ticketId: ticket.id } });
  }

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Support Desk</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-lg border border-border/80 bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors",
                  view === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors",
                  view === "board"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
                Board
              </button>
            </div>
            <Button size="sm" className="h-8 gap-1 bg-primary px-3 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New ticket
            </Button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Support ticket filters"
          className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
        >
          {KPI_CHIPS.map((chip) => {
            const active = kpiFilter === chip.id;
            const tone = filterTone(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setKpiFilter(chip.id)}
                className={cn(
                  "flex min-h-[3.25rem] min-w-0 flex-col justify-center rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
                  "hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/80",
                )}
              >
                <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {chip.label}
                </span>
                <span
                  className={cn(
                    "mt-1 text-lg font-semibold tabular-nums leading-none",
                    FILTER_BOX_COUNT_TONE[tone],
                  )}
                >
                  {kpiCounts[chip.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {view === "list" ? (
        <div className="-mx-3 sm:-mx-4 lg:-mx-5">
          <div className="px-3 sm:px-4 lg:px-5">
            <DesignTicketFilterBar
              variant="inline"
              compact
              className="xl:grid-cols-3"
              activeFilterCount={activeFilterCount}
              onClear={clearFilters}
              onApply={applyFilters}
              resultCount={filtered.length}
              resultLabel={filtered.length === 1 ? "ticket" : "tickets"}
              trailing={
                <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search tickets…"
                    aria-label="Search tickets"
                    className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              }
            >
              <DesignTicketFilterField label="Account" compact>
                <DesignTicketSelect
                  compact
                  value={accountFilter}
                  onChange={setAccountFilter}
                  options={[
                    { value: "all", label: "All accounts" },
                    ...accounts.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              </DesignTicketFilterField>
              <DesignTicketFilterField label="Type" compact>
                <DesignTicketSelect
                  compact
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: "all", label: "All types" },
                    ...SUPPORT_TYPES.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </DesignTicketFilterField>
              <DesignTicketFilterField label="Priority" compact>
                <DesignTicketSelect
                  compact
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  options={[
                    { value: "all", label: "All priorities" },
                    ...SUPPORT_PRIORITIES.map((p) => ({ value: p, label: p })),
                  ]}
                />
              </DesignTicketFilterField>
            </DesignTicketFilterBar>
          </div>

          <div ref={tableRef} className="min-w-0">
            {crmTickets.length === 0 ? (
              <div className="px-3 sm:px-4 lg:px-5">
                <EmptyState
                  title="No CRM tickets yet"
                  description="Create a ticket from here or from an account's Tickets tab."
                  actionLabel="New ticket"
                  onAction={() => setCreateOpen(true)}
                />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 sm:px-4 lg:px-5">
                <EmptyState
                  title="No matching tickets"
                  description="Try another filter or clear your search."
                  actionLabel="Clear filters"
                  onAction={clearFilters}
                />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: TICKET_EASE }}
                className="bg-card [&_tbody_tr]:bg-card [&_thead]:bg-card"
              >
                <DataTable
                  flush
                  data={filtered}
                  getRowId={(t) => t.id}
                  hideSearch
                  density="compact"
                  pageSize={25}
                  onRowClick={(t) =>
                    void navigate({ to: "/crm/support/$ticketId", params: { ticketId: t.id } })
                  }
                  columns={[
                    {
                      key: "title",
                      header: "Ticket",
                      sortable: true,
                      render: (t) => (
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">{t.title}</div>
                          <div className="text-[10px] text-muted-foreground">{t.type}</div>
                        </div>
                      ),
                    },
                    {
                      key: "account",
                      header: "Account",
                      sortable: true,
                      render: (t) => (
                        <span className="text-xs">{accountName(t.companyId)}</span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      sortable: true,
                      render: (t) => (
                        <select
                          className="h-7 rounded border bg-background px-1.5 text-[11px]"
                          value={t.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            updateTicket(t.id, { status: e.target.value as TicketStatus })
                          }
                        >
                          {TICKET_KANBAN_COLUMNS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ),
                    },
                    {
                      key: "priority",
                      header: "Priority",
                      sortable: true,
                      render: (t) => (
                        <Pill tone={t.priority === "Critical" ? "danger" : "accent"} className="text-[10px]">
                          {t.priority}
                        </Pill>
                      ),
                    },
                    {
                      key: "raised",
                      header: "Raised",
                      sortable: true,
                      render: (t) => (
                        <span className="text-xs text-muted-foreground">{formatDate(t.raisedOn)}</span>
                      ),
                    },
                  ]}
                />
              </motion.div>
            )}
          </div>
        </div>
      ) : crmTickets.length === 0 ? (
        <div className="px-3 pt-3 sm:px-4 lg:px-5">
          <EmptyState
            title="No CRM tickets yet"
            description="Create a ticket from here or from an account's Tickets tab."
            actionLabel="New ticket"
            onAction={() => setCreateOpen(true)}
          />
        </div>
      ) : (
        <div className="grid gap-2 px-3 pt-3 sm:px-4 md:grid-cols-2 xl:grid-cols-5 lg:px-5">
          {TICKET_KANBAN_COLUMNS.map((status) => {
            const col = filtered.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className="rounded-lg border border-border/80 bg-card p-2 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {status}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-1.5">
                  {col.length === 0 ? (
                    <p className="py-4 text-center text-[10px] text-muted-foreground">Empty</p>
                  ) : (
                    col.map((t) => (
                      <Link
                        key={t.id}
                        to="/crm/support/$ticketId"
                        params={{ ticketId: t.id }}
                        className="block rounded-md border border-border/60 bg-background p-2 transition-colors hover:border-primary/40"
                      >
                        <div className="text-xs font-medium leading-snug">{t.title}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {accountName(t.companyId)}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Pill tone="accent" className="text-[9px]">
                            {t.priority}
                          </Pill>
                          <Pill tone="muted" className="text-[9px]">
                            {t.type}
                          </Pill>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EntityFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New CRM support ticket"
        submitLabel="Create"
        onSubmit={createTicket}
      >
        <div className="grid gap-2">
          <label className="text-xs font-medium">
            Account
            <select
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Title
            <input
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief summary"
            />
          </label>
          <label className="text-xs font-medium">
            Description
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium">
              Type
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TicketType })}
              >
                {SUPPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Priority
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
              >
                {SUPPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {assignees.length ? (
            <p className="text-[11px] text-muted-foreground">
              Assigned to you by default. Reassign from the ticket detail.
            </p>
          ) : null}
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
