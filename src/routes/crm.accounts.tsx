import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  CalendarRange,
  FileSpreadsheet,
  MessageSquarePlus,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CrmAccountBulkUploadModal } from "@/components/crm/crm-account-bulk-upload-modal";
import { CrmAccountClientTransferModal } from "@/components/crm/crm-account-client-transfer-modal";
import { CrmCreateAccountQueryModal } from "@/components/crm/crm-create-account-query-modal";
import { CrmAccountDateBulkUploadModal } from "@/components/crm/crm-account-date-bulk-upload-modal";
import { CrmAccountGoLiveActions } from "@/components/crm/crm-account-go-live-actions";
import { CrmAccountModulesCell } from "@/components/crm/crm-account-modules-cell";
import { CrmAccountStatusRemarksNote } from "@/components/crm/crm-account-status-remarks-modal";
import {
  CrmAccountFormFields,
  crmAccountSchema,
  crmAccountToFormValues,
  emptyCrmAccountForm,
  normalizeCrmAccountForm,
  type CrmAccountFormValues,
} from "@/components/crm/crm-account-form";
import {
  DesignTicketDateField,
  DesignTicketFilterField,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import { DesignTicketFilterBar } from "@/components/design-ticket/design-ticket-shared";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { inDateRange } from "@/components/list-toolbar";
import { PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CRM_STAGE_LABELS } from "@/data/crm-onboarding-defaults";
import { cn, formatDate } from "@/lib/utils";
import {
  useAuthStore,
  useCompanyPortalStore,
  useCrmAccountStore,
  useCrmOnboardingStore,
} from "@/stores";
import {
  useCrmDashboardOverview,
  type CrmAccountRow,
} from "@/stores/crm-dashboard-selectors";
import { sortCrmAccountsByStartDateDesc } from "@/lib/crm-account-sort";
import { isValidPortalSlug, normalizePortalSlug } from "@/lib/design-ticket-portal";
import { getCrmMasterProductModuleCatalog } from "@/stores/useCrmMasterStore";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";
import { COMPANY_TYPES } from "@/types/company";
import type { CrmAccount } from "@/types/crm-account";

export const Route = createFileRoute("/crm/accounts")({
  component: CrmAccountsLayout,
});

type AccountKpiFilter = "all" | "onboarding" | "live" | "critical";

const STATUS_CHIPS = [
  { id: "all", label: "All", status: null as CrmAccount["status"] | null },
  { id: "onboarding", label: "Onboarding", status: "onboarding" as const },
  { id: "live", label: "Live", status: "live" as const },
  { id: "active", label: "Active", status: "active" as const },
  { id: "suspended", label: "Suspended", status: "suspended" as const },
  { id: "inactive", label: "Inactive", status: "inactive" as const },
  { id: "closed", label: "Closed", status: "closed" as const },
  { id: "critical", label: "Critical", status: null },
] as const;

type AccountFilterPillId = (typeof STATUS_CHIPS)[number]["id"];

type AccountFilterTone = "muted" | "warning" | "success" | "info" | "danger";

const FILTER_BOX_COUNT_TONE: Record<AccountFilterTone, string> = {
  muted: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-primary",
  danger: "text-destructive",
};

function filterPillTone(id: AccountFilterPillId): AccountFilterTone {
  if (id === "onboarding") return "warning";
  if (id === "live") return "success";
  if (id === "critical") return "danger";
  if (id === "active") return "info";
  return "muted";
}

function isAccountFilterPillActive(
  id: AccountFilterPillId,
  statusFilter: string,
  kpiFilter: AccountKpiFilter,
) {
  if (id === "critical") return kpiFilter === "critical";
  if (id === "all") return statusFilter === "all" && kpiFilter === "all";
  return statusFilter === id && kpiFilter === "all";
}

function statusTone(status: CrmAccount["status"]) {
  if (status === "live") return "success" as const;
  if (status === "onboarding") return "warning" as const;
  if (status === "suspended" || status === "inactive" || status === "closed") {
    return "muted" as const;
  }
  return "info" as const;
}

function healthTone(bucket: CrmAccountRow["healthBucket"]) {
  if (bucket === "Healthy") return "success" as const;
  if (bucket === "Moderate") return "warning" as const;
  return "danger" as const;
}

function matchesAccountKpi(row: CrmAccountRow, filter: AccountKpiFilter) {
  if (filter === "all") return true;
  if (filter === "onboarding") return row.status === "onboarding";
  if (filter === "live") return row.status === "live";
  if (filter === "critical") return row.healthBucket === "Critical" || row.overdue;
  return true;
}

type AccountListFilters = {
  statusFilter?: string;
  typeFilter: string;
  cityFilter: string;
  regionFilter: string;
  managerFilter: string;
  supportManager1Filter: string;
  supportManager2Filter: string;
  healthFilter: string;
  stageFilter: string;
  providerFilter: string;
  progressFilter: string;
  dateFrom: string;
  dateTo: string;
};

function matchesAccountListFilters(row: CrmAccountRow, f: AccountListFilters) {
  if (f.statusFilter && f.statusFilter !== "all" && row.status !== f.statusFilter) return false;
  if (f.typeFilter !== "all" && row.companyType !== f.typeFilter) return false;
  if (f.cityFilter !== "all" && row.city !== f.cityFilter) return false;
  if (f.regionFilter !== "all" && row.region !== f.regionFilter) return false;
  if (f.managerFilter === "unassigned" && row.salesManagerName?.trim()) return false;
  if (
    f.managerFilter !== "all" &&
    f.managerFilter !== "unassigned" &&
    row.salesManagerName !== f.managerFilter
  ) {
    return false;
  }
  const hasSupport1 = Boolean(row.supportManager1?.trim());
  const hasSupport2 = Boolean(row.supportManager2?.trim());
  if (f.supportManager1Filter === "unassigned" && hasSupport1) return false;
  if (
    f.supportManager1Filter !== "all" &&
    f.supportManager1Filter !== "unassigned" &&
    row.supportManager1 !== f.supportManager1Filter
  ) {
    return false;
  }
  if (f.supportManager2Filter === "unassigned" && hasSupport2) return false;
  if (
    f.supportManager2Filter !== "all" &&
    f.supportManager2Filter !== "unassigned" &&
    row.supportManager2 !== f.supportManager2Filter
  ) {
    return false;
  }
  if (f.healthFilter !== "all" && row.healthBucket !== f.healthFilter) return false;
  if (f.stageFilter !== "all" && row.stage !== f.stageFilter) return false;
  if (f.providerFilter === "none" && row.providers.length > 0) return false;
  if (
    f.providerFilter !== "all" &&
    f.providerFilter !== "none" &&
    !row.providers.includes(f.providerFilter)
  ) {
    return false;
  }
  if (f.progressFilter === "0" && row.progress !== 0) return false;
  if (f.progressFilter === "1-49" && !(row.progress >= 1 && row.progress <= 49)) return false;
  if (f.progressFilter === "50-99" && !(row.progress >= 50 && row.progress <= 99)) return false;
  if (f.progressFilter === "100" && row.progress !== 100) return false;
  if (!inDateRange(row.startDate, f.dateFrom, f.dateTo)) return false;
  return true;
}

function CrmAccountsLayout() {
  const isDetail = useRouterState({
    select: (s) =>
      s.location.pathname.startsWith("/crm/accounts/") &&
      s.location.pathname !== "/crm/accounts",
  });
  if (isDetail) return <Outlet />;
  return <CrmAccountsPage />;
}

function CrmAccountsPage() {
  const navigate = useNavigate();
  const accounts = useCrmAccountStore((s) => s.accounts);
  const upsertAccount = useCrmAccountStore((s) => s.upsertAccount);
  const deleteAccount = useCrmAccountStore((s) => s.deleteAccount);
  const ensure = useCrmOnboardingStore((s) => s.ensureForCompany);
  const setProductModuleEnabled = useCrmOnboardingStore((s) => s.setProductModuleEnabled);
  const removeRecord = useCrmOnboardingStore((s) => s.removeRecord);
  const currentUser = useAuthStore((s) => s.user);
  const overview = useCrmDashboardOverview();

  const tableRef = useRef<HTMLDivElement>(null);

  const [kpiFilter, setKpiFilter] = useState<AccountKpiFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [supportManager1Filter, setSupportManager1Filter] = useState("all");
  const [supportManager2Filter, setSupportManager2Filter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tableSearch, setTableSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [dateBulkOpen, setDateBulkOpen] = useState(false);
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [queryAccountId, setQueryAccountId] = useState<string | undefined>();
  const [editing, setEditing] = useState<CrmAccount | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<CrmAccountRow | null>(null);
  const [selectedModules, setSelectedModules] = useState<CrmProductModuleKey[]>([]);

  const form = useForm<CrmAccountFormValues>({
    resolver: zodResolver(crmAccountSchema),
    defaultValues: emptyCrmAccountForm(),
  });

  useEffect(() => {
    for (const a of accounts) ensure(a.id, a.companyType);
  }, [accounts, ensure]);

  const rows = overview.rows;

  const cities = useMemo(() => {
    const set = new Set(rows.map((r) => r.city).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const regions = useMemo(() => {
    const set = new Set(rows.map((r) => r.region).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const managers = useMemo(() => {
    const set = new Set(
      rows.map((r) => r.salesManagerName).filter((n): n is string => Boolean(n?.trim())),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const supportManagers1 = useMemo(() => {
    const set = new Set(
      rows.map((r) => r.supportManager1?.trim()).filter((n): n is string => Boolean(n)),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const supportManagers2 = useMemo(() => {
    const set = new Set(
      rows.map((r) => r.supportManager2?.trim()).filter((n): n is string => Boolean(n)),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const stages = useMemo(() => {
    const set = new Set(rows.map((r) => r.stage));
    return [...set].sort((a, b) =>
      (CRM_STAGE_LABELS[a] ?? a).localeCompare(CRM_STAGE_LABELS[b] ?? b),
    );
  }, [rows]);

  const providers = useMemo(() => {
    const set = new Set(rows.flatMap((r) => r.providers));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const listFilters = useMemo(
    () => ({
      typeFilter,
      cityFilter,
      regionFilter,
      managerFilter,
      supportManager1Filter,
      supportManager2Filter,
      healthFilter,
      stageFilter,
      providerFilter,
      progressFilter,
      dateFrom,
      dateTo,
    }),
    [
      typeFilter,
      cityFilter,
      regionFilter,
      managerFilter,
      supportManager1Filter,
      supportManager2Filter,
      healthFilter,
      stageFilter,
      providerFilter,
      progressFilter,
      dateFrom,
      dateTo,
    ],
  );

  /** Rows after toolbar filters — used for pill counts (status chip applied separately). */
  const toolbarScopedRows = useMemo(
    () => rows.filter((r) => matchesAccountListFilters(r, listFilters)),
    [rows, listFilters],
  );

  /** Toolbar filters + status tab — KPI pill applied separately. */
  const scopedRows = useMemo(
    () =>
      rows.filter((r) =>
        matchesAccountListFilters(r, { ...listFilters, statusFilter }),
      ),
    [rows, listFilters, statusFilter],
  );

  const avgProgress = useMemo(() => {
    if (!toolbarScopedRows.length) return 0;
    return Math.round(
      toolbarScopedRows.reduce((sum, r) => sum + r.progress, 0) / toolbarScopedRows.length,
    );
  }, [toolbarScopedRows]);

  function accountFilterPillCount(id: AccountFilterPillId) {
    if (id === "all") return toolbarScopedRows.length;
    if (id === "critical") {
      return toolbarScopedRows.filter((r) => matchesAccountKpi(r, "critical")).length;
    }
    return toolbarScopedRows.filter((r) => r.status === id).length;
  }

  function selectAccountFilterPill(id: AccountFilterPillId) {
    if (id === "critical") {
      setStatusFilter("all");
      setKpiFilter("critical");
      return;
    }
    if (id === "all") {
      setStatusFilter("all");
      setKpiFilter("all");
      return;
    }
    setStatusFilter(id);
    setKpiFilter("all");
  }

  const filtered = useMemo(() => {
    return sortCrmAccountsByStartDateDesc(
      scopedRows.filter((r) => matchesAccountKpi(r, kpiFilter)),
    );
  }, [scopedRows, kpiFilter]);

  const activeFilterCount = [
    statusFilter !== "all",
    typeFilter !== "all",
    cityFilter !== "all",
    regionFilter !== "all",
    progressFilter !== "all",
    managerFilter !== "all",
    supportManager1Filter !== "all",
    supportManager2Filter !== "all",
    healthFilter !== "all",
    stageFilter !== "all",
    providerFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
    kpiFilter !== "all",
  ].filter(Boolean).length;

  function applyFilters() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearFilters() {
    setKpiFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setCityFilter("all");
    setRegionFilter("all");
    setProgressFilter("all");
    setManagerFilter("all");
    setSupportManager1Filter("all");
    setSupportManager2Filter("all");
    setHealthFilter("all");
    setStageFilter("all");
    setProviderFilter("all");
    setDateFrom("");
    setDateTo("");
    setTableSearch("");
  }

  function openCreateQuery(accountId?: string) {
    setQueryAccountId(accountId);
    setQueryModalOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setSelectedModules([]);
    form.reset(emptyCrmAccountForm());
    setModalOpen(true);
  }

  function openEdit(account: CrmAccount) {
    setEditing(account);
    form.reset(crmAccountToFormValues(account));
    setModalOpen(true);
  }

  function onSubmit() {
    void form.handleSubmit(
      (values) => {
        const data = normalizeCrmAccountForm(values);
        if (editing) {
          upsertAccount({
            ...editing,
            ...data,
            status: editing.status,
          });
          ensure(editing.id, data.companyType);
          toast.success(`${data.name} updated`);
        } else {
          const portalSlug = normalizePortalSlug(values.portalApiKey ?? "");
          if (!portalSlug) {
            toast.error("Portal API key is required");
            return;
          }
          if (!isValidPortalSlug(portalSlug)) {
            toast.error("Portal API key must be 3–48 characters (letters, numbers, hyphens)");
            return;
          }
          if (useCompanyPortalStore.getState().getBySlug(portalSlug)) {
            toast.error("This portal API key is already in use");
            return;
          }

          const created = upsertAccount({
            ...data,
            status: "onboarding",
          });
          useCompanyPortalStore.getState().generateAccessForCompany(
            {
              id: created.id,
              name: created.name,
              contact: created.contact,
              email: created.email,
            },
            { slug: portalSlug },
          );
          const record = ensure(created.id, created.companyType);
          const catalogKeys = new Set(getCrmMasterProductModuleCatalog().map((m) => m.key));
          for (const mod of record.productModules) {
            if (!catalogKeys.has(mod.key)) continue;
            const shouldEnable = selectedModules.includes(mod.key as CrmProductModuleKey);
            if (mod.enabled !== shouldEnable) {
              setProductModuleEnabled(created.id, mod.key, shouldEnable);
            }
          }
          toast.success(`${created.name} created`, {
            action: {
              label: "Open",
              onClick: () =>
                void navigate({
                  to: "/crm/accounts/$accountId",
                  params: { accountId: created.id },
                }),
            },
          });
          void navigate({
            to: "/crm/accounts/$accountId",
            params: { accountId: created.id },
          });
        }
        setModalOpen(false);
        setEditing(null);
      },
      (errors) => {
        const first = Object.values(errors)[0];
        toast.error(first?.message?.toString() ?? "Please complete the required fields");
      },
    )();
  }

  function confirmDelete() {
    if (!deleting) return;
    const removed = deleteAccount(deleting.id);
    removeRecord(deleting.id);
    if (removed) {
      toast.success("Account deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            upsertAccount({ ...removed });
            ensure(removed.id, removed.companyType);
          },
        },
      });
    }
    setDeleteOpen(false);
    setDeleting(null);
  }

  const unassignedManagerCount = rows.filter((r) => !r.salesManagerName?.trim()).length;
  const unassignedSupportManager1Count = rows.filter((r) => !r.supportManager1?.trim()).length;
  const unassignedSupportManager2Count = rows.filter((r) => !r.supportManager2?.trim()).length;

  return (
    <PageWrap compact flushTop>
      <div className="mb-0 border-b border-border pb-2 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">CRM Accounts</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "account" : "accounts"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Client transfer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => setBulkUpdateOpen(true)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Client bulk update
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => setDateBulkOpen(true)}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Update dates
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => setBulkOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Bulk upload
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-3 text-xs"
              onClick={() => openCreateQuery()}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Create query
            </Button>
            <Button size="sm" className="h-8 gap-1 bg-primary px-3 text-xs" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Add account
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <div
            role="tablist"
            aria-label="Account filters"
            className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8"
          >
            {STATUS_CHIPS.map((chip) => {
              const tone = filterPillTone(chip.id);
              const active = isAccountFilterPillActive(chip.id, statusFilter, kpiFilter);
              const count = accountFilterPillCount(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectAccountFilterPill(chip.id)}
                  className={cn(
                    "flex min-w-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-all",
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
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 flex-col justify-center rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm lg:min-w-[5.5rem]">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Avg
            </span>
            <span className="mt-1 text-lg font-semibold tabular-nums leading-none text-foreground">
              {avgProgress}%
            </span>
          </div>
        </div>
      </div>

      <div className="-mx-3 sm:-mx-4 lg:-mx-5">
        <div className="px-3 sm:px-4 lg:px-5">
          <DesignTicketFilterBar
            variant="inline"
            compact
            className="xl:grid-cols-4"
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            onApply={applyFilters}
            resultCount={filtered.length}
            resultLabel={filtered.length === 1 ? "account" : "accounts"}
            trailing={
              <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search accounts…"
                  aria-label="Search accounts"
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            }
          >
        <DesignTicketFilterField label="Type" compact>
          <DesignTicketSelect
            compact
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "all", label: "All types" },
              ...COMPANY_TYPES.map((t) => ({ value: t, label: t })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Health" compact>
          <DesignTicketSelect
            compact
            value={healthFilter}
            onChange={setHealthFilter}
            options={[
              { value: "all", label: "All health" },
              { value: "Healthy", label: "Healthy" },
              { value: "Moderate", label: "Moderate" },
              { value: "Critical", label: "Critical" },
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Progress" compact>
          <DesignTicketSelect
            compact
            value={progressFilter}
            onChange={setProgressFilter}
            options={[
              { value: "all", label: "Any progress" },
              { value: "0", label: "Not started (0%)" },
              { value: "1-49", label: "Early (1–49%)" },
              { value: "50-99", label: "Advanced (50–99%)" },
              { value: "100", label: "Complete (100%)" },
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Stage" compact>
          <DesignTicketSelect
            compact
            value={stageFilter}
            onChange={setStageFilter}
            options={[
              { value: "all", label: "All stages" },
              ...stages.map((s) => ({
                value: s,
                label: CRM_STAGE_LABELS[s] ?? s,
              })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Sales Manager" compact>
          <DesignTicketSelect
            compact
            value={managerFilter}
            onChange={setManagerFilter}
            options={[
              { value: "all", label: "All managers" },
              ...(unassignedManagerCount > 0
                ? [{ value: "unassigned", label: `Unassigned (${unassignedManagerCount})` }]
                : []),
              ...managers.map((m) => ({ value: m, label: m })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Support Manager 1" compact>
          <DesignTicketSelect
            compact
            value={supportManager1Filter}
            onChange={setSupportManager1Filter}
            options={[
              { value: "all", label: "All support managers 1" },
              ...(unassignedSupportManager1Count > 0
                ? [
                    {
                      value: "unassigned",
                      label: `Unassigned (${unassignedSupportManager1Count})`,
                    },
                  ]
                : []),
              ...supportManagers1.map((m) => ({ value: m, label: m })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Support Manager 2" compact>
          <DesignTicketSelect
            compact
            value={supportManager2Filter}
            onChange={setSupportManager2Filter}
            options={[
              { value: "all", label: "All support managers 2" },
              ...(unassignedSupportManager2Count > 0
                ? [
                    {
                      value: "unassigned",
                      label: `Unassigned (${unassignedSupportManager2Count})`,
                    },
                  ]
                : []),
              ...supportManagers2.map((m) => ({ value: m, label: m })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Provider" compact>
          <DesignTicketSelect
            compact
            value={providerFilter}
            onChange={setProviderFilter}
            options={[
              { value: "all", label: "All providers" },
              { value: "none", label: "No provider" },
              ...providers.map((p) => ({ value: p, label: p })),
            ]}
          />
        </DesignTicketFilterField>
        {cities.length > 1 ? (
          <DesignTicketFilterField label="City" compact>
            <DesignTicketSelect
              compact
              value={cityFilter}
              onChange={setCityFilter}
              options={[
                { value: "all", label: "All cities" },
                ...cities.map((city) => ({ value: city, label: city })),
              ]}
            />
          </DesignTicketFilterField>
        ) : null}
        {regions.length > 1 ? (
          <DesignTicketFilterField label="Region" compact>
            <DesignTicketSelect
              compact
              value={regionFilter}
              onChange={setRegionFilter}
              options={[
                { value: "all", label: "All regions" },
                ...regions.map((region) => ({ value: region, label: region })),
              ]}
            />
          </DesignTicketFilterField>
        ) : null}
        <DesignTicketDateField
          compact
          label="Start from"
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="From"
        />
        <DesignTicketDateField
          compact
          label="Start to"
          value={dateTo}
          onChange={setDateTo}
          placeholder="To"
        />
          </DesignTicketFilterBar>
        </div>

      <div ref={tableRef} className="min-w-0">
        {rows.length === 0 ? (
          <div className="px-3 sm:px-4 lg:px-5">
            <EmptyState
              title="No CRM accounts yet"
              description="Create your first CRM customer account to start onboarding."
              actionLabel="+ Add account"
              onAction={openCreate}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 sm:px-4 lg:px-5">
            <EmptyState
              title="No matches"
              description="Try another filter, clear filters, or adjust your search."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="bg-card [&_tbody_tr]:bg-card [&_thead]:bg-card"
          >
            <DataTable
              flush
              data={filtered}
              initialSortKey="startDate"
              initialSortDir="desc"
              getRowId={(r) => r.id}
              hideSearch
              searchQuery={tableSearch}
              onSearchQueryChange={setTableSearch}
              searchKeys={[
                  "name",
                  "userId",
                  "city",
                  "contact",
                  "email",
                  "companyType",
                  "salesManagerName",
                  "supportManager1",
                  "supportManager2",
                ]}
                pageSize={15}
                density="compact"
                onRowClick={(r) =>
                  void navigate({
                    to: "/crm/accounts/$accountId",
                    params: { accountId: r.id },
                  })
                }
                columns={[
                  {
                    key: "name",
                    header: "Account",
                    sortable: true,
                    render: (r) => (
                      <div>
                        <div className="font-medium">
                          <a
                            href={`/crm/accounts/${r.id}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.name}
                          </a>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {r.userId?.trim() || "—"}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "city",
                    header: "Location",
                    sortable: true,
                    render: (r) => (
                      <span className="text-xs text-muted-foreground">
                        {r.city}
                        {r.region ? ` · ${r.region}` : ""}
                      </span>
                    ),
                  },
                  {
                    key: "companyType",
                    header: "Type",
                    sortable: true,
                    render: (r) => (
                      <span className="text-xs text-muted-foreground">{r.companyType}</span>
                    ),
                  },
                  {
                    key: "subscribedModules",
                    header: "Modules",
                    render: (r) => (
                      <CrmAccountModulesCell modules={r.subscribedModules} />
                    ),
                  },
                  {
                    key: "usersPurchased",
                    header: "Users",
                    sortable: true,
                    render: (r) => (
                      <span className="tabular-nums text-xs">{r.usersPurchased ?? "—"}</span>
                    ),
                  },
                  {
                    key: "supportManager1",
                    header: "Support 1",
                    sortable: true,
                    render: (r) => (
                      <span className="text-xs">{r.supportManager1?.trim() || "—"}</span>
                    ),
                  },
                  {
                    key: "supportManager2",
                    header: "Support 2",
                    sortable: true,
                    render: (r) => (
                      <span className="text-xs">{r.supportManager2?.trim() || "—"}</span>
                    ),
                  },
                  {
                    key: "salesManagerName",
                    header: "Sales Manager",
                    sortable: true,
                    render: (r) => (
                      <span className="text-xs">{r.salesManagerName || "—"}</span>
                    ),
                  },
                  {
                    key: "startDate",
                    header: "Start",
                    sortable: true,
                    render: (r) => (
                      <span className="text-xs text-muted-foreground">
                        {r.startDate ? formatDate(r.startDate) : "—"}
                      </span>
                    ),
                  },
                  {
                    key: "progress",
                    header: "Progress",
                    sortable: true,
                    render: (r) => (
                      <div className="flex items-center gap-2">
                        <ProgressBar value={r.progress} className="w-20" />
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {r.progress}%
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "healthBucket",
                    header: "Health",
                    sortable: true,
                    render: (r) => (
                      <Pill tone={healthTone(r.healthBucket)}>
                        {r.healthBucket}
                        {r.overdue ? " · overdue" : ""}
                      </Pill>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    sortable: true,
                    render: (r) => (
                      <div className="min-w-[5.5rem]">
                        <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                        <CrmAccountStatusRemarksNote
                          status={r.status}
                          remarks={r.statusRemarks}
                          className="mt-1 max-w-[12rem] line-clamp-3"
                        />
                      </div>
                    ),
                  },
                ]}
                actions={(r) => (
                  <CrmAccountGoLiveActions
                    variant="icon"
                    companyId={r.id}
                    accountName={r.name}
                    accountStatus={r.status}
                    who={currentUser?.name}
                    onOpenGoLiveTab={() =>
                      void navigate({
                        to: "/crm/accounts/$accountId",
                        params: { accountId: r.id },
                        search: { tab: "golive" },
                      })
                    }
                    onEdit={() => openEdit(r)}
                    onCreateQuery={() => openCreateQuery(r.id)}
                    onDelete={() => {
                      setDeleting(r);
                      setDeleteOpen(true);
                    }}
                  />
                )}
              />
            </motion.div>
          )}
      </div>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditing(null);
            setSelectedModules([]);
          }
        }}
        title={editing ? "Edit CRM account" : "Add CRM account"}
        submitLabel={editing ? "Save changes" : "Create account"}
        onSubmit={onSubmit}
        contentClassName="max-w-3xl"
      >
        <CrmAccountFormFields
          form={form}
          showModulePicker={!editing}
          showPortalApiKey={!editing}
          selectedModules={selectedModules}
          onSelectedModulesChange={setSelectedModules}
        />
      </EntityFormModal>

      <CrmAccountBulkUploadModal open={bulkOpen} onOpenChange={setBulkOpen} />
      <CrmAccountBulkUploadModal
        open={bulkUpdateOpen}
        onOpenChange={setBulkUpdateOpen}
        updatesOnly
      />
      <CrmAccountClientTransferModal open={transferOpen} onOpenChange={setTransferOpen} />
      <CrmAccountDateBulkUploadModal open={dateBulkOpen} onOpenChange={setDateBulkOpen} />

      <CrmCreateAccountQueryModal
        open={queryModalOpen}
        onOpenChange={(open) => {
          setQueryModalOpen(open);
          if (!open) setQueryAccountId(undefined);
        }}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        defaultCompanyId={queryAccountId}
        onCreated={(_query, companyId) => {
          void navigate({
            to: "/crm/accounts/$accountId",
            params: { accountId: companyId },
            search: { tab: "queries", queryId: _query.id },
          });
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete CRM account?"
        description={
          deleting
            ? `This will remove ${deleting.name} and its onboarding checklist data.`
            : "This account will be removed."
        }
        confirmLabel="Delete account"
        onConfirm={confirmDelete}
      />
    </PageWrap>
  );
}
