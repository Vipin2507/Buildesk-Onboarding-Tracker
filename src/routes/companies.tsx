import { createFileRoute, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { StatusPill, Pill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { ListToolbar, compareNumber, compareText, inDateRange } from "@/components/list-toolbar";
import { MODULE_CATALOG, createCompanyModules, normalizeCompanyModules } from "@/data/module-catalog";
import { ProgressSummaryCards } from "@/components/progress-summary-cards";
import {
  useCompanyStore,
  useEmployeeStore,
  useProjectStore,
  useDashboardKpis,
} from "@/stores";
import { isCompanyModulesAllLive } from "@/lib/module-progress";
import type { Company, ModuleKey } from "@/types";
import { COMPANY_REGIONS } from "@/types";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/companies")({
  component: CompaniesPage,
});

const companySchema = z.object({
  name: z.string().min(2),
  contact: z.string().min(2),
  designation: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email(),
  city: z.string().min(2),
  region: z.enum(["NCR", "South", "West", "Rest of India"]),
  ownerName: z.string().min(1),
  ownerMobile: z.string().min(1),
  pocName: z.string().min(1),
  pocMobile: z.string().min(1),
  onboardingManagerId: z.string(),
  csmId: z.string(),
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
});

type CompanyForm = z.infer<typeof companySchema>;

const STATUS_CHIPS = [
  { id: "all", label: "All", status: null as string | null },
  { id: "in_progress", label: "In Progress", status: "in_progress" },
  { id: "completed", label: "Completed", status: "completed" },
  { id: "on_hold", label: "On Hold", status: "on_hold" },
  { id: "not_started", label: "Not Started", status: "not_started" },
] as const;

type CompanySort = "name" | "progress" | "startDate" | "city" | "plan" | "health";

function CompaniesPage() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;

  return <CompaniesListPage />;
}

function CompaniesListPage() {
  const addCompany = useCompanyStore((s) => s.addCompany);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const deleteCompany = useCompanyStore((s) => s.deleteCompany);
  const allProjects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);
  const kpis = useDashboardKpis();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<CompanySort>("startDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "", contact: "", designation: "", phone: "", email: "", city: "",
      region: "Rest of India",
      ownerName: "", ownerMobile: "", pocName: "", pocMobile: "",
      onboardingManagerId: employees[0]?.id ?? "",
      csmId: employees.find((e) => e.role === "CSM")?.id ?? "",
      plan: "Half-Yearly", health: "Healthy",
      modules: [],
      agreementDate: new Date().toISOString().slice(0, 10),
      startDate: new Date().toISOString().slice(0, 10),
      goLiveTarget: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      planExpiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    },
  });

  function mergeModules(existing: Company["modules"], selected: ModuleKey[]) {
    const baseline = createCompanyModules(selected);
    return baseline.map((m) => {
      const prev = existing.find((x) => x.moduleKey === m.moduleKey);
      if (!m.optedIn) return { ...m, liveAt: undefined, pocName: prev?.pocName, pocMobile: prev?.pocMobile };
      if (prev?.optedIn) {
        return {
          ...m,
          optedOnDate: prev.optedOnDate,
          liveAt: prev.liveAt,
          pocName: prev.pocName,
          pocMobile: prev.pocMobile,
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
    const ids = new Set(enriched.map((c) => c.onboardingManagerId).filter(Boolean));
    return employees
      .filter((e) => ids.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enriched, employees]);

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
    const q = search.trim().toLowerCase();
    let rows = enriched.filter((c) => {
      if (statusFilter !== "all") {
        const chip = STATUS_CHIPS.find((s) => s.id === statusFilter);
        if (chip?.status && c.computedStatus !== chip.status && c.status !== chip.status) {
          return false;
        }
      }
      if (planFilter !== "all" && c.plan !== planFilter) return false;
      if (healthFilter !== "all" && c.health !== healthFilter) return false;
      if (managerFilter !== "all" && c.onboardingManagerId !== managerFilter) return false;
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      if (progressFilter === "0" && c.progress !== 0) return false;
      if (progressFilter === "1-49" && !(c.progress >= 1 && c.progress <= 49)) return false;
      if (progressFilter === "50-99" && !(c.progress >= 50 && c.progress <= 99)) return false;
      if (progressFilter === "100" && c.progress !== 100) return false;
      if (!inDateRange(c.startDate || c.agreementDate, dateFrom, dateTo)) return false;
      if (q) {
        const hay = [c.name, c.city, c.contact, c.email, c.plan, c.health]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      switch (sortBy) {
        case "progress":
          return compareNumber(a.progress, b.progress, sortDir);
        case "startDate":
          return compareText(
            a.startDate || a.agreementDate || "",
            b.startDate || b.agreementDate || "",
            sortDir,
          );
        case "city":
          return compareText(a.city, b.city, sortDir);
        case "plan":
          return compareText(a.plan, b.plan, sortDir);
        case "health":
          return compareText(a.health, b.health, sortDir);
        case "name":
        default:
          return compareText(a.name, b.name, sortDir);
      }
    });

    return rows;
  }, [
    enriched,
    search,
    statusFilter,
    planFilter,
    healthFilter,
    managerFilter,
    cityFilter,
    progressFilter,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
  ]);

  const activeFilterCount = [
    statusFilter !== "all",
    planFilter !== "all",
    healthFilter !== "all",
    progressFilter !== "all",
    managerFilter !== "all",
    cityFilter !== "all",
    Boolean(dateFrom),
    Boolean(dateTo),
    search.trim() !== "",
  ].filter(Boolean).length;

  const portfolioCards = useMemo(() => {
    const total = filtered.length;
    const pending = filtered.filter(
      (c) => c.progress === 0 || c.computedStatus === "not_started" || c.status === "not_started",
    ).length;
    const inProgress = filtered.filter(
      (c) => !c.isLive && c.progress > 0 && c.progress < 100 && c.computedStatus !== "completed",
    ).length;
    const live = filtered.filter(
      (c) =>
        c.isLive ||
        c.progress >= 100 ||
        c.computedStatus === "completed" ||
        isCompanyModulesAllLive(normalizeCompanyModules(c.modules)),
    ).length;
    const avg =
      total === 0 ? 0 : Math.round(filtered.reduce((sum, c) => sum + c.progress, 0) / total);
    return [
      { id: "total", label: "Total", value: total },
      { id: "pending", label: "Pending", value: pending, hint: "Not started / 0%" },
      { id: "in_progress", label: "In Progress", value: inProgress },
      { id: "live", label: "Live", value: live },
      { id: "avg", label: "Average %", value: avg, suffix: "%" },
      { id: "overall", label: "Overall %", value: avg, suffix: "%", hint: "Mean of company %" },
    ];
  }, [filtered]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPlanFilter("all");
    setHealthFilter("all");
    setProgressFilter("all");
    setManagerFilter("all");
    setCityFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function openCreate() {
    setEditing(null);
    form.reset();
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
      plan: c.plan,
      health: c.health,
      modules: normalizeCompanyModules(c.modules).filter((m) => m.optedIn).map((m) => m.moduleKey),
      agreementDate: c.agreementDate,
      startDate: c.startDate || c.agreementDate,
      goLiveTarget: c.goLiveTarget,
      planExpiry: c.planExpiry,
    });
    setModalOpen(true);
  }

  function onSubmit() {
    form.handleSubmit((data) => {
      if (editing) {
        updateCompany(editing.id, {
          ...data,
          status: editing.status,
          modules: mergeModules(editing.modules, data.modules),
        });
        toast.success("Company updated");
      } else {
        const company = addCompany({
          ...data,
          status: "not_started",
          modules: createCompanyModules(data.modules),
        });
        toast.success("Company added", {
          action: {
            label: "View",
            onClick: () => navigate({ to: "/companies/$companyId", params: { companyId: company.id } }),
          },
        });
      }
      setModalOpen(false);
    })();
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
        action: { label: "Undo", onClick: () => addCompany({ ...removed, status: removed.status }) },
      });
    }
    setDeleteOpen(false);
    setDeleting(null);
  }

  const citySelect =
    cities.length > 1
      ? [
          {
            id: "city",
            label: "City",
            value: cityFilter,
            onChange: setCityFilter,
            options: [
              { value: "all", label: "All cities" },
              ...cities.map((city) => ({ value: city, label: city })),
            ],
          },
        ]
      : [];

  return (
    <PageWrap>
      <PageHeader
        title="Companies"
        subtitle="All client companies onboarding to Buildesk."
        actions={
          <Button className="gap-1.5 bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Company
          </Button>
        }
      />

      <ProgressSummaryCards cards={portfolioCards} />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search companies, cities, contacts…"
        chips={STATUS_CHIPS.map((c) => ({
          id: c.id,
          label: c.label,
          count: statusCounts[c.id] ?? 0,
        }))}
        activeChip={statusFilter}
        onChipChange={setStatusFilter}
        dateRange={{
          label: "Start date",
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
        }}
        selects={[
          {
            id: "plan",
            label: "Plan",
            value: planFilter,
            onChange: setPlanFilter,
            options: [
              { value: "all", label: "All plans" },
              { value: "Annual", label: "Annual" },
              { value: "Half-Yearly", label: "Half-Yearly" },
              { value: "AMC", label: "AMC" },
            ],
          },
          {
            id: "health",
            label: "Health",
            value: healthFilter,
            onChange: setHealthFilter,
            options: [
              { value: "all", label: "All health" },
              { value: "Healthy", label: "Healthy" },
              { value: "Moderate", label: "Moderate" },
              { value: "Critical", label: "Critical" },
            ],
          },
          {
            id: "progress",
            label: "Progress",
            value: progressFilter,
            onChange: setProgressFilter,
            options: [
              { value: "all", label: "Any progress" },
              { value: "0", label: "Not started (0%)" },
              { value: "1-49", label: "Early (1–49%)" },
              { value: "50-99", label: "Advanced (50–99%)" },
              { value: "100", label: "Complete (100%)" },
            ],
          },
          {
            id: "manager",
            label: "Manager",
            value: managerFilter,
            onChange: setManagerFilter,
            options: [
              { value: "all", label: "All managers" },
              ...managers.map((m) => ({ value: m.id, label: m.name })),
            ],
          },
          ...citySelect,
        ]}
        sortOptions={[
          { value: "name", label: "Sort: Name" },
          { value: "progress", label: "Sort: Progress" },
          { value: "startDate", label: "Sort: Start date" },
          { value: "city", label: "Sort: City" },
          { value: "plan", label: "Sort: Plan" },
          { value: "health", label: "Sort: Health" },
        ]}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortByChange={(v) => setSortBy(v as CompanySort)}
        onSortDirChange={setSortDir}
        resultCount={filtered.length}
        resultLabel={filtered.length === 1 ? "company" : "companies"}
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
      />

      <div className="card-soft overflow-hidden p-4">
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
            description="Try clearing filters or adjusting your search."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        ) : (
          <DataTable
            data={filtered}
            hideSearch
            getRowId={(c) => c.id}
            onRowClick={(c) => navigate({ to: "/companies/$companyId", params: { companyId: c.id } })}
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
                render: (c) => employees.find((e) => e.id === c.onboardingManagerId)?.name ?? "—",
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
                    <ProgressBar value={c.progress} className="w-28" />
                    <span className="text-xs text-muted-foreground">{c.progress}%</span>
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
              <div className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setDeleting(c);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          />
        )}
      </div>

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Company" : "Add Company"}
        onSubmit={onSubmit}
        submitLabel={editing ? "Update" : "Create"}
      >
        <div className="grid gap-3">
          {(["name", "contact", "designation", "phone", "email", "city"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs font-medium capitalize">{field}</label>
              <input {...form.register(field)} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium">Region</label>
            <select {...form.register("region")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {COMPANY_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Owner Name</label>
              <input {...form.register("ownerName")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Owner Mobile</label>
              <input {...form.register("ownerMobile")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">POC Name</label>
              <input {...form.register("pocName")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">POC Mobile</label>
              <input {...form.register("pocMobile")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Onboarding Manager</label>
            <select {...form.register("onboardingManagerId")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {employees
                .filter((e) => e.role.includes("Onboarding") || e.role.includes("Implementation"))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Plan</label>
            <select {...form.register("plan")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {["Annual", "Half-Yearly", "AMC"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Start Date</label>
              <input type="date" {...form.register("startDate")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
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

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete company?"
        description={deleting ? `Remove ${deleting.name}? This cannot be undone if projects exist.` : undefined}
        onConfirm={confirmDelete}
      />
    </PageWrap>
  );
}
