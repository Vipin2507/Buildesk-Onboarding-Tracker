import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, Headset, Link2, MoreHorizontal, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { CrmTicketsNav } from "@/components/crm/crm-tickets-nav";
import { CrmTicketPreviewSheet } from "@/components/crm/tickets/crm-ticket-preview-sheet";
import { CrmTicketsAnalytics } from "@/components/crm/tickets/crm-tickets-analytics";
import {
  TICKET_AGING_DAYS,
  daysOpenForTicket,
  formatDaysOpen,
  matchesTicketKpi,
  personInitials,
  priorityDotClass,
  statusPillClass,
  ticketCategoryLabel,
  ticketCategoryStyle,
  type TicketKpiFilter,
} from "@/components/crm/tickets/crm-tickets-format";
import { CrmTicketsKpiCards } from "@/components/crm/tickets/crm-tickets-kpi-cards";
import {
  DESIGN_TICKET_PRIORITIES,
  DESIGN_TICKET_STATUSES,
} from "@/components/design-ticket/design-ticket-chips";
import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketFilterBar,
  TICKET_EASE,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { PageWrap } from "@/components/page-header";
import { TicketCreateDialog } from "@/components/tickets/ticket-create-dialog";
import { Button } from "@/components/ui/button";
import { useSessionFilterState } from "@/hooks/use-session-filter";
import { filterCrmAccountsForUser } from "@/lib/crm-account-access";
import { filterCrmDesignTickets } from "@/lib/crm-tickets";
import { resolveAssigneeLabel } from "@/lib/managers";
import { cn, formatDate } from "@/lib/utils";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";
import {
  useAuthStore,
  useCrmAccountStore,
  useCurrentUser,
  useEmployeeStore,
  useUserStore,
} from "@/stores";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import type { DesignTicket, DesignTicketPriority, DesignTicketStatus } from "@/types/design-ticket";
import {
  DESIGN_TICKET_CATEGORIES,
  DESIGN_TICKET_PRIORITY_LABEL,
  DESIGN_TICKET_STATUS_LABEL,
} from "@/types/design-ticket";

const TICKET_LIST_FILTER_DEFAULTS = {
  kpiFilter: "all" as TicketKpiFilter,
  statusFilter: "all",
  priorityFilter: "all",
  categoryFilter: "all",
  accountFilter: "all",
  support1Filter: "all",
  support2Filter: "all",
  salesFilter: "all",
  query: "",
};

type TicketListRow = DesignTicket & {
  accountName: string;
  supportManager1: string;
  supportManager2: string;
  salesManagerName: string;
  raisedByName: string;
  assigneeName: string;
  daysOpen: number;
  categoryLabel: string;
};

function uniqueSortedNames(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeKpiFilter(value: string): TicketKpiFilter {
  if (
    value === "open" ||
    value === "in-progress" ||
    value === "resolved" ||
    value === "aging" ||
    value === "all"
  ) {
    return value;
  }
  return "all";
}

function twoLinePersonName(value?: string | null) {
  const name = value?.trim();
  if (!name) {
    return (
      <span className="block min-h-[2rem] text-xs leading-4 text-muted-foreground">—</span>
    );
  }
  const parts = name.split(/\s+/).filter(Boolean);
  const splitAt = Math.max(1, Math.ceil(parts.length / 2));
  const first = parts.slice(0, splitAt).join(" ");
  const second = parts.slice(splitAt).join(" ");
  return (
    <span className="block min-h-[2rem] text-xs leading-4">
      <span className="block truncate">{first}</span>
      <span className="block truncate text-muted-foreground">{second || "\u00A0"}</span>
    </span>
  );
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
  const users = useUserStore((s) => s.users);
  const employees = useEmployeeStore((s) => s.employees);
  const crmTickets = useMemo(() => filterCrmDesignTickets(tickets), [tickets, accounts]);

  const [createOpen, setCreateOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const accountOptions = useMemo(
    () =>
      filterCrmAccountsForUser(accounts, authUser)
        .map((a) => ({
          id: a.id,
          name: a.name,
          supportManager1: a.supportManager1?.trim() || undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts, authUser],
  );

  const [listFilters, setListFilters] = useSessionFilterState(
    "crm.tickets.list",
    TICKET_LIST_FILTER_DEFAULTS,
  );
  const {
    kpiFilter: kpiFilterRaw,
    statusFilter,
    priorityFilter,
    categoryFilter,
    accountFilter,
    support1Filter,
    support2Filter,
    salesFilter,
    query,
  } = listFilters;
  const kpiFilter = normalizeKpiFilter(kpiFilterRaw);

  const setKpiFilter = useCallback(
    (value: TicketKpiFilter) => setListFilters({ kpiFilter: value }),
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
  const setCategoryFilter = useCallback(
    (value: string) => setListFilters({ categoryFilter: value }),
    [setListFilters],
  );
  const setAccountFilter = useCallback(
    (value: string) => setListFilters({ accountFilter: value }),
    [setListFilters],
  );
  const setSupport1Filter = useCallback(
    (value: string) => setListFilters({ support1Filter: value }),
    [setListFilters],
  );
  const setSupport2Filter = useCallback(
    (value: string) => setListFilters({ support2Filter: value }),
    [setListFilters],
  );
  const setSalesFilter = useCallback(
    (value: string) => setListFilters({ salesFilter: value }),
    [setListFilters],
  );
  const setQuery = useCallback(
    (value: string) => setListFilters({ query: value }),
    [setListFilters],
  );

  const accountById = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a]));
    return map;
  }, [accounts]);

  const ticketRows = useMemo((): TicketListRow[] => {
    const now = new Date();
    return crmTickets.map((t) => {
      const account = accountById.get(t.companyId);
      return {
        ...t,
        accountName: account?.name ?? "Account",
        supportManager1: account?.supportManager1?.trim() || "",
        supportManager2: account?.supportManager2?.trim() || "",
        salesManagerName: account?.salesManagerName?.trim() || "",
        raisedByName: t.createdBy.name,
        assigneeName: resolveAssigneeLabel(t.assigneeId, users, employees),
        daysOpen: daysOpenForTicket(t, now),
        categoryLabel: ticketCategoryLabel(t.category),
      };
    });
  }, [crmTickets, accountById, users, employees]);

  const support1Options = useMemo(
    () => uniqueSortedNames(ticketRows.map((r) => r.supportManager1)),
    [ticketRows],
  );
  const support2Options = useMemo(
    () => uniqueSortedNames(ticketRows.map((r) => r.supportManager2)),
    [ticketRows],
  );
  const salesOptions = useMemo(
    () => uniqueSortedNames(ticketRows.map((r) => r.salesManagerName)),
    [ticketRows],
  );
  const categoryOptions = useMemo(() => {
    const fromData = uniqueSortedNames(ticketRows.map((r) => r.categoryLabel));
    const known = DESIGN_TICKET_CATEGORIES.filter((c) => fromData.includes(c));
    const extras = fromData.filter(
      (c) => !(DESIGN_TICKET_CATEGORIES as readonly string[]).includes(c),
    );
    return [...known, ...extras];
  }, [ticketRows]);

  const kpiCounts = useMemo(
    () => ({
      all: crmTickets.length,
      open: crmTickets.filter((t) => t.status === "open").length,
      "in-progress": crmTickets.filter((t) => t.status === "in-progress").length,
      resolved: crmTickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
      aging: ticketRows.filter(
        (t) => isDesignTicketActive(t.status) && t.daysOpen >= TICKET_AGING_DAYS,
      ).length,
    }),
    [crmTickets, ticketRows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ticketRows.filter((t) => {
      if (!matchesTicketKpi(t, kpiFilter)) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (categoryFilter !== "all" && t.categoryLabel !== categoryFilter) return false;
      if (accountFilter !== "all" && t.companyId !== accountFilter) return false;
      if (support1Filter !== "all" && t.supportManager1 !== support1Filter) return false;
      if (support2Filter !== "all" && t.supportManager2 !== support2Filter) return false;
      if (salesFilter !== "all" && t.salesManagerName !== salesFilter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.accountName.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q) ||
        t.assigneeName.toLowerCase().includes(q) ||
        t.supportManager1.toLowerCase().includes(q) ||
        t.supportManager2.toLowerCase().includes(q) ||
        t.salesManagerName.toLowerCase().includes(q) ||
        t.raisedByName.toLowerCase().includes(q)
      );
    });
  }, [
    ticketRows,
    kpiFilter,
    statusFilter,
    priorityFilter,
    categoryFilter,
    accountFilter,
    support1Filter,
    support2Filter,
    salesFilter,
    query,
  ]);

  const previewTicket = useMemo(
    () => (previewId ? ticketRows.find((t) => t.id === previewId) ?? null : null),
    [previewId, ticketRows],
  );

  const activeFilterCount = [
    kpiFilter !== "all",
    statusFilter !== "all",
    priorityFilter !== "all",
    categoryFilter !== "all",
    accountFilter !== "all",
    support1Filter !== "all",
    support2Filter !== "all",
    salesFilter !== "all",
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
      <motion.div
        variants={ticketPageVariants}
        initial="hidden"
        animate="show"
        className="space-y-3 pb-4"
      >
        <motion.div variants={ticketSectionVariants} className="border-b border-border pb-3 pt-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Headset className="h-4 w-4" />
                </span>
                <div>
                  <h1 className="text-base font-semibold tracking-tight">Ticket Tracking</h1>
                  <p className="text-xs text-muted-foreground">
                    Manage, track and resolve customer tickets · {filtered.length} shown
                  </p>
                </div>
              </div>
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
                className="h-8 gap-1 bg-primary px-3 text-xs shadow-sm shadow-primary/20"
                onClick={() => setCreateOpen(true)}
                disabled={accountOptions.length === 0}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Ticket
              </Button>
            </div>
          </div>
          <CrmTicketsNav compact />
        </motion.div>

        <motion.div variants={ticketSectionVariants}>
          <CrmTicketsKpiCards counts={kpiCounts} active={kpiFilter} onSelect={setKpiFilter} />
        </motion.div>

        <motion.div variants={ticketSectionVariants}>
          <CrmTicketsAnalytics tickets={crmTickets} />
        </motion.div>

        <motion.div variants={ticketSectionVariants} className="-mx-3 sm:-mx-4 lg:-mx-5">
          <div className="px-3 sm:px-4 lg:px-5">
            <DesignTicketFilterBar
              variant="inline"
              compact
              className="xl:grid-cols-3 2xl:grid-cols-4"
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
                    placeholder="Subject, ID, account, assignee…"
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
              <DesignTicketFilterField label="Category" compact>
                <DesignTicketSelect
                  compact
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[
                    { value: "all", label: "All categories" },
                    ...categoryOptions.map((c) => ({ value: c, label: c })),
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
              <DesignTicketFilterField label="Support 1" compact>
                <DesignTicketSelect
                  compact
                  value={support1Filter}
                  onChange={setSupport1Filter}
                  options={[
                    { value: "all", label: "All support 1" },
                    ...support1Options.map((name) => ({ value: name, label: name })),
                  ]}
                />
              </DesignTicketFilterField>
              <DesignTicketFilterField label="Support 2" compact>
                <DesignTicketSelect
                  compact
                  value={support2Filter}
                  onChange={setSupport2Filter}
                  options={[
                    { value: "all", label: "All support 2" },
                    ...support2Options.map((name) => ({ value: name, label: name })),
                  ]}
                />
              </DesignTicketFilterField>
              <DesignTicketFilterField label="Sales" compact>
                <DesignTicketSelect
                  compact
                  value={salesFilter}
                  onChange={setSalesFilter}
                  options={[
                    { value: "all", label: "All sales" },
                    ...salesOptions.map((name) => ({ value: name, label: name })),
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: TICKET_EASE }}
                className="bg-card [&_tbody_tr]:bg-card [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-primary/[0.03] [&_thead]:bg-card"
              >
                <DataTable
                  flush
                  data={filtered}
                  getRowId={(t) => t.id}
                  hideSearch
                  density="compact"
                  pageSize={25}
                  getRowClassName={(t) =>
                    previewId === t.id ? "bg-primary/[0.06] ring-1 ring-inset ring-primary/20" : undefined
                  }
                  onRowClick={(t) => setPreviewId(t.id)}
                  actions={(t) => (
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        aria-label="Preview ticket"
                        onClick={() => setPreviewId(t.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        aria-label="Open full ticket"
                        onClick={() =>
                          void navigate({
                            to: "/crm/tickets/$ticketId",
                            params: { ticketId: t.id },
                          })
                        }
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  columns={[
                    {
                      key: "ticketNumber",
                      header: "Ticket ID",
                      sortable: true,
                      render: (t) => (
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewId(t.id);
                          }}
                        >
                          {t.ticketNumber}
                        </button>
                      ),
                    },
                    {
                      key: "subject",
                      header: "Subject",
                      sortable: true,
                      render: (t) => (
                        <div className="min-w-[10rem] max-w-[16rem]">
                          <div className="truncate text-xs font-medium">{t.subject}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {t.raisedByName}
                            {t.createdBy.type === "client" ? " · Client" : ""}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "accountName",
                      header: "Account",
                      sortable: true,
                      render: (t) => (
                        <Link
                          to="/crm/accounts/$accountId"
                          params={{ accountId: t.companyId }}
                          className="text-xs text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.accountName}
                        </Link>
                      ),
                    },
                    {
                      key: "categoryLabel",
                      header: "Category",
                      sortable: true,
                      render: (t) => {
                        const style = ticketCategoryStyle(t.category);
                        return (
                          <span
                            className={cn(
                              "inline-flex max-w-[9rem] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              style.bg,
                            )}
                          >
                            {t.categoryLabel}
                          </span>
                        );
                      },
                    },
                    {
                      key: "priority",
                      header: "Priority",
                      sortable: true,
                      render: (t) => (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full", priorityDotClass(t.priority))}
                            aria-hidden
                          />
                          <select
                            className="h-7 rounded-md border bg-background px-1.5 text-[11px]"
                            value={t.priority}
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
                        </div>
                      ),
                    },
                    {
                      key: "assigneeName",
                      header: "Assignee",
                      sortable: true,
                      render: (t) => {
                        const name = t.assigneeName === "—" ? "" : t.assigneeName;
                        if (!name) {
                          return <span className="text-xs text-muted-foreground">Unassigned</span>;
                        }
                        return (
                          <div className="flex min-w-[6.5rem] items-center gap-1.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                              {personInitials(name)}
                            </span>
                            {twoLinePersonName(name)}
                          </div>
                        );
                      },
                    },
                    {
                      key: "status",
                      header: "Status",
                      sortable: true,
                      render: (t) => (
                        <select
                          className={cn(
                            "h-7 rounded-full border px-2 text-[10px] font-semibold",
                            statusPillClass(t.status),
                          )}
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
                      key: "supportManager1",
                      header: "Support 1",
                      sortable: true,
                      render: (t) => twoLinePersonName(t.supportManager1),
                    },
                    {
                      key: "daysOpen",
                      header: "Days open",
                      sortable: true,
                      render: (t) => (
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            t.daysOpen >= TICKET_AGING_DAYS
                              ? "text-rose-600 dark:text-rose-400"
                              : t.daysOpen >= 3
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground",
                          )}
                          title={`Raised ${formatDate(t.createdAt)}`}
                        >
                          {formatDaysOpen(t.daysOpen)}
                        </span>
                      ),
                    },
                  ]}
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <CrmTicketPreviewSheet
        ticket={previewTicket}
        open={Boolean(previewId && previewTicket)}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        actorName={actorName}
      />

      <TicketCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={accountOptions}
        actorName={actorName}
        title="Create portal ticket"
        companyLabel="Account"
        onCreated={(ticketId) => {
          setPreviewId(ticketId);
        }}
      />
    </PageWrap>
  );
}
