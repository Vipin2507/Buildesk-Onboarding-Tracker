import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CrmAccountPaymentBulkUpdateModal } from "@/components/crm/crm-account-payment-bulk-update-modal";
import { CrmAccountRenewDialog } from "@/components/crm/crm-account-renew-dialog";
import { CrmExecutivePaymentReminderDialog } from "@/components/crm/crm-executive-payment-reminder-dialog";
import { CrmPaymentsExpandedRow } from "@/components/crm/crm-payments-expanded-row";
import { PaymentsAnalytics } from "@/components/crm/payments/payments-analytics";
import { formatPaymentsInr } from "@/components/crm/payments/payments-format";
import { PaymentsHeader } from "@/components/crm/payments/payments-header";
import { PaymentsKpiCards } from "@/components/crm/payments/payments-kpi-cards";
import { PaymentsLostSummary } from "@/components/crm/payments/payments-lost-summary";
import { PaymentsStatusTabs } from "@/components/crm/payments/payments-status-tabs";
import { PaymentsUpcomingPerformance } from "@/components/crm/payments/payments-upcoming-performance";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  useCrmPaymentsList,
  useCrmPaymentsSummary,
  useRemindCrmPaymentsBulk,
} from "@/hooks/use-crm-payments";
import type { PaymentStatus } from "@/lib/crm-payment-allocation";
import {
  crmRenewalWindowLabel,
  isCrmAccountInRenewalWindow,
} from "@/lib/crm-account-renewal";
import { crmAccountStatusLabel } from "@/lib/crm-account-status";
import {
  crmPaymentsSearchSchema,
  crmPaymentsSearchToApiFilters,
  parseCrmPaymentStatusTab,
  type CrmPaymentStatusTabId,
} from "@/lib/crm-payments-search";
import { cn, formatDate } from "@/lib/utils";
import { useCrmAccountStore } from "@/stores";

export const Route = createFileRoute("/crm/payments")({
  validateSearch: (search) => crmPaymentsSearchSchema.parse(search),
  component: CrmPaymentsPage,
});

const STATUS_TABS: { id: CrmPaymentStatusTabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "due_this_week", label: "This week" },
  { id: "due_this_month", label: "This month" },
  { id: "due_in_45_days", label: "45 days" },
  { id: "due_in_90_days", label: "90 days" },
  { id: "upcoming", label: "Later" },
  { id: "fully_paid", label: "Fully paid" },
  { id: "renewal", label: "Renewal payments" },
  { id: "suspended", label: "Suspend" },
  { id: "suspend_and_close", label: "Suspend and Close" },
  { id: "inactive", label: "Inactive" },
];

type ManagerField = "salesManagerName" | "supportManager1" | "supportManager2";

function buildManagerFilterOptions(
  accounts: { salesManagerName?: string; supportManager1?: string; supportManager2?: string }[],
  field: ManagerField,
) {
  const names = new Set<string>();
  for (const a of accounts) {
    const n = a[field]?.trim();
    if (n) names.add(n);
  }
  return [
    { value: "all", label: "All" },
    { value: "unassigned", label: "Unassigned" },
    ...[...names].sort().map((n) => ({ value: n, label: n })),
  ];
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
    renewal: {
      label: "Renewal",
      className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
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
  const accounts = useCrmAccountStore((s) => s.accounts);
  const markRenewalCancelled = useCrmAccountStore((s) => s.markRenewalCancelled);

  const statusTab = parseCrmPaymentStatusTab(search.status);
  const page = search.page ?? 1;
  const pageSize = useMemo(() => {
    if (search.pageSize) return search.pageSize;
    try {
      const raw = window.localStorage.getItem("buildesk.table.pageSize");
      const n = raw ? Number(raw) : NaN;
      if (n === 15 || n === 50 || n === 100) return n;
    } catch {
      /* ignore */
    }
    return 15;
  }, [search.pageSize]);

  const [searchDraft, setSearchDraft] = useState(search.search ?? "");
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [executiveDigestOpen, setExecutiveDigestOpen] = useState(false);
  const [renewAccountId, setRenewAccountId] = useState<string | null>(null);
  const [renewalCancelId, setRenewalCancelId] = useState<string | null>(null);
  const [cancellingRenewal, setCancellingRenewal] = useState(false);
  const renewAccount = useMemo(
    () => (renewAccountId ? accounts.find((a) => a.id === renewAccountId) ?? null : null),
    [accounts, renewAccountId],
  );

  useEffect(() => {
    setSearchDraft(search.search ?? "");
  }, [search.search]);

  useEffect(() => {
    if (search.pageSize) return;
    let stored = 15;
    try {
      const n = Number(window.localStorage.getItem("buildesk.table.pageSize"));
      if (n === 50 || n === 100) stored = n;
    } catch {
      /* ignore */
    }
    if (stored === 15) return;
    void navigate({
      search: (prev: typeof search) => ({ ...prev, pageSize: stored }),
      replace: true,
    });
  }, [search.pageSize, navigate]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchDraft.trim();
      if ((search.search ?? "") === trimmed) return;
      void navigate({
        search: (prev: typeof search) => ({
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

  const salesManagerOptions = useMemo(
    () => buildManagerFilterOptions(accounts, "salesManagerName"),
    [accounts],
  );
  const supportManager1Options = useMemo(
    () => buildManagerFilterOptions(accounts, "supportManager1"),
    [accounts],
  );
  const supportManager2Options = useMemo(
    () => buildManagerFilterOptions(accounts, "supportManager2"),
    [accounts],
  );

  const statusTabItems = useMemo(
    () =>
      STATUS_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        count: statusCounts?.[tab.id as keyof typeof statusCounts] ?? 0,
      })),
    [statusCounts],
  );

  const patchSearch = useCallback(
    (patch: Partial<typeof search>) => {
      void navigate({
        search: (prev: typeof search) => {
          const next = { ...prev, ...patch };
          const resetsPage =
            "status" in patch ||
            "salesManager" in patch ||
            "supportManager1" in patch ||
            "supportManager2" in patch ||
            "dueDateFrom" in patch ||
            "dueDateTo" in patch ||
            "sortBy" in patch;
          if (resetsPage) next.page = undefined;
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const onStatusFilter = useCallback(
    (id: CrmPaymentStatusTabId) => {
      patchSearch({ status: id === "all" ? undefined : id });
    },
    [patchSearch],
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
      const filters = crmPaymentsSearchToApiFilters({ ...search, page: 1 });
      const { exportCrmPayments } = await import("@/lib/api");
      const data = await exportCrmPayments({ data: filters });
      const header = [
        "Account",
        "Support 1",
        "Support 2",
        "Sales manager",
        "Deal date",
        "Users",
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
          r.supportManager1 ?? "",
          r.supportManager2 ?? "",
          r.salesManager ?? "",
          r.dealDate ?? "",
          r.usersPurchased ?? "",
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
  const accountCount = summary?.accountCount ?? total;

  return (
    <PageWrap compact>
      <div className="space-y-2.5 pb-3">
        <PaymentsHeader
          accountCount={accountCount}
          selectedCount={selectedIds.size}
          reminding={bulkRemind.isPending}
          onSendReminders={() => void handleBulkRemind()}
          onRemindExecutives={() => setExecutiveDigestOpen(true)}
          onExport={() => void handleExport()}
          onBulkUpdate={() => setBulkPaymentOpen(true)}
        />

        <PaymentsKpiCards summary={summary} loading={summaryQuery.isLoading} />

        <PaymentsUpcomingPerformance
          summary={summary}
          loading={summaryQuery.isLoading}
          onFilter={onStatusFilter}
        />

        <PaymentsLostSummary
          summary={summary}
          loading={summaryQuery.isLoading}
          onFilter={onStatusFilter}
        />

        <PaymentsAnalytics summary={summary} loading={summaryQuery.isLoading} />

        <PaymentsStatusTabs tabs={statusTabItems} active={statusTab} onChange={onStatusFilter} />

        <div className="space-y-1.5">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search account…"
              aria-label="Search account"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <DesignTicketFilterBar
            variant="inline"
            onClear={() =>
              void navigate({
                search: (prev: typeof search) => ({
                  ...prev,
                  salesManager: undefined,
                  supportManager1: undefined,
                  supportManager2: undefined,
                  dueDateFrom: undefined,
                  dueDateTo: undefined,
                  sortBy: undefined,
                  sortDir: undefined,
                  page: undefined,
                }),
                replace: true,
              })
            }
          >
            <DesignTicketFilterField label="Support 1" className="min-w-[8.5rem]">
              <DesignTicketSelect
                compact
                value={search.supportManager1 ?? "all"}
                onChange={(v) =>
                  patchSearch({ supportManager1: v === "all" ? undefined : v })
                }
                options={supportManager1Options}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Support 2" className="min-w-[8.5rem]">
              <DesignTicketSelect
                compact
                value={search.supportManager2 ?? "all"}
                onChange={(v) =>
                  patchSearch({ supportManager2: v === "all" ? undefined : v })
                }
                options={supportManager2Options}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Sales manager" className="min-w-[8.5rem]">
              <DesignTicketSelect
                compact
                value={search.salesManager ?? "all"}
                onChange={(v) =>
                  patchSearch({ salesManager: v === "all" ? undefined : v })
                }
                options={salesManagerOptions}
              />
            </DesignTicketFilterField>
            <DesignTicketDateField
              compact
              label={statusTab === "renewal" ? "Renewal from" : "Due from"}
              value={search.dueDateFrom ?? ""}
              onChange={(v) => patchSearch({ dueDateFrom: v || undefined })}
            />
            <DesignTicketDateField
              compact
              label={statusTab === "renewal" ? "Renewal to" : "Due to"}
              value={search.dueDateTo ?? ""}
              onChange={(v) => patchSearch({ dueDateTo: v || undefined })}
            />
            <DesignTicketFilterField label="Sort" className="min-w-[9rem]">
              <DesignTicketSelect
                compact
                value={`${search.sortBy ?? (statusTab === "renewal" ? "renewalDate" : "nextDueDate")}:${search.sortDir ?? "asc"}`}
                onChange={(v) => {
                  const [sortBy, sortDir] = v.split(":") as [
                    "nextDueDate" | "overdueAmount" | "collectionPercent" | "renewalDate",
                    "asc" | "desc",
                  ];
                  patchSearch({
                    sortBy:
                      sortBy === "nextDueDate" && statusTab !== "renewal"
                        ? undefined
                        : sortBy === "renewalDate" && statusTab === "renewal"
                          ? undefined
                          : sortBy,
                    sortDir: sortDir === "asc" ? undefined : sortDir,
                  });
                }}
                options={[
                  ...(statusTab === "renewal"
                    ? [
                        { value: "renewalDate:asc", label: "Renewal ↑" },
                        { value: "renewalDate:desc", label: "Renewal ↓" },
                      ]
                    : [
                        { value: "nextDueDate:asc", label: "Next due ↑" },
                        { value: "nextDueDate:desc", label: "Next due ↓" },
                      ]),
                  { value: "overdueAmount:desc", label: "Overdue ↓" },
                  { value: "collectionPercent:asc", label: "Collected % ↑" },
                  { value: "collectionPercent:desc", label: "Collected % ↓" },
                ]}
              />
            </DesignTicketFilterField>
          </DesignTicketFilterBar>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
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
          <p className="rounded-xl border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            Loading payments…
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {total === 0 && !search.search && statusTab === "all"
              ? "No payment data yet — payments appear when accounts have deal values and installments."
              : "No results match your filters."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm [&_tbody_tr]:bg-card [&_thead]:bg-card">
            <DataTable
              flush
              data={rows}
              getRowId={(r) => r.id}
              hideSearch
              pageSize={Math.max(rows.length, 1)}
              pageSizeOptions={[]}
              density="compact"
              expandedRowIds={expandedRowIds}
              onRowClick={(r) => toggleExpanded(r.id)}
              getRowClassName={(r) =>
                isCrmAccountInRenewalWindow({ endDate: r.renewalDate })
                  ? "border-amber-500/50 bg-amber-500/[0.07] dark:bg-amber-500/10"
                  : undefined
              }
              selection={{
                selectedIds,
                onToggle: toggleSelection,
                onToggleAll: toggleSelectionAll,
              }}
              renderExpandedRow={(r) => <CrmPaymentsExpandedRow row={r} search={search} />}
              actions={(r) => {
                const canRenew = isCrmAccountInRenewalWindow({ endDate: r.renewalDate });
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        aria-label="Row actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                      {canRenew ? (
                        <DropdownMenuItem
                          onClick={() => setRenewAccountId(r.id)}
                          className="text-xs"
                        >
                          Renew
                        </DropdownMenuItem>
                      ) : null}
                      {r.renewalCancelled ? null : (
                        <DropdownMenuItem
                          disabled={cancellingRenewal}
                          onClick={() => setRenewalCancelId(r.id)}
                          className="text-xs"
                        >
                          Renewal cancelled
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild className="text-xs">
                        <Link to="/crm/accounts/$accountId" params={{ accountId: r.id }}>
                          View account
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }}
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {crmAccountStatusLabel(r.accountStatus)}
                        </span>
                        {r.lostKind ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-1.5 text-[9px] font-medium",
                              r.lostKind === "sales_lost"
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                : "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
                            )}
                          >
                            {r.lostKind === "sales_lost" ? "Sales Lost" : "Customer Lost"}
                            {typeof r.lostValue === "number"
                              ? ` · ${formatPaymentsInr(r.lostValue)}`
                              : ""}
                          </Badge>
                        ) : null}
                      </div>
                      {crmRenewalWindowLabel({ endDate: r.renewalDate }) ? (
                        <div className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          {crmRenewalWindowLabel({ endDate: r.renewalDate })}
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "totalDealValue",
                  header: "Deal value",
                  render: (r) => (
                    <span className="tabular-nums text-xs">
                      {formatPaymentsInr(r.totalDealValue)}
                    </span>
                  ),
                },
                {
                  key: "payment",
                  header: "Payment",
                  render: (r) => (
                    <div className="text-xs">
                      <div className="tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatPaymentsInr(r.paymentReceived)}
                      </div>
                      <div className="tabular-nums text-muted-foreground">
                        {formatPaymentsInr(r.pendingAmount)} pending
                      </div>
                      {r.renewalAmount > 0.01 ? (
                        <div className="text-[10px] text-violet-600 dark:text-violet-400">
                          Renewal {formatPaymentsInr(r.renewalAmount)}
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "nextDue",
                  header: statusTab === "renewal" ? "Renewal date" : "Next due",
                  render: (r) =>
                    statusTab === "renewal" ? (
                      r.renewalDate ? (
                        <span className="text-xs tabular-nums">{formatDate(r.renewalDate)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No end date</span>
                      )
                    ) : r.nextDueInstallment ? (
                      <div className="text-xs">
                        <div className="tabular-nums font-medium">
                          {formatPaymentsInr(r.nextDueInstallment.remainingAmount)}
                          {r.nextDueInstallment.remainingAmount < r.nextDueInstallment.amount ? (
                            <span className="ml-1 font-normal text-muted-foreground">
                              / {formatPaymentsInr(r.nextDueInstallment.amount)}
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
                      <div className="text-xs">
                        <div className="tabular-nums font-medium text-destructive">
                          {formatPaymentsInr(r.overdueAmount)}
                        </div>
                        {r.overdueDays != null ? (
                          <div className="text-[10px] text-destructive/80">{r.overdueDays}d overdue</div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    ),
                },
                {
                  key: "collectionPercent",
                  header: "Progress",
                  render: (r) => (
                    <div className="min-w-[5.5rem]">
                      <div className="mb-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {Math.min(r.collectionPercent, 100)}%
                        {r.renewalAmount > 0.01 ? " + renewal" : ""}
                      </div>
                      <ProgressBar value={Math.min(r.collectionPercent, 100)} className="h-1.5" />
                    </div>
                  ),
                },
                {
                  key: "salesManager",
                  header: "Executive",
                  render: (r) =>
                    r.salesManager?.trim() ? (
                      <span className="text-xs">{r.salesManager}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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
                        className={cn("rounded-full px-2 text-[10px] font-medium", badge.className)}
                      >
                        {badge.label}
                      </Badge>
                    );
                  },
                },
              ]}
            />

            {total > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2.5 text-[11px] text-muted-foreground">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 tabular-nums">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                  </span>
                  <label className="inline-flex items-center gap-1.5">
                    <span>Rows</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        try {
                          window.localStorage.setItem("buildesk.table.pageSize", String(next));
                        } catch {
                          /* ignore */
                        }
                        patchSearch({
                          pageSize: next === 15 ? undefined : next,
                          page: undefined,
                        });
                      }}
                      className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px] text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                      aria-label="Rows per page"
                    >
                      {[15, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
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
      </div>

      <CrmAccountPaymentBulkUpdateModal open={bulkPaymentOpen} onOpenChange={setBulkPaymentOpen} />
      <CrmExecutivePaymentReminderDialog
        open={executiveDigestOpen}
        onOpenChange={setExecutiveDigestOpen}
        accountIdsScope={selectedIds.size > 0 ? [...selectedIds] : undefined}
      />
      <ConfirmDeleteDialog
        open={Boolean(renewalCancelId)}
        onOpenChange={(open) => {
          if (!open && !cancellingRenewal) setRenewalCancelId(null);
        }}
        title="Mark renewal cancelled?"
        description={
          renewalCancelId
            ? `${rows.find((row) => row.id === renewalCancelId)?.accountName ?? "This account"} will be Suspend and Close. The full deal value (${formatPaymentsInr(rows.find((row) => row.id === renewalCancelId)?.totalDealValue ?? 0)}) is counted as Customer Lost.`
            : undefined
        }
        confirmLabel="Renewal cancelled"
        confirmTone="destructive"
        onConfirm={() => {
          if (!renewalCancelId) return;
          const accountId = renewalCancelId;
          setCancellingRenewal(true);
          void markRenewalCancelled(accountId)
            .then(async () => {
              toast.success("Renewal cancelled. Full deal value is Customer Lost.");
              setRenewalCancelId(null);
              await Promise.all([listQuery.refetch(), summaryQuery.refetch()]);
            })
            .catch((error) => {
              toast.error(error instanceof Error ? error.message : "Could not mark renewal cancelled");
            })
            .finally(() => setCancellingRenewal(false));
        }}
      />
      <CrmAccountRenewDialog
        account={renewAccount}
        open={Boolean(renewAccount)}
        onOpenChange={(open) => {
          if (!open) setRenewAccountId(null);
        }}
        onRenewed={() => {
          void listQuery.refetch();
          void summaryQuery.refetch();
        }}
      />
    </PageWrap>
  );
}
