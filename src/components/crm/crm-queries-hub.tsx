import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquarePlus, Search } from "lucide-react";
import { toast } from "sonner";

import { CrmCreateAccountQueryModal } from "@/components/crm/crm-create-account-query-modal";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar, TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { inDateRange } from "@/components/list-toolbar";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { useSessionFilterState } from "@/hooks/use-session-filter";
import { filterCrmAccountsForUser } from "@/lib/crm-account-access";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { useAuthStore, useCrmAccountQueryStore, useCrmAccountStore } from "@/stores";
import {
  CRM_ACCOUNT_QUERY_CATEGORIES,
  CRM_ACCOUNT_QUERY_STATUS_LABEL,
  crmAccountQueryCategoryLabel,
  type CrmAccountQueryStatus,
  type CrmAccountQuerySummary,
} from "@/types/crm-account-query";
import { formatRelativeTime } from "@/types/common";

const STATUS_FILTERS = ["all", "open", "resolved", "archived"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const QUERY_LIST_FILTER_DEFAULTS = {
  executiveFilter: "all",
  accountFilter: "all",
  categoryFilter: "all",
  dateFrom: "",
  dateTo: "",
  tableSearch: "",
};

function statusTone(status: CrmAccountQueryStatus) {
  if (status === "open") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "muted" as const;
}

type Props = {
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  selectedQueryId?: string;
};

export function CrmQueriesHub({ statusFilter, onStatusFilterChange, selectedQueryId }: Props) {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const accounts = useCrmAccountStore((s) => s.accounts);
  const allQueries = useCrmAccountQueryStore((s) => s.allQueries);
  const loading = useCrmAccountQueryStore((s) => s.allQueriesLoading);
  const refreshAllQueries = useCrmAccountQueryStore((s) => s.refreshAllQueries);
  const refreshCompanyQueries = useCrmAccountQueryStore((s) => s.refreshCompanyQueries);

  const [createOpen, setCreateOpen] = useState(false);
  const [listFilters, setListFilters] = useSessionFilterState(
    "crm.queries.list",
    QUERY_LIST_FILTER_DEFAULTS,
  );
  const { executiveFilter, accountFilter, categoryFilter, dateFrom, dateTo, tableSearch } =
    listFilters;

  const setExecutiveFilter = (value: string) => setListFilters({ executiveFilter: value });
  const setAccountFilter = (value: string) => setListFilters({ accountFilter: value });
  const setCategoryFilter = (value: string) => setListFilters({ categoryFilter: value });
  const setDateFrom = (value: string) => setListFilters({ dateFrom: value });
  const setDateTo = (value: string) => setListFilters({ dateTo: value });
  const setTableSearch = (value: string) => setListFilters({ tableSearch: value });

  const accountOptions = useMemo(
    () =>
      filterCrmAccountsForUser(accounts, currentUser)
        .map((a) => ({ id: a.id, name: a.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts, currentUser],
  );

  useEffect(() => {
    void refreshAllQueries("all").catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load queries");
    });
  }, [refreshAllQueries]);

  const counts = useMemo(() => {
    const base = { all: allQueries.length, open: 0, resolved: 0, archived: 0 };
    for (const q of allQueries) {
      if (q.status in base) base[q.status as keyof typeof base] += 1;
    }
    return base;
  }, [allQueries]);

  const executiveOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of allQueries) {
      map.set(row.createdByUserId, row.createdByName);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [allQueries]);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>(CRM_ACCOUNT_QUERY_CATEGORIES);
    for (const row of allQueries) {
      if (row.category) seen.add(row.category);
    }
    return [...seen]
      .sort((a, b) => crmAccountQueryCategoryLabel(a).localeCompare(crmAccountQueryCategoryLabel(b)))
      .map((value) => ({
        value,
        label: crmAccountQueryCategoryLabel(value),
      }));
  }, [allQueries]);

  const filtered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return allQueries.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (executiveFilter !== "all" && row.createdByUserId !== executiveFilter) return false;
      if (accountFilter !== "all" && row.companyId !== accountFilter) return false;
      if (categoryFilter !== "all" && (row.category ?? "") !== categoryFilter) return false;
      if (!inDateRange(row.updatedAt, dateFrom, dateTo)) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.accountName?.toLowerCase().includes(q) ||
        row.createdByName.toLowerCase().includes(q) ||
        row.lastMessagePreview?.toLowerCase().includes(q)
      );
    });
  }, [
    allQueries,
    accountFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    executiveFilter,
    statusFilter,
    tableSearch,
  ]);

  const activeFilterCount = [
    executiveFilter !== "all",
    accountFilter !== "all",
    categoryFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  function clearFilters() {
    setListFilters({ ...QUERY_LIST_FILTER_DEFAULTS });
  }

  function applyFilters() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const columns = useMemo(
    () => [
      {
        key: "accountName",
        header: "Account",
        sortable: true,
        render: (row: CrmAccountQuerySummary) => (
          <span className="font-medium">{row.accountName ?? "—"}</span>
        ),
      },
      {
        key: "title",
        header: "Subject",
        sortable: true,
        render: (row: CrmAccountQuerySummary) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {row.lastMessagePreview ?? "No messages yet"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (row: CrmAccountQuerySummary) => (
          <Pill tone={statusTone(row.status)} className="text-[9px]">
            {CRM_ACCOUNT_QUERY_STATUS_LABEL[row.status]}
          </Pill>
        ),
      },
      {
        key: "category",
        header: "Category",
        sortable: true,
        render: (row: CrmAccountQuerySummary) =>
          row.category ? crmAccountQueryCategoryLabel(row.category) : "—",
      },
      {
        key: "createdByName",
        header: "Executive",
        sortable: true,
        render: (row: CrmAccountQuerySummary) => row.createdByName,
      },
      {
        key: "createdAt",
        header: "Age",
        sortable: true,
        render: (row: CrmAccountQuerySummary) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground" title={formatDate(row.createdAt)}>
            {formatRelativeTime(row.createdAt)}
          </span>
        ),
      },
      {
        key: "updatedAt",
        header: "Updated",
        sortable: true,
        render: (row: CrmAccountQuerySummary) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatDate(row.updatedAt)} {formatTime(row.updatedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <PageWrap compact flushTop>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: TICKET_EASE }}
        className="space-y-3"
      >
        <div className="mb-0 border-b border-border pb-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-medium tracking-tight">Account queries</h1>
              <p className="text-xs text-muted-foreground">
                All internal discussions across your accounts
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1 bg-primary px-3 text-xs"
              onClick={() => setCreateOpen(true)}
              disabled={accountOptions.length === 0}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Create query
            </Button>
          </div>

          <div
            role="tablist"
            aria-label="Query status"
            className="mt-2 flex flex-wrap items-center gap-1"
          >
            {STATUS_FILTERS.map((id) => {
              const active = statusFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onStatusFilterChange(id)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium capitalize transition-colors",
                    active
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border/80 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {id}
                  <span className="tabular-nums text-[10px] text-muted-foreground">{counts[id]}</span>
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
              resultLabel={filtered.length === 1 ? "query" : "queries"}
              trailing={
                <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search account, subject, or author…"
                    aria-label="Search queries"
                    className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              }
            >
              <DesignTicketFilterField label="Executive" compact>
                <DesignTicketSelect
                  compact
                  value={executiveFilter}
                  onChange={setExecutiveFilter}
                  options={[
                    { value: "all", label: "All executives" },
                    ...executiveOptions,
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
                    ...accountOptions.map((a) => ({ value: a.id, label: a.name })),
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
                    ...categoryOptions,
                  ]}
                />
              </DesignTicketFilterField>
              <DesignTicketDateField
                compact
                label="Updated from"
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="From"
              />
              <DesignTicketDateField
                compact
                label="Updated to"
                value={dateTo}
                onChange={setDateTo}
                placeholder="To"
              />
            </DesignTicketFilterBar>
          </div>

          {loading && allQueries.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-4 lg:px-5">
              Loading queries…
            </p>
          ) : filtered.length === 0 ? (
            <div className="px-3 sm:px-4 lg:px-5">
              <EmptyState
                title="No queries found"
                description={
                  statusFilter === "all"
                    ? "Internal account discussions will appear here."
                    : `No ${statusFilter} queries match your filters.`
                }
                actionLabel="Create query"
                onAction={() => setCreateOpen(true)}
              />
            </div>
          ) : (
            <div
              ref={tableRef}
              className="bg-card [&_tbody_tr]:bg-card [&_thead]:bg-card"
            >
              <DataTable
                data={filtered}
                columns={columns}
                hideSearch
                density="compact"
                flush
                pageSize={25}
                initialSortKey="updatedAt"
                initialSortDir="desc"
                getRowId={(row) => row.id}
                actions={(row) => (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={() => {
                      void refreshCompanyQueries(row.companyId)
                        .catch(() => {})
                        .finally(() => {
                          void navigate({
                            to: "/crm/accounts/$accountId",
                            params: { accountId: row.companyId },
                            search: { tab: "queries", queryId: row.id },
                          });
                        });
                    }}
                  >
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              />
            </div>
          )}
        </div>
      </motion.div>

      <CrmCreateAccountQueryModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={accountOptions}
        onCreated={(_query, companyId) => {
          void refreshAllQueries("all").catch(() => {});
          void navigate({
            to: "/crm/accounts/$accountId",
            params: { accountId: companyId },
            search: { tab: "queries", queryId: _query.id },
          });
        }}
      />
    </PageWrap>
  );
}
