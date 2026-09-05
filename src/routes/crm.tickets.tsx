import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Link2, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { CrmTicketsNav } from "@/components/crm/crm-tickets-nav";
import {
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar, TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { PageWrap } from "@/components/page-header";
import { TicketCreateDialog } from "@/components/tickets/ticket-create-dialog";
import { Button } from "@/components/ui/button";
import { useSessionFilterState } from "@/hooks/use-session-filter";
import { filterCrmAccountsForUser } from "@/lib/crm-account-access";
import { filterCrmDesignTickets } from "@/lib/crm-tickets";
import { cn, formatDate } from "@/lib/utils";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";
import { useAuthStore, useCrmAccountStore, useCurrentUser } from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import {
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";

const TICKET_LIST_FILTER_DEFAULTS = {
  kpiFilter: "all" as "all" | "active" | "in-progress" | "high",
  statusFilter: "all",
  priorityFilter: "all",
  accountFilter: "all",
  query: "",
};

const KPI_CHIPS = [
  { id: "all", label: "All" },
  { id: "active", label: "Open / active" },
  { id: "in-progress", label: "In progress" },
  { id: "high", label: "High priority" },
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
  if (id === "active") return "info";
  if (id === "in-progress") return "warning";
  if (id === "high") return "danger";
  return "muted";
}

function matchesKpi(
  ticket: { status: DesignTicketStatus; priority: DesignTicketPriority },
  kpiFilter: KpiFilterId,
) {
  if (kpiFilter === "active") return isDesignTicketActive(ticket.status);
  if (kpiFilter === "in-progress") return ticket.status === "in-progress";
  if (kpiFilter === "high") return ticket.priority === "high" && isDesignTicketActive(ticket.status);
  return true;
}

export const Route = createFileRoute("/crm/tickets")({
  component: CrmTicketsLayout,
});

function CrmTicketsLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <CrmTicketTrackingPage />;
}

function CrmTicketTrackingPage() {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const currentUser = useCurrentUser();
  const authUser = useAuthStore((s) => s.user);
  const tickets = useDesignTicketStore((s) => s.tickets);
  const updateStatus = useDesignTicketStore((s) => s.updateStatus);
  const updatePriority = useDesignTicketStore((s) => s.updatePriority);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const crmTickets = useMemo(() => filterCrmDesignTickets(tickets), [tickets, accounts]);

  const [createOpen, setCreateOpen] = useState(false);

  const accountOptions = useMemo(
    () =>
      filterCrmAccountsForUser(accounts, authUser)
        .map((a) => ({ id: a.id, name: a.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts, authUser],
  );

  const [listFilters, setListFilters] = useSessionFilterState(
    "crm.tickets.list",
    TICKET_LIST_FILTER_DEFAULTS,
  );
  const { kpiFilter, statusFilter, priorityFilter, accountFilter, query } = listFilters;

  const setKpiFilter = useCallback(
    (value: KpiFilterId) => setListFilters({ kpiFilter: value }),
    [setListFilters],
  );
  const setStatusFilter = useCallback(
    (value: string) => setListFilters({ statusFilter: value }),
    [setListFilters],
  );
  const setPriorityFilter = useCallback(
    (value: string) => setListFilters({ priorityFilter: value }),
    [setListFilters],
  );
  const setAccountFilter = useCallback(
    (value: string) => setListFilters({ accountFilter: value }),
    [setListFilters],
  );
  const setQuery = useCallback(
    (value: string) => setListFilters({ query: value }),
    [setListFilters],
  );

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? "Account";
  }, [accounts]);

  const kpiCounts = useMemo(
    () => ({
      all: crmTickets.length,
      active: crmTickets.filter((t) => isDesignTicketActive(t.status)).length,
      "in-progress": crmTickets.filter((t) => t.status === "in-progress").length,
      high: crmTickets.filter((t) => t.priority === "high" && isDesignTicketActive(t.status)).length,
    }),
    [crmTickets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crmTickets.filter((t) => {
      if (!matchesKpi(t, kpiFilter)) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (accountFilter !== "all" && t.companyId !== accountFilter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        accountName(t.companyId).toLowerCase().includes(q)
      );
    });
  }, [crmTickets, kpiFilter, statusFilter, priorityFilter, accountFilter, query, accountName]);

  const activeFilterCount = [
    kpiFilter !== "all",
    statusFilter !== "all",
    priorityFilter !== "all",
    accountFilter !== "all",
    Boolean(query),
  ].filter(Boolean).length;

  const actorName = currentUser?.name ?? "Team";

  function clearFilters() {
    setListFilters({ ...TICKET_LIST_FILTER_DEFAULTS });
  }

  function applyFilters() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Ticket Tracking</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" asChild>
              <Link to="/crm/tickets/links">
                <Link2 className="h-3.5 w-3.5" />
                Portal Links
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 bg-primary px-3 text-xs"
              onClick={() => setCreateOpen(true)}
              disabled={accountOptions.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              Create ticket
            </Button>
          </div>
        </div>

        <CrmTicketsNav compact />

        <div
          role="tablist"
          aria-label="Ticket filters"
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Subject, id, account…"
                  aria-label="Search tickets"
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            }
          >
            <DesignTicketFilterField label="Status" compact>
              <DesignTicketSelect
                compact
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  ...DESIGN_TICKET_STATUSES.map((s) => ({
                    value: s,
                    label: DESIGN_TICKET_STATUS_LABEL[s],
                  })),
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
                  ...DESIGN_TICKET_PRIORITIES.map((p) => ({
                    value: p,
                    label: DESIGN_TICKET_PRIORITY_LABEL[p],
                  })),
                ]}
              />
            </DesignTicketFilterField>
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
          </DesignTicketFilterBar>
        </div>

        <div ref={tableRef} className="min-w-0">
          {crmTickets.length === 0 ? (
            <div className="px-3 sm:px-4 lg:px-5">
              <EmptyState
                title="No portal tickets yet"
                description="Create a ticket for any account or share portal links so clients can raise requests."
                actionLabel="Create ticket"
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
                  void navigate({ to: "/crm/tickets/$ticketId", params: { ticketId: t.id } })
                }
                columns={[
                  {
                    key: "subject",
                    header: "Ticket",
                    sortable: true,
                    render: (t) => (
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{t.subject}</div>
                        <div className="text-[10px] text-muted-foreground">{t.ticketNumber}</div>
                      </div>
                    ),
                  },
                  {
                    key: "account",
                    header: "Account",
                    sortable: true,
                    render: (t) => (
                      <Link
                        to="/crm/accounts/$accountId"
                        params={{ accountId: t.companyId }}
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {accountName(t.companyId)}
                      </Link>
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
                        onChange={(e) => {
                          updateStatus(t.id, e.target.value as DesignTicketStatus, actorName);
                          toast.success(
                            `Status → ${DESIGN_TICKET_STATUS_LABEL[e.target.value as DesignTicketStatus]}`,
                          );
                        }}
                      >
                        {DESIGN_TICKET_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {DESIGN_TICKET_STATUS_LABEL[s]}
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
                      <select
                        className="h-7 rounded border bg-background px-1.5 text-[11px]"
                        value={t.priority}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updatePriority(t.id, e.target.value as DesignTicketPriority, actorName)
                        }
                      >
                        {DESIGN_TICKET_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {DESIGN_TICKET_PRIORITY_LABEL[p]}
                          </option>
                        ))}
                      </select>
                    ),
                  },
                  {
                    key: "createdBy",
                    header: "Raised by",
                    render: (t) => (
                      <span className="text-xs text-muted-foreground">
                        {t.createdBy.name}
                        {t.createdBy.type === "client" ? " · Client" : ""}
                      </span>
                    ),
                  },
                  {
                    key: "createdAt",
                    header: "Raised",
                    sortable: true,
                    render: (t) => (
                      <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span>
                    ),
                  },
                ]}
              />
            </motion.div>
          )}
        </div>
      </div>

      <TicketCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={accountOptions}
        actorName={actorName}
        title="Create portal ticket"
        companyLabel="Account"
        onCreated={(ticketId) => {
          void navigate({ to: "/crm/tickets/$ticketId", params: { ticketId } });
        }}
      />
    </PageWrap>
  );
}
