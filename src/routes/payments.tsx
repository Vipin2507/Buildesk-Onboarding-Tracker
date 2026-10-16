import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CompanyCommercialBulkUpdateModal } from "@/components/companies/company-commercial-bulk-update-modal";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar } from "@/components/design-ticket/design-ticket-shared";
import { EmptyState } from "@/components/empty-state";
import { ErpPaymentsExpandedRow } from "@/components/erp/erp-payments-expanded-row";
import { PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { erpPaymentsKeys, useErpCompanyPaymentsList } from "@/hooks/use-erp-payments";
import { downloadErpPaymentsCsv } from "@/lib/erp-payments-export";
import {
  erpPaymentsSearchSchema,
  parseErpPaymentStatusTab,
  type ErpPaymentStatusTabId,
} from "@/lib/erp-payments-search";
import { cn, formatDate, formatInr } from "@/lib/utils";
import type { CompanyPaymentStatus } from "@/types";
import type { ErpCompanyPaymentListItem } from "@/types/company-payment";

export const Route = createFileRoute("/payments")({
  validateSearch: (search) => erpPaymentsSearchSchema.parse(search),
  component: ErpPaymentsPage,
});

const STATUS_TABS: { id: ErpPaymentStatusTabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "due_this_week", label: "This week" },
  { id: "due_this_month", label: "This month" },
  { id: "upcoming", label: "Later" },
  { id: "fully_paid", label: "Fully paid" },
  { id: "pending", label: "Pending" },
  { id: "partially_paid", label: "Partially paid" },
  { id: "na", label: "NA" },
];

const STATUS_TAB_TONE: Record<ErpPaymentStatusTabId, string> = {
  all: "text-foreground",
  overdue: "text-destructive",
  due_this_week: "text-amber-600 dark:text-amber-400",
  due_this_month: "text-orange-600 dark:text-orange-400",
  upcoming: "text-muted-foreground",
  fully_paid: "text-emerald-600 dark:text-emerald-400",
  pending: "text-destructive",
  partially_paid: "text-amber-600 dark:text-amber-400",
  na: "text-muted-foreground",
};

function paymentStatusBadge(status: CompanyPaymentStatus) {
  const map: Record<CompanyPaymentStatus, { label: string; className: string }> = {
    "Fully paid": {
      label: "Fully paid",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    "Partially paid": {
      label: "Partially paid",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    "Part payment subscription": {
      label: "Part payment",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    Pending: {
      label: "Pending",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
    NA: {
      label: "NA",
      className: "border-border bg-muted/50 text-muted-foreground",
    },
  };
  return map[status] ?? map.NA;
}

function rowMatchesTab(row: ErpCompanyPaymentListItem, tab: ErpPaymentStatusTabId) {
  if (tab === "all") return true;
  if (tab === "overdue") return row.dueBucket === "overdue";
  if (tab === "due_this_week") return row.dueBucket === "due_this_week";
  if (tab === "due_this_month") return row.dueBucket === "due_this_month";
  if (tab === "upcoming") return row.dueBucket === "upcoming";
  if (tab === "fully_paid") return row.paymentStatus === "Fully paid";
  if (tab === "pending") return row.paymentStatus === "Pending";
  if (tab === "partially_paid") {
    return (
      row.paymentStatus === "Partially paid" ||
      row.paymentStatus === "Part payment subscription"
    );
  }
  if (tab === "na") return row.paymentStatus === "NA";
  return true;
}

function ErpPaymentsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const statusTab = parseErpPaymentStatusTab(search.status);
  const { data, isLoading, isError, refetch, isFetching } = useErpCompanyPaymentsList();
  const [searchDraft, setSearchDraft] = useState(search.search ?? "");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSearchDraft(search.search ?? "");
  }, [search.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchDraft.trim();
      if ((search.search ?? "") === trimmed) return;
      void navigate({
        search: (prev: typeof search) => ({
          ...prev,
          search: trimmed || undefined,
        }),
        replace: true,
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft, search.search, navigate]);

  function patchSearch(patch: Partial<typeof search>) {
    void navigate({
      search: (prev: typeof search) => ({ ...prev, ...patch }),
      replace: true,
    });
  }

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = (search.search ?? "").trim().toLowerCase();
    let next = rows.filter((r) => {
      if (!rowMatchesTab(r, statusTab)) return false;
      if (!q) return true;
      return (
        r.companyName.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        (r.commercialStatus?.toLowerCase().includes(q) ?? false)
      );
    });

    const sortBy = search.sortBy ?? "pendingAmount";
    const sortDir = search.sortDir ?? (sortBy === "nextDueDate" ? "asc" : "desc");
    const dir = sortDir === "asc" ? 1 : -1;

    next = [...next].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "companyName") {
        cmp = a.companyName.localeCompare(b.companyName);
      } else if (sortBy === "nextDueDate") {
        const ad = a.nextDueDate ?? "9999-12-31";
        const bd = b.nextDueDate ?? "9999-12-31";
        cmp = ad.localeCompare(bd);
      } else if (sortBy === "overdueAmount") {
        cmp = a.overdueAmount - b.overdueAmount;
      } else if (sortBy === "collectionPercent") {
        cmp = a.collectionPercent - b.collectionPercent;
      } else {
        cmp = a.pendingAmount - b.pendingAmount;
      }
      return cmp * dir;
    });

    return next;
  }, [data?.rows, search.search, search.sortBy, search.sortDir, statusTab]);

  const summary = data?.summary;
  const statusCounts = summary?.statusCounts;

  function toggleExpand(id: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport() {
    if (filteredRows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    downloadErpPaymentsCsv(filteredRows);
    toast.success(`Exported ${filteredRows.length} companies`);
  }

  return (
    <PageWrap compact flushTop>
      <div className="space-y-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Payments</h1>
            <p className="text-[11px] text-muted-foreground">
              ERP collections across onboarded companies
              {summary ? ` · ${filteredRows.length} shown` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => setBulkOpen(true)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Bulk update
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-3 text-xs"
              onClick={handleExport}
              disabled={filteredRows.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {summary ? (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
            <div className="flex min-w-[720px] divide-x divide-border">
              {[
                { label: "Companies", value: String(summary.companyCount) },
                { label: "Total deal", value: formatInr(summary.totalDealSize) },
                { label: "Received", value: formatInr(summary.totalReceived) },
                { label: "Pending", value: formatInr(summary.totalPending) },
                {
                  label: "Overdue",
                  value: formatInr(summary.totalOverdueAmount),
                  sub: `${summary.overdueCompanyCount} companies`,
                  tone: "text-destructive",
                },
                {
                  label: "Due this week",
                  value: formatInr(summary.dueThisWeekAmount),
                  sub: `${summary.dueThisWeekCount} companies`,
                  tone: "text-amber-600 dark:text-amber-400",
                },
                {
                  label: "Due this month",
                  value: formatInr(summary.dueThisMonthAmount),
                  sub: `${summary.dueThisMonthCount} companies`,
                  tone: "text-orange-600 dark:text-orange-400",
                },
                {
                  label: "Collection rate",
                  value: `${summary.collectionRatePercent}%`,
                },
              ].map((item) => (
                <div key={item.label} className="min-w-0 flex-1 px-3 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </div>
                  <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", item.tone)}>
                    {item.value}
                  </div>
                  {"sub" in item && item.sub ? (
                    <div className={cn("text-[10px] tabular-nums", item.tone ?? "text-muted-foreground")}>
                      {item.sub}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div
          role="tablist"
          aria-label="Payment status filters"
          className="mt-2 flex gap-1.5 overflow-x-auto pb-1"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.id;
            const count = statusCounts?.[tab.id] ?? "—";
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  patchSearch({ status: tab.id === "all" ? undefined : tab.id })
                }
                className={cn(
                  "flex min-w-[5.5rem] shrink-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
                  "hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/80",
                )}
              >
                <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "mt-1 text-lg font-semibold tabular-nums leading-none",
                    STATUS_TAB_TONE[tab.id],
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search company or city…"
              aria-label="Search company"
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>

        <DesignTicketFilterBar
          className="mt-2"
          variant="inline"
          onClear={() =>
            patchSearch({
              sortBy: undefined,
              sortDir: undefined,
            })
          }
        >
          <DesignTicketFilterField label="Sort" className="min-w-[10rem]">
            <DesignTicketSelect
              compact
              value={`${search.sortBy ?? "pendingAmount"}:${search.sortDir ?? "desc"}`}
              onChange={(v) => {
                const [sortBy, sortDir] = v.split(":") as [
                  NonNullable<typeof search.sortBy>,
                  "asc" | "desc",
                ];
                patchSearch({
                  sortBy: sortBy === "pendingAmount" ? undefined : sortBy,
                  sortDir: sortDir === "desc" ? undefined : sortDir,
                });
              }}
              options={[
                { value: "pendingAmount:desc", label: "Pending ↓" },
                { value: "pendingAmount:asc", label: "Pending ↑" },
                { value: "overdueAmount:desc", label: "Overdue ↓" },
                { value: "nextDueDate:asc", label: "Next due ↑" },
                { value: "nextDueDate:desc", label: "Next due ↓" },
                { value: "collectionPercent:desc", label: "Collected ↓" },
                { value: "companyName:asc", label: "Company A–Z" },
              ]}
            />
          </DesignTicketFilterField>
        </DesignTicketFilterBar>

        <div className="mt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading ERP payments…</p>
          ) : isError ? (
            <EmptyState
              title="Could not load payments"
              description="Try refreshing. This hub uses ERP company ledgers only."
              actionLabel="Retry"
              onAction={() => void refetch()}
            />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title="No companies match"
              description="Adjust filters or add commercial data on a company Details tab."
            />
          ) : (
            <DataTable
              data={filteredRows}
              getRowId={(r) => r.companyId}
              hideSearch
              pageSize={20}
              flush
              expandedRowIds={expandedRowIds}
              onRowClick={(r) => toggleExpand(r.companyId)}
              renderExpandedRow={(r) => (
                <ErpPaymentsExpandedRow companyId={r.companyId} companyName={r.companyName} />
              )}
              columns={[
                {
                  key: "expand",
                  header: "",
                  render: (r) => {
                    const open = expandedRowIds.has(r.companyId);
                    return (
                      <span className="inline-flex w-6 justify-center">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>
                    );
                  },
                },
                {
                  key: "company",
                  header: "Company",
                  render: (r) => (
                    <div className="min-w-0">
                      <Link
                        to="/companies/$companyId"
                        params={{ companyId: r.companyId }}
                        search={{ tab: "Payments" }}
                        className="font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.companyName}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{r.city}</div>
                    </div>
                  ),
                },
                {
                  key: "commercial",
                  header: "Subscription",
                  render: (r) =>
                    r.commercialStatus ? (
                      <Badge
                        variant="outline"
                        className="rounded-md px-1.5 py-0 text-[10px] font-medium"
                      >
                        {r.commercialStatus}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "deal",
                  header: "Deal",
                  render: (r) => <span className="tabular-nums">{formatInr(r.dealSize)}</span>,
                },
                {
                  key: "received",
                  header: "Received",
                  render: (r) => (
                    <span className="tabular-nums">{formatInr(r.paymentReceived)}</span>
                  ),
                },
                {
                  key: "pending",
                  header: "Pending",
                  render: (r) => (
                    <span className="font-medium tabular-nums">{formatInr(r.pendingAmount)}</span>
                  ),
                },
                {
                  key: "progress",
                  header: "Collected",
                  render: (r) => (
                    <div className="min-w-[7rem]">
                      <ProgressBar value={r.collectionPercent} />
                      <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {r.collectionPercent}%
                      </div>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => {
                    const badge = paymentStatusBadge(r.paymentStatus);
                    return (
                      <Badge
                        variant="outline"
                        className={cn("rounded-md px-1.5 py-0 text-[10px] font-medium", badge.className)}
                      >
                        {badge.label}
                      </Badge>
                    );
                  },
                },
                {
                  key: "due",
                  header: "Next due",
                  render: (r) => {
                    if (r.overdueAmount > 0) {
                      return (
                        <div className="min-w-0">
                          <Badge
                            variant="outline"
                            className="rounded-md border-destructive/30 bg-destructive/10 px-1.5 py-0 text-[10px] font-medium text-destructive"
                          >
                            Overdue {formatInr(r.overdueAmount)}
                          </Badge>
                          {r.nextDueDate ? (
                            <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                              Next {formatDate(r.nextDueDate)}
                              {r.nextDueAmount != null ? ` · ${formatInr(r.nextDueAmount)}` : ""}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                    if (!r.nextDueDate) {
                      return <span className="text-xs text-muted-foreground">—</span>;
                    }
                    return (
                      <div className="text-xs">
                        <div className="tabular-nums">{formatDate(r.nextDueDate)}</div>
                        {r.nextDueAmount != null ? (
                          <div className="text-[10px] tabular-nums text-muted-foreground">
                            {formatInr(r.nextDueAmount)}
                          </div>
                        ) : null}
                      </div>
                    );
                  },
                },
                {
                  key: "ledger",
                  header: "Ledger",
                  render: (r) => <span className="tabular-nums">{r.transactionCount}</span>,
                },
              ]}
            />
          )}
        </div>
      </div>

      <CompanyCommercialBulkUpdateModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk update payments"
        description="Upload your ERP payments Excel sheet (Status, Name, Total Deal Value, Amount WITH GST, Taxable, GST, Plan Name, Payment status, Installment amount, Due date, Start date, End date / Renewal date, Cancelled On). Rows match companies by name. Quantity is ignored. Empty cells leave current values unchanged."
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: erpPaymentsKeys.list() });
        }}
      />
    </PageWrap>
  );
}
