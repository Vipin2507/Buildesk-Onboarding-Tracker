import { createFileRoute, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Trash2,
  UserRound,
  FileSpreadsheet,
  TrendingUp,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { PageWrap } from "@/components/page-header";
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
import { StatusPill, Pill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { ProjectImportModal } from "@/components/project-import-modal";
import { inDateRange } from "@/components/list-toolbar";
import { usePermissions } from "@/hooks/use-permissions";
import { MODULE_CATALOG, createCompanyModules, normalizeCompanyModules } from "@/data/module-catalog";
import {
  useCompanyStore,
  useEmployeeStore,
  useProjectStore,
  useUserStore,
  useDashboardKpis,
} from "@/stores";
import { isCompanyModulesAllLive } from "@/lib/module-progress";
import { assignableManagerUsers, resolveAssigneeLabel } from "@/lib/managers";
import type { Company, ModuleKey, User } from "@/types";
import { COMPANY_REGIONS, COMPANY_TYPES } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  name: "Company Name",
  contact: "Contact Person",
  designation: "Designation",
  phone: "Mobile Number",
  email: "Email",
  city: "City",
};

function defaultCompanyFormValues(users: User[]): CompanyForm {
  const managers = assignableManagerUsers(users);
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: "",
    contact: "",
    designation: "",
    phone: "",
    email: "",
    city: "",
    region: "Rest of India",
    ownerName: "",
    ownerMobile: "",
    pocName: "",
    pocMobile: "",
    onboardingManagerId: managers[0]?.id ?? "",
    csmId: "",
    salesAgentId: "",
    plan: "Half-Yearly",
    health: "Healthy",
    modules: [],
    agreementDate: today,
    startDate: today,
    goLiveTarget: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    planExpiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    companyType: "Real Estate Developer",
    state: "",
    supportManager1Id: "",
    supportManager2Id: "",
    annualLicense: true,
    dealSize: undefined,
    usersPurchased: undefined,
    totalCost: undefined,
    paymentReceived: undefined,
    pendingAmount: undefined,
    endDate: "",
  };
}

function normalizeCompanyPayload(data: CompanyForm, users: User[]) {
  const managers = assignableManagerUsers(users);
  const phone = data.phone.replace(/\D/g, "");
  const onboardingManagerId = data.onboardingManagerId?.trim() || managers[0]?.id || "";
  return {
    ...data,
    phone,
    ownerName: (data.ownerName ?? "").trim() || data.contact.trim(),
    ownerMobile: (data.ownerMobile ?? "").trim() || phone,
    pocName: (data.pocName ?? "").trim() || data.contact.trim(),
    pocMobile: (data.pocMobile ?? "").trim() || phone,
    csmId: data.csmId ?? "",
    onboardingManagerId,
    salesAgentId: data.salesAgentId?.trim() || undefined,
    supportManager1Id: data.supportManager1Id?.trim() || undefined,
    supportManager2Id: data.supportManager2Id?.trim() || undefined,
    endDate: data.endDate?.trim() || undefined,
  };
}

function inputClass(hasError?: boolean) {
  return cn(
    "mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40",
    hasError && "border-destructive focus:ring-destructive/30",
  );
}

export const Route = createFileRoute("/companies")({
  component: CompaniesPage,
});

const companySchema = z.object({
  name: z.string().min(2),
  contact: z.string().min(2),
  designation: z.string().min(2),
  phone: z.string().min(10, "Enter a valid mobile number (at least 10 digits)"),
  email: z.string().email(),
  city: z.string().min(2),
  region: z.enum(["NCR", "South", "West", "Rest of India"]),
  ownerName: z.string().optional(),
  ownerMobile: z.string().optional(),
  pocName: z.string().optional(),
  pocMobile: z.string().optional(),
  onboardingManagerId: z.string().min(1, "Select an onboarding manager"),
  csmId: z.string().optional(),
  salesAgentId: z.string().optional(),
  plan: z.enum(["Annual", "Half-Yearly", "AMC"]),
  health: z.enum(["Healthy", "Moderate", "Critical"]),
  modules: z.array(
    z.enum([
      "post-sales",
      "vendor-management",
      "labor-management",
      "customer-app",
      "construction-management",
      "project-management",
    ]),
  ),
  agreementDate: z.string(),
  startDate: z.string().min(1, "Start date is required"),
  goLiveTarget: z.string(),
  planExpiry: z.string(),
  companyType: z
    .enum(["Real Estate Developer", "Channel Partner", "Broker", "Mandate", "CT", "Agent"])
    .optional(),
  state: z.string().optional(),
  supportManager1Id: z.string().optional(),
  supportManager2Id: z.string().optional(),
  annualLicense: z.boolean().optional(),
  dealSize: z.coerce.number().optional(),
  usersPurchased: z.coerce.number().optional(),
  totalCost: z.coerce.number().optional(),
  paymentReceived: z.coerce.number().optional(),
  pendingAmount: z.coerce.number().optional(),
  endDate: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

const STATUS_CHIPS = [
  { id: "all", label: "All", status: null as string | null },
  { id: "in_progress", label: "In Progress", status: "in_progress" },
  { id: "completed", label: "Completed", status: "completed" },
  { id: "on_hold", label: "On Hold", status: "on_hold" },
  { id: "not_started", label: "Not Started", status: "not_started" },
] as const;


type CompanyKpiFilter = "all" | "pending" | "in_progress" | "live";

function matchesCompanyKpi(
  c: {
    progress: number;
    computedStatus: string;
    status: string;
    isLive?: boolean;
    modules: Company["modules"];
  },
  filter: CompanyKpiFilter,
): boolean {
  if (filter === "all") return true;
  const isLive =
    Boolean(c.isLive) ||
    c.progress >= 100 ||
    c.computedStatus === "completed" ||
    isCompanyModulesAllLive(normalizeCompanyModules(c.modules));
  const isPending =
    c.progress === 0 || c.computedStatus === "not_started" || c.status === "not_started";
  const isInProgress =
    !isLive && c.progress > 0 && c.progress < 100 && c.computedStatus !== "completed";
  if (filter === "pending") return isPending;
  if (filter === "in_progress") return isInProgress;
  if (filter === "live") return isLive;
  return true;
}

function companyKpiFilterLabel(filter: CompanyKpiFilter): string {
  switch (filter) {
    case "pending":
      return "Pending onboarding";
    case "in_progress":
      return "In progress";
    case "live":
      return "Live companies";
    default:
      return "All companies";
  }
}

function CompaniesPage() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;

  return <CompaniesListPage />;
}

function CompaniesListPage() {
  const addCompany = useCompanyStore((s) => s.addCompany);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const deleteCompany = useCompanyStore((s) => s.deleteCompany);
  const assignOnboardingManagerBulk = useCompanyStore((s) => s.assignOnboardingManagerBulk);
  const allProjects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const kpis = useDashboardKpis();
  const navigate = useNavigate();
  const { can, isAdmin } = usePermissions();
  const canManageCompanies = can("manageCompanies");
  const canAssignSalesAgent = isAdmin || can("assignSalesAgent");

  const tableRef = useRef<HTMLDivElement>(null);

  const [kpiFilter, setKpiFilter] = useState<CompanyKpiFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [salesAgentFilter, setSalesAgentFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [assignManagerId, setAssignManagerId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: defaultCompanyFormValues(users),
  });

  const assignableUsers = useMemo(() => assignableManagerUsers(users), [users]);

  function mergeModules(existing: Company["modules"], selected: ModuleKey[]) {
    const baseline = createCompanyModules(selected);
    return baseline.map((m) => {
      const prev = existing.find((x) => x.moduleKey === m.moduleKey);
      if (!m.optedIn) {
        return {
          ...m,
          liveAt: undefined,
          pocName: prev?.pocName,
          pocMobile: prev?.pocMobile,
          subscriptionId: prev?.subscriptionId,
          subscriptionStatus: prev?.subscriptionStatus,
          subscriptionStartDate: prev?.subscriptionStartDate,
          subscriptionValidUntil: prev?.subscriptionValidUntil,
        };
      }
      if (prev?.optedIn) {
        return {
          ...m,
          optedOnDate: prev.optedOnDate,
          liveAt: prev.liveAt,
          pocName: prev.pocName,
          pocMobile: prev.pocMobile,
          subscriptionId: prev.subscriptionId,
          subscriptionStatus: prev.subscriptionStatus,
          subscriptionStartDate: prev.subscriptionStartDate,
          subscriptionValidUntil: prev.subscriptionValidUntil,
        };
      }
      return m;
    });
  }

  const enriched = kpis.companiesWithProgress;

  const cities = useMemo(() => {
    const set = new Set(enriched.map((c) => c.city).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [enriched]);

  const managers = useMemo(() => {
    const ids = [...new Set(enriched.map((c) => c.onboardingManagerId).filter(Boolean))];
    return ids
      .map((id) => ({
        id,
        name: resolveAssigneeLabel(id, users, employees),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enriched, users, employees]);

  const unassignedCount = useMemo(
    () => enriched.filter((c) => !c.onboardingManagerId).length,
    [enriched],
  );

  const salesAgents = useMemo(() => {
    const ids = [...new Set(enriched.map((c) => c.salesAgentId).filter(Boolean))];
    return ids
      .map((id) => ({
        id: id as string,
        name: resolveAssigneeLabel(id, users, employees),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enriched, users, employees]);

  const unassignedSalesCount = useMemo(
    () => enriched.filter((c) => !c.salesAgentId).length,
    [enriched],
  );

  const toggleSelection = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectionAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  function openBulkAssign() {
    if (!isAdmin) {
      toast.error("Only admins can assign onboarding managers");
      return;
    }
    if (selectedIds.size === 0) return;
    if (assignableUsers.length === 0) {
      toast.error("Invite users in Settings → User Management first");
      return;
    }
    setAssignManagerId(assignableUsers[0]?.id ?? "");
    setAssignOpen(true);
  }

  function confirmBulkAssign() {
    if (!isAdmin) {
      toast.error("Only admins can assign onboarding managers");
      return;
    }
    if (!assignManagerId) {
      toast.error("Select an onboarding manager");
      return;
    }
    const ids = [...selectedIds];
    assignOnboardingManagerBulk(ids, assignManagerId);
    const managerName = resolveAssigneeLabel(assignManagerId, users, employees);
    toast.success(`Assigned ${managerName} to ${ids.length} ${ids.length === 1 ? "company" : "companies"}`);
    setSelectedIds(new Set());
    setAssignOpen(false);
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enriched.length };
    for (const chip of STATUS_CHIPS) {
      if (!chip.status) continue;
      counts[chip.id] = enriched.filter(
        (c) => c.computedStatus === chip.status || c.status === chip.status,
      ).length;
    }
    return counts;
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((c) => {
      if (!matchesCompanyKpi(c, kpiFilter)) return false;
      if (statusFilter !== "all") {
        const chip = STATUS_CHIPS.find((s) => s.id === statusFilter);
        if (chip?.status && c.computedStatus !== chip.status && c.status !== chip.status) {
          return false;
        }
      }
      if (planFilter !== "all" && c.plan !== planFilter) return false;
      if (healthFilter !== "all" && c.health !== healthFilter) return false;
      if (managerFilter === "unassigned" && c.onboardingManagerId) return false;
      if (managerFilter !== "all" && managerFilter !== "unassigned" && c.onboardingManagerId !== managerFilter) {
        return false;
      }
      if (salesAgentFilter === "unassigned" && c.salesAgentId) return false;
      if (
        salesAgentFilter !== "all" &&
        salesAgentFilter !== "unassigned" &&
        c.salesAgentId !== salesAgentFilter
      ) {
        return false;
      }
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      if (progressFilter === "0" && c.progress !== 0) return false;
      if (progressFilter === "1-49" && !(c.progress >= 1 && c.progress <= 49)) return false;
      if (progressFilter === "50-99" && !(c.progress >= 50 && c.progress <= 99)) return false;
      if (progressFilter === "100" && c.progress !== 100) return false;
      if (!inDateRange(c.startDate || c.agreementDate, dateFrom, dateTo)) return false;
      return true;
    });
  }, [
    enriched,
    kpiFilter,
    statusFilter,
    planFilter,
    healthFilter,
    managerFilter,
    salesAgentFilter,
    cityFilter,
    progressFilter,
    dateFrom,
    dateTo,
  ]);

  const activeFilterCount = [
    statusFilter !== "all",
    planFilter !== "all",
    healthFilter !== "all",
    progressFilter !== "all",
    managerFilter !== "all",
    salesAgentFilter !== "all",
    cityFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
    kpiFilter !== "all",
  ].filter(Boolean).length;

  const kpiStats = useMemo(() => {
    const pending = enriched.filter((c) => matchesCompanyKpi(c, "pending")).length;
    const inProgress = enriched.filter((c) => matchesCompanyKpi(c, "in_progress")).length;
    const live = enriched.filter((c) => matchesCompanyKpi(c, "live")).length;
    const avg = enriched.length
      ? Math.round(enriched.reduce((sum, c) => sum + c.progress, 0) / enriched.length)
      : 0;
    return { total: enriched.length, pending, inProgress, live, avg };
  }, [enriched]);

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
      id: "pending",
      label: "Pending",
      value: kpiStats.pending,
      icon: Clock,
      tone: "text-amber-600 dark:text-amber-400",
      onClick: () => setKpiFilter("pending"),
      active: kpiFilter === "pending",
    },
    {
      id: "in_progress",
      label: "In Progress",
      value: kpiStats.inProgress,
      icon: TrendingUp,
      tone: "text-primary",
      onClick: () => setKpiFilter("in_progress"),
      active: kpiFilter === "in_progress",
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
    setPlanFilter("all");
    setHealthFilter("all");
    setProgressFilter("all");
    setManagerFilter("all");
    setSalesAgentFilter("all");
    setCityFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function openCreate() {
    setEditing(null);
    form.reset(defaultCompanyFormValues(users));
    setModalOpen(true);
  }

  function openEdit(c: Company) {
    setEditing(c);
    form.reset({
      name: c.name, contact: c.contact, designation: c.designation,
      phone: c.phone, email: c.email, city: c.city,
      region: c.region ?? "Rest of India",
      ownerName: c.ownerName || "",
      ownerMobile: c.ownerMobile || "",
      pocName: c.pocName || c.contact,
      pocMobile: c.pocMobile || c.phone,
      onboardingManagerId: c.onboardingManagerId, csmId: c.csmId,
      salesAgentId: c.salesAgentId ?? "",
      plan: c.plan,
      health: c.health,
      modules: normalizeCompanyModules(c.modules).filter((m) => m.optedIn).map((m) => m.moduleKey),
      agreementDate: c.agreementDate,
      startDate: c.startDate || c.agreementDate,
      goLiveTarget: c.goLiveTarget,
      planExpiry: c.planExpiry,
      companyType: c.companyType ?? "Real Estate Developer",
      state: c.state ?? "",
      supportManager1Id: c.supportManager1Id ?? "",
      supportManager2Id: c.supportManager2Id ?? "",
      annualLicense: c.annualLicense ?? true,
      dealSize: c.dealSize,
      usersPurchased: c.usersPurchased,
      totalCost: c.totalCost,
      paymentReceived: c.paymentReceived,
      pendingAmount: c.pendingAmount,
      endDate: c.endDate ?? "",
    });
    setModalOpen(true);
  }

  function onSubmit() {
    void form.handleSubmit(
      async (data) => {
        const payload = normalizeCompanyPayload(data, users);
        if (editing) {
          updateCompany(editing.id, {
            ...payload,
            status: editing.status,
            modules: mergeModules(editing.modules, data.modules),
          });
          toast.success("Company updated");
          setModalOpen(false);
          return;
        }

        if (!payload.onboardingManagerId) {
          toast.error("No onboarding manager available", {
            description: "Ask an admin to invite an ERP user before creating companies.",
          });
          return;
        }

        setSavingCompany(true);
        try {
          const company = await addCompany({
            ...payload,
            status: "not_started",
            modules: createCompanyModules(data.modules),
          });
          clearFilters();
          toast.success("Company saved", {
            description: `${company.name} is stored and will remain after refresh.`,
            action: {
              label: "View",
              onClick: () => navigate({ to: "/companies/$companyId", params: { companyId: company.id } }),
            },
          });
          setModalOpen(false);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save company";
          if (!/not saved|Failed to sync|permission/i.test(message)) {
            toast.error(message);
          }
        } finally {
          setSavingCompany(false);
        }
      },
      (errors) => {
        const first = Object.values(errors)[0];
        toast.error(first?.message?.toString() ?? "Please complete the required fields");
      },
    )();
  }

  function confirmDelete() {
    if (!deleting) return;
    const projects = allProjects.filter((p) => p.companyId === deleting.id);
    if (projects.length > 0) {
      toast.error(`Cannot delete — ${projects.length} project(s) linked. Delete projects first.`);
      setDeleteOpen(false);
      return;
    }
    const removed = deleteCompany(deleting.id);
    if (removed) {
      toast.success("Company deleted", {
        action: { label: "Undo", onClick: () => void addCompany({ ...removed, status: removed.status }) },
      });
    }
    setDeleteOpen(false);
    setDeleting(null);
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Companies"
        subtitle="Client onboarding portfolio — track progress, modules, and go-live status."
        actions={
          canManageCompanies ? (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import
              </Button>
              <Button size="sm" className="gap-1 bg-primary" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                Add Company
              </Button>
            </div>
          ) : undefined
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
        resultLabel={filtered.length === 1 ? "company" : "companies"}
      >
        <DesignTicketFilterField label="Plan" compact>
          <DesignTicketSelect
            compact
            value={planFilter}
            onChange={setPlanFilter}
            options={[
              { value: "all", label: "All plans" },
              { value: "Annual", label: "Annual" },
              { value: "Half-Yearly", label: "Half-Yearly" },
              { value: "AMC", label: "AMC" },
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
        <DesignTicketFilterField label="Manager" compact>
          <DesignTicketSelect
            compact
            value={managerFilter}
            onChange={setManagerFilter}
            options={[
              { value: "all", label: "All managers" },
              ...(unassignedCount > 0
                ? [{ value: "unassigned", label: `Unassigned (${unassignedCount})` }]
                : []),
              ...managers.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </DesignTicketFilterField>
        <DesignTicketFilterField label="Sales Agent" compact>
          <DesignTicketSelect
            compact
            value={salesAgentFilter}
            onChange={setSalesAgentFilter}
            options={[
              { value: "all", label: "All sales agents" },
              ...(unassignedSalesCount > 0
                ? [{ value: "unassigned", label: `Unassigned (${unassignedSalesCount})` }]
                : []),
              ...salesAgents.map((m) => ({ value: m.id, label: m.name })),
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
        <DesignTicketSection title={companyKpiFilterLabel(kpiFilter)} delay={0.06} compact>
          {isAdmin && selectedIds.size > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5"
            >
              <span className="text-xs font-medium">
                {selectedIds.size} {selectedIds.size === 1 ? "company" : "companies"} selected
              </span>
              <Button size="sm" variant="outline" className="gap-1" onClick={openBulkAssign}>
                <UserRound className="h-3.5 w-3.5" />
                Assign manager
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </motion.div>
          ) : null}

          {enriched.length > 0 && filtered.length < enriched.length ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"
            >
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {enriched.length} companies — filters or KPI selection may be
                hiding some rows (new companies start as <strong>Pending</strong> / Not Started).
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            </motion.div>
          ) : null}

          {enriched.length === 0 ? (
            <EmptyState
              title="No companies yet"
              description="Add your first client company to start onboarding."
              actionLabel="+ Add Company"
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
            <div className="card-soft overflow-hidden p-0.5">
              <DataTable
                data={filtered}
                getRowId={(c) => c.id}
                searchKeys={["name", "city", "contact", "email", "plan", "health"]}
                pageSize={15}
                density="compact"
                selection={
                  isAdmin
                    ? {
                        selectedIds,
                        onToggle: toggleSelection,
                        onToggleAll: toggleSelectionAll,
                      }
                    : undefined
                }
                onRowClick={(c) =>
                  navigate({ to: "/companies/$companyId", params: { companyId: c.id } })
                }
                columns={[
              {
                key: "name",
                header: "Company",
                sortable: true,
                render: (c) => (
                  <div>
                    <div className="font-medium">
                      <a
                        href={`/companies/${c.id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.name}
                      </a>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.city} · {c.plan}
                    </div>
                  </div>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                render: (c) => (
                  <div>
                    <div>{c.contact}</div>
                    <div className="text-xs text-muted-foreground">{c.designation}</div>
                  </div>
                ),
              },
              {
                key: "onboardingManagerId",
                header: "Manager",
                render: (c) => resolveAssigneeLabel(c.onboardingManagerId, users, employees),
              },
              {
                key: "salesAgentId",
                header: "Sales Agent",
                render: (c) => resolveAssigneeLabel(c.salesAgentId, users, employees),
              },
              {
                key: "startDate",
                header: "Start Date",
                sortable: true,
                render: (c) => (
                  <span className="text-muted-foreground">
                    {formatDate(c.startDate || c.agreementDate)}
                  </span>
                ),
              },
              {
                key: "modules",
                header: "Modules",
                render: (c) => (
                  <div className="flex flex-wrap gap-1">
                    {c.modules
                      .filter((m) => m.optedIn)
                      .slice(0, 2)
                      .map((m) => (
                        <Pill key={m.moduleKey} tone="accent">
                          {m.label}
                        </Pill>
                      ))}
                    {c.modules.filter((m) => m.optedIn).length > 2 && (
                      <Pill>+{c.modules.filter((m) => m.optedIn).length - 2}</Pill>
                    )}
                  </div>
                ),
              },
              {
                key: "progress",
                header: "Progress",
                sortable: true,
                render: (c) => (
                  <div className="flex items-center gap-2">
                    <ProgressBar value={c.progress} className="w-20" />
                    <span className="text-[11px] tabular-nums text-muted-foreground">{c.progress}%</span>
                  </div>
                ),
              },
              {
                key: "computedStatus",
                header: "Status",
                sortable: true,
                render: (c) => <StatusPill status={c.computedStatus} />,
              },
              {
                key: "projects",
                header: "Projects",
                render: (c) => allProjects.filter((p) => p.companyId === c.id).length,
              },
            ]}
            actions={(c) => (
              <div className="flex justify-end gap-0.5">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setDeleting(c);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            )}
          />
            </div>
          )}
        </DesignTicketSection>
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          if (savingCompany) return;
          setModalOpen(open);
        }}
        title={editing ? "Edit Company" : "Add Company"}
        onSubmit={onSubmit}
        submitLabel={savingCompany ? "Saving…" : editing ? "Update" : "Create"}
        submitDisabled={savingCompany}
      >
        <div className="grid gap-4">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</div>
            <div>
              <label className="text-xs font-medium">{FIELD_LABELS.name}</label>
              <input {...form.register("name")} className={inputClass(!!form.formState.errors.name)} />
              {form.formState.errors.name ? (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">{FIELD_LABELS.city}</label>
                <input {...form.register("city")} className={inputClass(!!form.formState.errors.city)} />
              </div>
              <div>
                <label className="text-xs font-medium">State</label>
                <input {...form.register("state")} className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">Region</label>
                <select {...form.register("region")} className={inputClass()}>
                  {COMPANY_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Company Type</label>
                <select {...form.register("companyType")} className={inputClass()}>
                  {COMPANY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary Contact</div>
            <p className="text-xs text-muted-foreground">
              Main signatory / day-to-day contact. Owner and POC default to these if left blank.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["contact", "designation", "phone", "email"] as const).map((field) => (
                <div key={field} className={field === "email" ? "col-span-2" : undefined}>
                  <label className="text-xs font-medium">{FIELD_LABELS[field]}</label>
                  <input
                    {...form.register(field)}
                    type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                    placeholder={field === "phone" ? "10-digit mobile" : undefined}
                    className={inputClass(!!form.formState.errors[field])}
                  />
                  {form.formState.errors[field] ? (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors[field]?.message}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Owner & POC <span className="font-normal normal-case text-muted-foreground">(optional)</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Owner Name</label>
                <input {...form.register("ownerName")} placeholder="Defaults to contact person" className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">Owner Mobile</label>
                <input {...form.register("ownerMobile")} placeholder="Defaults to mobile above" className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">POC Name</label>
                <input {...form.register("pocName")} placeholder="Defaults to contact person" className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">POC Mobile</label>
                <input {...form.register("pocMobile")} placeholder="Defaults to mobile above" className={inputClass()} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Onboarding Manager</label>
            <select
              {...form.register("onboardingManagerId")}
              className={inputClass(!!form.formState.errors.onboardingManagerId)}
              disabled={!isAdmin}
            >
              {assignableUsers.length === 0 ? (
                <option value="">No users available — invite users first</option>
              ) : (
                assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                    {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                  </option>
                ))
              )}
            </select>
            {form.formState.errors.onboardingManagerId ? (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.onboardingManagerId.message}</p>
            ) : null}
            {!isAdmin ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Assigned automatically to {resolveAssigneeLabel(form.watch("onboardingManagerId"), users, employees)}.
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium">Sales Agent</label>
            <select
              {...form.register("salesAgentId")}
              className={inputClass()}
              disabled={!canAssignSalesAgent}
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
            {!canAssignSalesAgent ? (
              <p className="mt-1 text-xs text-muted-foreground">
                You do not have permission to assign sales agents.
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium">Plan</label>
            <select {...form.register("plan")} className={inputClass()}>
              {["Annual", "Half-Yearly", "AMC"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" {...form.register("annualLicense")} />
            Annual License
          </label>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Commercial & Support
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Account Manager (CSM)</label>
                <select {...form.register("csmId")} className={inputClass()}>
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Support Manager 1</label>
                <select {...form.register("supportManager1Id")} className={inputClass()}>
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Support Manager 2</label>
                <select {...form.register("supportManager2Id")} className={inputClass()}>
                  <option value="">Unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Deal Size</label>
                <input type="number" step="any" {...form.register("dealSize")} className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">Users Purchased</label>
                <input type="number" {...form.register("usersPurchased")} className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">Total Cost</label>
                <input type="number" step="any" {...form.register("totalCost")} className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">Payment Received</label>
                <input type="number" step="any" {...form.register("paymentReceived")} className={inputClass()} />
              </div>
              <div>
                <label className="text-xs font-medium">Pending Amount</label>
                <input type="number" step="any" {...form.register("pendingAmount")} className={inputClass()} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Start Date</label>
              <input type="date" {...form.register("startDate")} className={inputClass(!!form.formState.errors.startDate)} />
            </div>
            <div>
              <label className="text-xs font-medium">End Date</label>
              <input type="date" {...form.register("endDate")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Agreement Date</label>
              <input type="date" {...form.register("agreementDate")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Go-Live Target</label>
              <input type="date" {...form.register("goLiveTarget")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Plan Expiry</label>
              <input type="date" {...form.register("planExpiry")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
          </div>
          <div>
            <div className="text-xs font-medium">Modules Purchased</div>
            <div className="mt-2 grid gap-2 rounded-md border bg-muted/20 p-3">
              {MODULE_CATALOG.map((m) => {
                const selected = form.watch("modules");
                const checked = selected.includes(m.key);
                return (
                  <label key={m.key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? ([...selected, m.key] as ModuleKey[])
                          : (selected.filter((x) => x !== m.key) as ModuleKey[]);
                        form.setValue("modules", next, { shouldDirty: true, shouldValidate: true });
                      }}
                    />
                    <span>
                      <span className="font-medium">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Assign Onboarding Manager"
        submitLabel="Assign"
        onSubmit={confirmBulkAssign}
      >
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Assign a manager to {selectedIds.size} selected{" "}
            {selectedIds.size === 1 ? "company" : "companies"}.
          </p>
          <label className="text-xs font-medium">
            Onboarding Manager
            <select
              value={assignManagerId}
              onChange={(e) => setAssignManagerId(e.target.value)}
              className={inputClass()}
            >
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                  {u.email ? ` · ${u.email}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete company?"
        description={deleting ? `Remove ${deleting.name}? This cannot be undone if projects exist.` : undefined}
        onConfirm={confirmDelete}
      />

      <ProjectImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          setManagerFilter("unassigned");
          toast.message("Imported companies have no manager yet", {
            description: "Filter is set to Unassigned — select rows and assign a manager.",
          });
        }}
      />
    </PageWrap>
  );
}
