import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  CalendarRange,
  ClipboardList,
  FileSpreadsheet,
  Plus,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CrmAccountBulkUploadModal } from "@/components/crm/crm-account-bulk-upload-modal";
import { CrmAccountClientTransferModal } from "@/components/crm/crm-account-client-transfer-modal";
import { CrmAccountDateBulkUploadModal } from "@/components/crm/crm-account-date-bulk-upload-modal";
import { CrmAccountGoLiveActions } from "@/components/crm/crm-account-go-live-actions";
import { CrmAccountModulesCell } from "@/components/crm/crm-account-modules-cell";
import { CrmAccountProvidersCell } from "@/components/crm/crm-account-providers-cell";
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
import {
  DesignTicketFilterBar,
  DesignTicketKpiGrid,
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketTabNav,
} from "@/components/design-ticket/design-ticket-shared";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { inDateRange } from "@/components/list-toolbar";
import { PageWrap } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CRM_STAGE_LABELS } from "@/data/crm-onboarding-defaults";
import { formatDate } from "@/lib/utils";
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
] as const;

function statusTone(status: CrmAccount["status"]) {
  if (status === "live") return "success" as const;
  if (status === "onboarding") return "warning" as const;
  if (status === "suspended") return "warning" as const;
  if (status === "inactive" || status === "closed") return "danger" as const;
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

function accountKpiFilterLabel(filter: AccountKpiFilter) {
  switch (filter) {
    case "onboarding":
      return "Onboarding accounts";
    case "live":
      return "Live accounts";
    case "critical":
      return "Critical / overdue";
    default:
      return "All accounts";
  }
}

function CrmAccountsLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
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

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [dateBulkOpen, setDateBulkOpen] = useState(false);
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

  /** Toolbar filters only — KPI cards update from this set (KPI chip applied separately). */
  const scopedRows = useMemo(
    () =>
      rows.filter((r) =>
        matchesAccountListFilters(r, { ...listFilters, statusFilter }),
      ),
    [rows, listFilters, statusFilter],
  );

  /** Status tabs ignore the status chip so counts stay a breakdown of other filters. */
  const statusScopeRows = useMemo(
    () => rows.filter((r) => matchesAccountListFilters(r, listFilters)),
    [rows, listFilters],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: statusScopeRows.length };
    for (const chip of STATUS_CHIPS) {
      if (!chip.status) continue;
      counts[chip.id] = statusScopeRows.filter((r) => r.status === chip.status).length;
    }
    return counts;
  }, [statusScopeRows]);

  const kpiStats = useMemo(() => {
    const onboarding = scopedRows.filter((r) => matchesAccountKpi(r, "onboarding")).length;
    const live = scopedRows.filter((r) => matchesAccountKpi(r, "live")).length;
    const critical = scopedRows.filter((r) => matchesAccountKpi(r, "critical")).length;
    const avg = scopedRows.length
      ? Math.round(scopedRows.reduce((sum, r) => sum + r.progress, 0) / scopedRows.length)
      : 0;
    return { total: scopedRows.length, onboarding, live, critical, avg };
  }, [scopedRows]);

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

  const kpiCards = [
    {
      id: "all",
      label: "Total",
      value: kpiStats.total,
      icon: Building2,
      onClick: () => setKpiFilter("all"),
      active: kpiFilter === "all",
    },
    {
      id: "onboarding",
      label: "Onboarding",
      value: kpiStats.onboarding,
      icon: ClipboardList,
      tone: "text-amber-600 dark:text-amber-400",
      onClick: () => setKpiFilter("onboarding"),
      active: kpiFilter === "onboarding",
    },
    {
      id: "live",
      label: "Live",
      value: kpiStats.live,
      icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-400",
      onClick: () => setKpiFilter("live"),
      active: kpiFilter === "live",
    },
    {
      id: "critical",
      label: "Critical",
      value: kpiStats.critical,
      icon: TrendingUp,
      tone: "text-destructive",
      onClick: () => setKpiFilter("critical"),
      active: kpiFilter === "critical",
    },
    {
      id: "avg",
      label: "Avg %",
      value: kpiStats.avg,
    },
  ];

  const statusTabs = STATUS_CHIPS.map((c) => ({
    id: c.id,
    label: `${c.label} (${statusCounts[c.id] ?? 0})`,
  }));

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
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="CRM Accounts"
        subtitle="Customer accounts for CRM onboarding — progress, health, and go-live."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Client transfer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setBulkUpdateOpen(true)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Client bulk update
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setDateBulkOpen(true)}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Update dates
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setBulkOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Bulk upload
            </Button>
            <Button size="sm" className="h-8 gap-1 bg-primary text-xs" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Add account
            </Button>
          </div>
        }
      />

      <div className="mb-3 min-w-0">
        <DesignTicketKpiGrid items={kpiCards} columns={5} size="compact" />
      </div>

      <DesignTicketTabNav
        compact
        tabs={statusTabs}
        activeId={statusFilter}
        onChange={setStatusFilter}
      />

      <DesignTicketFilterBar
        compact
        className="xl:grid-cols-4"
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
        onApply={applyFilters}
        resultCount={filtered.length}
        resultLabel={filtered.length === 1 ? "account" : "accounts"}
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

      <div ref={tableRef}>
        <DesignTicketSection title={accountKpiFilterLabel(kpiFilter)} delay={0.06} compact>
          {rows.length === 0 ? (
            <EmptyState
              title="No CRM accounts yet"
              description="Create your first CRM customer account to start onboarding."
              actionLabel="+ Add account"
              onAction={openCreate}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Try another KPI card, clear filters, or adjust your search."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="card-soft overflow-hidden p-3"
            >
              <DataTable
                data={filtered}
                initialSortKey="startDate"
                initialSortDir="desc"
                getRowId={(r) => r.id}
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
                    key: "subscribedModules",
                    header: "Modules & integrations",
                    render: (r) => (
                      <CrmAccountModulesCell subscribed={r.subscribedModules} />
                    ),
                  },
                  {
                    key: "providers",
                    header: "Providers",
                    render: (r) => <CrmAccountProvidersCell providers={r.providers} />,
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
                    render: (r) => <Pill tone={statusTone(r.status)}>{r.status}</Pill>,
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
                    onDelete={() => {
                      setDeleting(r);
                      setDeleteOpen(true);
                    }}
                  />
                )}
              />
            </motion.div>
          )}
        </DesignTicketSection>
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
