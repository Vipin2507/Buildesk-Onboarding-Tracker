import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, ChevronRight, MoreHorizontal, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CrmAccountPaymentBulkUpdateModal } from "@/components/crm/crm-account-payment-bulk-update-modal";
import { CrmAccountRenewDialog } from "@/components/crm/crm-account-renew-dialog";
import { CrmExecutivePaymentReminderDialog } from "@/components/crm/crm-executive-payment-reminder-dialog";
import { CrmPaymentsExpandedRow } from "@/components/crm/crm-payments-expanded-row";
import {
  CrmRenewalYearMatchDialog,
  type RenewalYearUnmatchedRow,
} from "@/components/crm/crm-renewal-year-match-dialog";
import { PaymentsAnalysisBoard } from "@/components/crm/payments/payments-analysis-board";
import { PaymentsSeatTab } from "@/components/crm/payments/payments-seat-tab";
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
import { crmRenewalWindowLabel, isCrmAccountInRenewalWindow } from "@/lib/crm-account-renewal";
import { matchRenewalYearAccount, parseRenewalYearSheet, type RenewalYearSheetRow } from "@/lib/crm-renewal-years";
import { isAdminRoleKey } from "@/lib/permissions";
import { crmAccountStatusLabel } from "@/lib/crm-account-status";
import {
  crmPaymentsSearchSchema,
  crmPaymentsSearchToApiFilters,
  parseCrmPaymentStatusTab,
  type CrmPaymentStatusTabId,
  type CrmPaymentsSearch,
} from "@/lib/crm-payments-search";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore, useCrmAccountStore } from "@/stores";

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

function localYmd(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function paymentWindowPreset(preset: "month" | "30" | "90" | "quarter") {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  if (preset === "month") {
    from.setDate(1);
    to.setMonth(to.getMonth() + 1, 0);
  } else if (preset === "30") {
    to.setDate(to.getDate() + 30);
  } else if (preset === "90") {
    to.setDate(to.getDate() + 90);
  } else {
    const quarterStart = Math.floor(today.getMonth() / 3) * 3;
    from.setMonth(quarterStart, 1);
    to.setMonth(quarterStart + 3, 0);
  }
  return { from: localYmd(from), to: localYmd(to) };
}

const WINDOW_PRESETS = [
  { id: "month", label: "This month" },
  { id: "30", label: "Next 30 days" },
  { id: "90", label: "Next 90 days" },
  { id: "quarter", label: "This quarter" },
] as const;

type PaymentDateTarget = "all" | "start" | "installment" | "renewal";
type PaymentWindowChoice = (typeof WINDOW_PRESETS)[number]["id"] | "any" | "custom";

function paymentDateTarget(search: {
  installmentFrom?: string;
  installmentTo?: string;
  renewalFrom?: string;
  renewalTo?: string;
  startFrom?: string;
  startTo?: string;
}): PaymentDateTarget {
  const renewal = Boolean(search.renewalFrom || search.renewalTo);
  const installment = Boolean(search.installmentFrom || search.installmentTo);
  const start = Boolean(search.startFrom || search.startTo);
  const active = [start, installment, renewal].filter(Boolean).length;
  if (active !== 1) return "all";
  if (start) return "start";
  if (renewal) return "renewal";
  return "installment";
}

function paymentDateRange(
  search: {
    installmentFrom?: string;
    installmentTo?: string;
    renewalFrom?: string;
    renewalTo?: string;
    startFrom?: string;
    startTo?: string;
  },
  target: PaymentDateTarget,
) {
  if (target === "start") {
    return { from: search.startFrom ?? "", to: search.startTo ?? "" };
  }
  if (target === "renewal") {
    return { from: search.renewalFrom ?? "", to: search.renewalTo ?? "" };
  }
  if (target === "installment") {
    return { from: search.installmentFrom ?? "", to: search.installmentTo ?? "" };
  }
  return {
    from: search.installmentFrom ?? search.renewalFrom ?? search.startFrom ?? "",
    to: search.installmentTo ?? search.renewalTo ?? search.startTo ?? "",
  };
}

function paymentWindowChoice(from: string, to: string): PaymentWindowChoice {
  if (!from && !to) return "any";
  for (const preset of WINDOW_PRESETS) {
    const range = paymentWindowPreset(preset.id);
    if (range.from === from && range.to === to) return preset.id;
  }
  return "custom";
}

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
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const accounts = useCrmAccountStore((s) => s.accounts);
  const markRenewalCancelled = useCrmAccountStore((s) => s.markRenewalCancelled);

  const statusTab = parseCrmPaymentStatusTab(search.status);
  const view = search.view ?? "ledger";
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
  const [uploadingYears, setUploadingYears] = useState(false);
  const [yearMatchOpen, setYearMatchOpen] = useState(false);
  const [yearMatchRows, setYearMatchRows] = useState<RenewalYearUnmatchedRow[]>([]);
  const [yearMatchSaved, setYearMatchSaved] = useState(0);
  const [yearMatchReserved, setYearMatchReserved] = useState<string[]>([]);
  const yearFileRef = useRef<HTMLInputElement>(null);
  const isAdmin = isAdminRoleKey(useAuthStore((s) => s.user?.role));
  const renewAccount = useMemo(
    () => (renewAccountId ? (accounts.find((a) => a.id === renewAccountId) ?? null) : null),
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

  const listQuery = useCrmPaymentsList(search, view === "ledger");
  const summaryQuery = useCrmPaymentsSummary(search, view !== "seats");
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
            "installmentFrom" in patch ||
            "installmentTo" in patch ||
            "renewalFrom" in patch ||
            "renewalTo" in patch ||
            "startFrom" in patch ||
            "startTo" in patch ||
            "scenario" in patch ||
            "collection" in patch ||
            "sortBy" in patch ||
            "sortDir" in patch;
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

  async function importRenewalRows(
    rows: { accountName: string; accountId?: string; years: RenewalYearSheetRow["years"] }[],
  ) {
    const { importCrmAccountRenewalYears } = await import("@/lib/api");
    return importCrmAccountRenewalYears({ data: { rows } });
  }

  async function handleYearFile(file: File) {
    setUploadingYears(true);
    try {
      const parsed = parseRenewalYearSheet(await file.arrayBuffer());
      if (parsed.rows.length === 0) {
        toast.error(parsed.errors[0] ?? "Could not read the sheet");
        return;
      }
      const catalog = accounts.map((account) => ({ id: account.id, name: account.name }));
      const matched: { row: RenewalYearSheetRow; accountId: string }[] = [];
      const unmatched: RenewalYearUnmatchedRow[] = [];
      parsed.rows.forEach((row, index) => {
        const hit = matchRenewalYearAccount(row.accountName, catalog);
        if (hit.accountId) matched.push({ row, accountId: hit.accountId });
        else {
          unmatched.push({
            key: `${index}-${row.accountName}`,
            row,
            reason: hit.reason ?? "No matching CRM account.",
          });
        }
      });
      if (matched.length > 0) {
        await importRenewalRows(
          matched.map((item) => ({
            accountName: item.row.accountName,
            accountId: item.accountId,
            years: item.row.years,
          })),
        );
        await listQuery.refetch();
        void queryClient.invalidateQueries({ queryKey: ["crm-account-renewal-years"] });
      }
      if (unmatched.length > 0) {
        setYearMatchRows(unmatched);
        setYearMatchSaved(matched.length);
        setYearMatchReserved(matched.map((item) => item.accountId));
        setYearMatchOpen(true);
        toast.message(
          matched.length > 0
            ? `Saved ${matched.length}. ${unmatched.length} names need a manual match.`
            : `${unmatched.length} names need a manual match.`,
        );
        return;
      }
      toast.success(`Saved yearly deals for ${matched.length} accounts.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingYears(false);
    }
  }

  async function saveYearMatches(picks: { key: string; accountId: string }[]) {
    const byKey = new Map(yearMatchRows.map((row) => [row.key, row]));
    setUploadingYears(true);
    try {
      const result = await importRenewalRows(
        picks.flatMap((pick) => {
          const item = byKey.get(pick.key);
          if (!item) return [];
          return [
            {
              accountName: item.row.accountName,
              accountId: pick.accountId,
              years: item.row.years,
            },
          ];
        }),
      );
      await listQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["crm-account-renewal-years"] });
      toast.success(`Saved yearly deals for ${result.saved} more accounts.`);
      setYearMatchOpen(false);
      setYearMatchRows([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingYears(false);
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
        "Renewals",
        "Total value",
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
          r.renewalCount,
          r.lifetimeValue,
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
  const dateTarget = paymentDateTarget(search);
  const dateRange = paymentDateRange(search, dateTarget);
  const dateChoice = paymentWindowChoice(dateRange.from, dateRange.to);

  function applyPaymentDates(target: PaymentDateTarget, from?: string, to?: string) {
    const start = from || undefined;
    const end = to || undefined;
    if (target === "all") {
      patchSearch({
        installmentFrom: start,
        installmentTo: end,
        renewalFrom: start,
        renewalTo: end,
        startFrom: start,
        startTo: end,
      });
      return;
    }
    if (target === "start") {
      patchSearch({
        startFrom: start,
        startTo: end,
        installmentFrom: undefined,
        installmentTo: undefined,
        renewalFrom: undefined,
        renewalTo: undefined,
      });
      return;
    }
    if (target === "installment") {
      patchSearch({
        installmentFrom: start,
        installmentTo: end,
        renewalFrom: undefined,
        renewalTo: undefined,
        startFrom: undefined,
        startTo: undefined,
      });
      return;
    }
    patchSearch({
      renewalFrom: start,
      renewalTo: end,
      installmentFrom: undefined,
      installmentTo: undefined,
      startFrom: undefined,
      startTo: undefined,
    });
  }

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 space-y-2.5 border-b border-border pb-2.5 pt-1">
        <PaymentsHeader
          accountCount={accountCount}
          selectedCount={selectedIds.size}
          reminding={bulkRemind.isPending}
          onSendReminders={() => void handleBulkRemind()}
          onRemindExecutives={() => setExecutiveDigestOpen(true)}
          onExport={() => void handleExport()}
          onBulkUpdate={() => setBulkPaymentOpen(true)}
          onUploadYears={
            isAdmin
              ? () => {
                  if (!uploadingYears) yearFileRef.current?.click();
                }
              : undefined
          }
        />
        <input
          ref={yearFileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleYearFile(file);
          }}
        />

        <div className="flex w-fit rounded-full border bg-card p-0.5">
          {(
            [
              { id: "ledger", label: "Payments" },
              { id: "analysis", label: "Analysis" },
              { id: "seats", label: "Seat value" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => patchSearch({ view: item.id === "ledger" ? undefined : item.id })}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium",
                view === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {view === "ledger" ? (
          <>
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
            <PaymentsStatusTabs
              tabs={statusTabItems}
              active={statusTab}
              onChange={onStatusFilter}
            />
          </>
        ) : null}

        {view === "seats" ? null : (
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
            className="sm:!grid-cols-3 lg:!grid-cols-6"
            onClear={() => {
              void navigate({
                search: (prev: typeof search) => ({
                  ...prev,
                  salesManager: undefined,
                  supportManager1: undefined,
                  supportManager2: undefined,
                  dueDateFrom: undefined,
                  dueDateTo: undefined,
                  installmentFrom: undefined,
                  installmentTo: undefined,
                  renewalFrom: undefined,
                  renewalTo: undefined,
                  startFrom: undefined,
                  startTo: undefined,
                  scenario: undefined,
                  collection: undefined,
                  sortBy: undefined,
                  sortDir: undefined,
                  page: undefined,
                }),
                replace: true,
              });
            }}
          >
            <DesignTicketFilterField label="Support 1" compact className="min-w-0">
              <DesignTicketSelect
                compact
                value={search.supportManager1 ?? "all"}
                onChange={(v) => patchSearch({ supportManager1: v === "all" ? undefined : v })}
                options={supportManager1Options}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Support 2" compact className="min-w-0">
              <DesignTicketSelect
                compact
                value={search.supportManager2 ?? "all"}
                onChange={(v) => patchSearch({ supportManager2: v === "all" ? undefined : v })}
                options={supportManager2Options}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Sales manager" compact className="min-w-0">
              <DesignTicketSelect
                compact
                value={search.salesManager ?? "all"}
                onChange={(v) => patchSearch({ salesManager: v === "all" ? undefined : v })}
                options={salesManagerOptions}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Scenario" compact className="min-w-0">
              <DesignTicketSelect
                compact
                value={search.scenario ?? "all"}
                onChange={(v) =>
                  patchSearch({
                    scenario: v === "installment" || v === "renewal" ? v : undefined,
                  })
                }
                options={[
                  { value: "all", label: "All accounts" },
                  { value: "installment", label: "Open installments" },
                  { value: "renewal", label: "Renewals" },
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Collected" compact className="min-w-0">
              <DesignTicketSelect
                compact
                value={search.collection ?? "all"}
                onChange={(v) =>
                  patchSearch({
                    collection:
                      v === "under_50" || v === "50_to_90" || v === "over_90" ? v : undefined,
                  })
                }
                options={[
                  { value: "all", label: "Any %" },
                  { value: "under_50", label: "Under 50%" },
                  { value: "50_to_90", label: "50–90%" },
                  { value: "over_90", label: "90%+" },
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Date applies to" compact className="min-w-0">
              <DesignTicketSelect
                compact
                value={dateTarget}
                onChange={(value) => {
                  const target: PaymentDateTarget =
                    value === "renewal" || value === "start" || value === "all" ? value : "installment";
                  applyPaymentDates(target, dateRange.from, dateRange.to);
                }}
                options={[
                  { value: "all", label: "All" },
                  { value: "start", label: "Start date" },
                  { value: "installment", label: "Installment due" },
                  { value: "renewal", label: "Renewal date" },
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketFilterField label="Range" compact className="min-w-0">
              <DesignTicketSelect
                compact
                value={dateChoice}
                onChange={(value) => {
                  if (value === "custom") return;
                  if (value === "any") {
                    applyPaymentDates(dateTarget);
                    return;
                  }
                  const range = paymentWindowPreset(value as (typeof WINDOW_PRESETS)[number]["id"]);
                  applyPaymentDates(dateTarget, range.from, range.to);
                }}
                options={[
                  { value: "any", label: "Any date" },
                  ...WINDOW_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
                  { value: "custom", label: "Custom range" },
                ]}
              />
            </DesignTicketFilterField>
            <DesignTicketDateField
              compact
              label="From"
              className="min-w-0"
              value={dateRange.from}
              onChange={(value) => applyPaymentDates(dateTarget, value, dateRange.to)}
            />
            <DesignTicketDateField
              compact
              label="To"
              className="min-w-0"
              value={dateRange.to}
              onChange={(value) => applyPaymentDates(dateTarget, dateRange.from, value)}
            />
          </DesignTicketFilterBar>
        </div>
        )}
      </div>

      {view === "ledger" && selectedIds.size > 0 ? (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/5 px-0 py-2 text-xs">
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

      {view === "seats" ? (
        <PaymentsSeatTab />
      ) : view === "analysis" ? (
        <PaymentsAnalysisBoard summary={summary} loading={summaryQuery.isLoading} />
      ) : listQuery.isLoading && !listQuery.data ? (
        <p className="px-0 py-8 text-center text-sm text-muted-foreground">Loading payments…</p>
      ) : rows.length === 0 ? (
        <div className="border-t px-0 py-8 text-center text-sm text-muted-foreground">
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
            pageSize={Math.max(rows.length, 1)}
            pageSizeOptions={[]}
            density="compact"
            sortKey={search.sortBy ?? (statusTab === "renewal" ? "renewalDate" : "nextDueDate")}
            sortDir={search.sortDir ?? "asc"}
            onSortChange={(key, dir) =>
              patchSearch({
                sortBy: key as CrmPaymentsSearch["sortBy"],
                sortDir: dir === "asc" ? undefined : dir,
              })
            }
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
            renderExpandedRow={(r) => (
              <CrmPaymentsExpandedRow
                row={r}
                search={search}
                onRenew={
                  isCrmAccountInRenewalWindow({ endDate: r.renewalDate })
                    ? () => setRenewAccountId(r.id)
                    : undefined
                }
              />
            )}
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
                  <DropdownMenuContent
                    align="end"
                    className="w-44"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canRenew ? (
                      <DropdownMenuItem onClick={() => setRenewAccountId(r.id)} className="text-xs">
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
                sortable: true,
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
                key: "supportManager1",
                header: "Support 1",
                sortable: true,
                render: (r) =>
                  r.supportManager1?.trim() ? (
                    <span className="text-xs">{r.supportManager1}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                key: "supportManager2",
                header: "Support 2",
                sortable: true,
                render: (r) =>
                  r.supportManager2?.trim() ? (
                    <span className="text-xs">{r.supportManager2}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                key: "salesManager",
                header: "Sales manager",
                sortable: true,
                render: (r) =>
                  r.salesManager?.trim() ? (
                    <span className="text-xs">{r.salesManager}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                key: "totalDealValue",
                header: "Deal value",
                sortable: true,
                render: (r) => (
                  <span className="tabular-nums text-xs">
                    {formatPaymentsInr(r.totalDealValue)}
                  </span>
                ),
              },
              {
                key: "renewalCount",
                header: "Renewals",
                sortable: true,
                render: (r) => (
                  <div className="text-xs">
                    <div className="tabular-nums font-medium">{r.renewalCount}</div>
                    {r.renewalYearsKnown && !r.renewedThisYear ? (
                      <div className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        Not this year
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "lifetimeValue",
                header: "Total value",
                sortable: true,
                render: (r) => (
                  <span className="tabular-nums text-xs">{formatPaymentsInr(r.lifetimeValue)}</span>
                ),
              },
              {
                key: "payment",
                header: "Payment",
                sortable: true,
                sortKey: "paymentReceived",
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
                sortable: true,
                sortKey: statusTab === "renewal" ? "renewalDate" : "nextDueDate",
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
                sortable: true,
                sortKey: "overdueAmount",
                render: (r) =>
                  r.overdueAmount > 0 ? (
                    <div className="text-xs">
                      <div className="tabular-nums font-medium text-destructive">
                        {formatPaymentsInr(r.overdueAmount)}
                      </div>
                      {r.overdueDays != null ? (
                        <div className="text-[10px] text-destructive/80">
                          {r.overdueDays}d overdue
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                key: "collectionPercent",
                header: "Progress",
                sortable: true,
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
                key: "paymentStatus",
                header: "Status",
                sortable: true,
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-0 pb-3 text-[11px] text-muted-foreground">
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
              toast.error(
                error instanceof Error ? error.message : "Could not mark renewal cancelled",
              );
            })
            .finally(() => setCancellingRenewal(false));
        }}
      />
      <CrmRenewalYearMatchDialog
        key={yearMatchRows.map((row) => row.key).join("|")}
        open={yearMatchOpen}
        onOpenChange={setYearMatchOpen}
        savedCount={yearMatchSaved}
        rows={yearMatchRows}
        accounts={accounts.map((account) => ({ id: account.id, name: account.name }))}
        reservedAccountIds={yearMatchReserved}
        saving={uploadingYears}
        onSave={(picks) => void saveYearMatches(picks)}
      />
      <CrmAccountRenewDialog
        account={renewAccount}
        cycleCollected={
          renewAccountId
            ? rows.find((row) => row.id === renewAccountId)?.paymentReceived
            : undefined
        }
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
