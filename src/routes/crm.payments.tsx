import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CrmPaymentsExpandedRow } from "@/components/crm/crm-payments-expanded-row";
import { DataTable } from "@/components/data-table";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar } from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCrmPaymentsList,
  useCrmPaymentsSummary,
  useRemindCrmPaymentsBulk,
} from "@/hooks/use-crm-payments";
import type { PaymentStatus } from "@/lib/crm-payment-allocation";
import {
  crmPaymentsSearchSchema,
  crmPaymentsSearchToApiFilters,
  parseCrmPaymentStatusTab,
  type CrmPaymentStatusTabId,
} from "@/lib/crm-payments-search";
import { cn, formatDate } from "@/lib/utils";
import { useCrmAccountStore } from "@/stores";
import { isAdminRoleKey } from "@/lib/permissions";
import { useCurrentUser } from "@/stores/useAuthStore";

export const Route = createFileRoute("/crm/payments")({
  validateSearch: (search) => crmPaymentsSearchSchema.parse(search),
  component: CrmPaymentsPage,
});

const STATUS_TABS: { id: CrmPaymentStatusTabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "due_this_week", label: "Due this week" },
  { id: "upcoming", label: "Upcoming" },
  { id: "fully_paid", label: "Fully paid" },
];

const STATUS_TAB_TONE: Record<CrmPaymentStatusTabId, string> = {
  all: "text-foreground",
  overdue: "text-destructive",
  due_this_week: "text-amber-600 dark:text-amber-400",
  upcoming: "text-primary",
  fully_paid: "text-emerald-600 dark:text-emerald-400",
};

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function paymentStatusBadge(status: PaymentStatus) {
  const map: Record<PaymentStatus, { label: string; className: string }> = {
    overdue: {
      label: "Overdue",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
    due_this_week: {
      label: "Due this week",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    upcoming: {
      label: "Upcoming",
      className: "border-primary/30 bg-primary/10 text-primary",
    },
    fully_paid: {
      label: "Fully paid",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    not_started: {
      label: "Not started",
      className: "border-border bg-muted/50 text-muted-foreground",
    },
  };
  return map[status];
}

function CrmPaymentsPage() {
  const navigate = useNavigate({ from: "/crm/payments" });
  const search = Route.useSearch();
  const user = useCurrentUser();
  const accounts = useCrmAccountStore((s) => s.accounts);

  const statusTab = parseCrmPaymentStatusTab(search.status);
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 15;

  const [searchDraft, setSearchDraft] = useState(search.search ?? "");
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSearchDraft(search.search ?? "");
  }, [search.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchDraft.trim();
      if ((search.search ?? "") === trimmed) return;
      void navigate({
        search: (prev) => ({
          ...prev,
          search: trimmed || undefined,
          page: undefined,
        }),
        replace: true,
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft, search.search, navigate]);

  const listQuery = useCrmPaymentsList(search);
  const summaryQuery = useCrmPaymentsSummary(search);
  const bulkRemind = useRemindCrmPaymentsBulk();

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const summary = summaryQuery.data;
  const statusCounts = summary?.statusCounts;

  const salesManagerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const a of accounts) {
      const n = a.salesManagerName?.trim();
      if (n) names.add(n);
    }
    return [
      { value: "all", label: "All managers" },
      { value: "unassigned", label: "Unassigned" },
      ...[...names].sort().map((n) => ({ value: n, label: n })),
    ];
  }, [accounts]);

  const patchSearch = useCallback(
    (patch: Partial<typeof search>) => {
      void navigate({
        search: (prev) => {
          const next = { ...prev, ...patch };
          if ("status" in patch || "salesManager" in patch || "dueDateFrom" in patch || "dueDateTo" in patch || "sortBy" in patch) {
            next.page = undefined;
          }
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  function toggleExpanded(id: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

  function toggleSelectionAll(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function handleBulkRemind() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const res = await bulkRemind.mutateAsync(ids);
      toast.success(`Reminders sent for ${res.sent} of ${ids.length} accounts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk reminder failed");
    }
  }

  async function handleExport() {
    try {
      const filters = crmPaymentsSearchToApiFilters({ ...search, page: 1, pageSize: 100000 });
      const { listCrmPayments } = await import("@/lib/api");
      const data = await listCrmPayments({ data: filters });
      const header = [
        "Account",
        "Sales manager",
        "Deal value",
        "Received",
        "Pending",
        "Next due amount",
        "Next due date",
        "Overdue amount",
        "Collection %",
        "Status",
      ];
      const lines = data.rows.map((r) =>
        [
          r.accountName,
          r.salesManager ?? "",
          r.totalDealValue,
          r.paymentReceived,
          r.pendingAmount,
          r.nextDueInstallment?.remainingAmount ?? "",
          r.nextDueInstallment?.dueDate ?? "",
          r.overdueAmount,
          r.collectionPercent,
          r.paymentStatus,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [header.join(","), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.rows.length} rows`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showAdminActions = user && isAdminRoleKey(user.role);

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Payments</h1>
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "account" : "accounts"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => void handleExport()}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-3 text-xs"
              disabled={selectedIds.size === 0 || bulkRemind.isPending}
              onClick={() => void handleBulkRemind()}
            >
              <Bell className="h-3.5 w-3.5" />
              Send reminders
            </Button>
          </div>
        </div>

        {summary ? (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
            <div className="flex min-w-[640px] divide-x divide-border">
              {[
                { label: "Contract value", value: formatInr(summary.totalContractValue) },
                { label: "Received", value: formatInr(summary.totalReceived) },
                { label: "Pending", value: formatInr(summary.totalPending) },
                {
                  label: "Overdue",
                  value: formatInr(summary.totalOverdueAmount),
                  sub: `${summary.overdueAccountCount} accounts`,
                  tone: "text-destructive",
                },
                {
                  label: "Due this week",
                  value: formatInr(summary.dueThisWeekAmount),
                  sub: `${summary.dueThisWeekCount} accounts`,
                  tone: "text-amber-600 dark:text-amber-400",
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
                  {item.sub ? (
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
          className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.id;
            const countKey = tab.id === "all" ? "all" : tab.id;
            const count = statusCounts?.[countKey as keyof typeof statusCounts] ?? "—";
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
                  "flex min-w-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
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

        <DesignTicketFilterBar
          className="mt-2"
          variant="inline"
          onClear={() =>
            void navigate({
              search: {},
              replace: true,
            })
          }
        >
          <DesignTicketFilterField label="Search" className="min-w-[10rem] flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Account name…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </DesignTicketFilterField>
          {showAdminActions ? (
            <DesignTicketFilterField label="Sales manager" className="min-w-[9rem]">
              <DesignTicketSelect
                compact
                value={search.salesManager ?? "all"}
                onChange={(v) =>
                  patchSearch({ salesManager: v === "all" ? undefined : v })
                }
                options={salesManagerOptions}
              />
            </DesignTicketFilterField>
          ) : null}
          <DesignTicketDateField
            compact
            label="Due from"
            value={search.dueDateFrom ?? ""}
            onChange={(v) => patchSearch({ dueDateFrom: v || undefined })}
          />
          <DesignTicketDateField
            compact
            label="Due to"
            value={search.dueDateTo ?? ""}
            onChange={(v) => patchSearch({ dueDateTo: v || undefined })}
          />
          <DesignTicketFilterField label="Sort" className="min-w-[9rem]">
            <DesignTicketSelect
              compact
              value={`${search.sortBy ?? "nextDueDate"}:${search.sortDir ?? "asc"}`}
              onChange={(v) => {
                const [sortBy, sortDir] = v.split(":") as [
                  "nextDueDate" | "overdueAmount" | "collectionPercent",
                  "asc" | "desc",
                ];
                patchSearch({
                  sortBy: sortBy === "nextDueDate" ? undefined : sortBy,
                  sortDir: sortDir === "asc" ? undefined : sortDir,
                });
              }}
              options={[
                { value: "nextDueDate:asc", label: "Next due ↑" },
                { value: "nextDueDate:desc", label: "Next due ↓" },
                { value: "overdueAmount:desc", label: "Overdue ↓" },
                { value: "collectionPercent:asc", label: "Collected % ↑" },
                { value: "collectionPercent:desc", label: "Collected % ↓" },
              ]}
            />
          </DesignTicketFilterField>
        </DesignTicketFilterBar>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/5 px-3 py-2 text-xs">
          <span>{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            disabled={bulkRemind.isPending}
            onClick={() => void handleBulkRemind()}
          >
            <Bell className="h-3 w-3" />
            Send reminders to {selectedIds.size} accounts
          </Button>
        </div>
      ) : null}

      {listQuery.isLoading ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading payments…</p>
      ) : rows.length === 0 ? (
        <div className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
          {total === 0 && !search.search && statusTab === "all"
            ? "No payment data yet — payments appear when accounts have deal values and installments."
            : "No results match your filters."}
        </div>
      ) : (
        <div className="bg-card [&_tbody_tr]:bg-card [&_thead]:bg-card">
          <DataTable
            flush
            data={rows}
            getRowId={(r) => r.id}
            hideSearch
            pageSize={rows.length || pageSize}
            density="compact"
            expandedRowIds={expandedRowIds}
            onRowClick={(r) => toggleExpanded(r.id)}
            selection={{
              selectedIds,
              onToggle: toggleSelection,
              onToggleAll: toggleSelectionAll,
            }}
            renderExpandedRow={(r) => <CrmPaymentsExpandedRow row={r} search={search} />}
            columns={[
              {
                key: "expand",
                header: "",
                render: (r) =>
                  expandedRowIds.has(r.id) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ),
              },
              {
                key: "accountName",
                header: "Account",
                render: (r) => (
                  <div>
                    <Link
                      to="/crm/accounts/$accountId"
                      params={{ accountId: r.id }}
                      className="font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.accountName}
                    </Link>
                    {r.salesManager ? (
                      <div className="text-[10px] text-muted-foreground">{r.salesManager}</div>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "totalDealValue",
                header: "Deal value",
                render: (r) => (
                  <span className="tabular-nums text-xs">{formatInr(r.totalDealValue)}</span>
                ),
              },
              {
                key: "paymentReceived",
                header: "Received",
                render: (r) => (
                  <span className="tabular-nums text-xs">{formatInr(r.paymentReceived)}</span>
                ),
              },
              {
                key: "pendingAmount",
                header: "Pending",
                render: (r) => (
                  <span className="tabular-nums text-xs">{formatInr(r.pendingAmount)}</span>
                ),
              },
              {
                key: "nextDue",
                header: "Next due",
                render: (r) =>
                  r.nextDueInstallment ? (
                    <div className="text-xs">
                      <div className="tabular-nums font-medium">
                        {formatInr(r.nextDueInstallment.remainingAmount)}
                        {r.nextDueInstallment.remainingAmount < r.nextDueInstallment.amount ? (
                          <span className="ml-1 font-normal text-muted-foreground">
                            / {formatInr(r.nextDueInstallment.amount)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDate(r.nextDueInstallment.dueDate)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                key: "overdue",
                header: "Overdue",
                render: (r) =>
                  r.overdueAmount > 0 ? (
                    <Badge
                      variant="outline"
                      className="rounded-md border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
                    >
                      {formatInr(r.overdueAmount)}
                      {r.overdueDays != null ? ` · ${r.overdueDays}d` : ""}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                key: "collectionPercent",
                header: "Collected",
                render: (r) => (
                  <div className="min-w-[5rem]">
                    <div className="mb-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {r.collectionPercent}%
                    </div>
                    <ProgressBar value={r.collectionPercent} className="h-1.5" />
                  </div>
                ),
              },
              {
                key: "paymentStatus",
                header: "Status",
                render: (r) => {
                  const badge = paymentStatusBadge(r.paymentStatus);
                  return (
                    <Badge
                      variant="outline"
                      className={cn("rounded-md text-[10px] font-medium", badge.className)}
                    >
                      {badge.label}
                    </Badge>
                  );
                },
              },
            ]}
          />

          {total > pageSize ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-3 pb-3 text-[11px] text-muted-foreground">
              <span className="min-w-0 tabular-nums">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </span>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => patchSearch({ page: page <= 2 ? undefined : page - 1 })}
                >
                  Prev
                </Button>
                <span className="flex items-center px-2 tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => patchSearch({ page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PageWrap>
  );
}
