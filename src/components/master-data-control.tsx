import { useEffect, useMemo, useState } from "react";
import { Pencil, Search, Table2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import {
  ProjectFormModal,
  formValuesToProjectAdminPatch,
  type ProjectAdminFormValues,
} from "@/components/project-form-modal";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { MODULE_CATALOG, createCompanyModules } from "@/data/module-catalog";
import { cn, formatDate } from "@/lib/utils";
import {
  useCompanyStore,
  useEmployeeStore,
  usePostSalesStore,
  useProjectStore,
} from "@/stores";
import type { Company, CompanyHealth, CompanyPlan, ModuleKey, Project, StatusKey } from "@/types";
import { STATUS_LABEL } from "@/types";

type EntityTab = "companies" | "projects";

const companyAdminSchema = z.object({
  name: z.string().min(2),
  contact: z.string().min(1),
  designation: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  city: z.string().min(1),
  officeAddress: z.string().optional(),
  gstNumber: z.string().optional(),
  billingInfo: z.string().optional(),
  onboardingManagerId: z.string().min(1),
  csmId: z.string().min(1),
  status: z.enum(["not_started", "in_progress", "review", "completed", "on_hold"]),
  plan: z.enum(["Starter", "Growth", "Enterprise"]),
  health: z.enum(["Healthy", "Moderate", "Critical"]),
  agreementDate: z.string().min(1),
  startDate: z.string().min(1),
  goLiveTarget: z.string().min(1),
  planExpiry: z.string().min(1),
  renewedAt: z.string().optional(),
  modules: z.array(z.string()),
});

type CompanyAdminForm = z.infer<typeof companyAdminSchema>;

const inputClass =
  "mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";

export function DataControlPanel() {
  const companies = useCompanyStore((s) => s.companies);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const projects = useProjectStore((s) => s.projects);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const getByCompany = useProjectStore((s) => s.getByCompany);
  const employees = useEmployeeStore((s) => s.employees);

  const [tab, setTab] = useState<EntityTab>("companies");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...companies].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [companies, query]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...projects].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((p) => {
      const companyName = companies.find((c) => c.id === p.companyId)?.name ?? "";
      return (
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        companyName.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q)
      );
    });
  }, [projects, companies, query]);

  const rows = tab === "companies" ? filteredCompanies : filteredProjects;
  const allVisibleIds = rows.map((r) => r.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  function switchTab(next: EntityTab) {
    setTab(next);
    setSelected(new Set());
    setQuery("");
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(allVisibleIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cascadeDeleteCompany(companyId: string) {
    const linked = useProjectStore.getState().getByCompany(companyId);
    for (const p of linked) useProjectStore.getState().deleteProject(p.id);
    const postSales = usePostSalesStore.getState().projects.filter((p) => p.companyId === companyId);
    for (const ps of postSales) usePostSalesStore.getState().deleteProject(ps.id);
    useCompanyStore.getState().deleteCompany(companyId);
    return linked.length;
  }

  function linkedProjectCount(companyIds: string[]) {
    return companyIds.reduce((n, id) => n + getByCompany(id).length, 0);
  }

  function openDeleteSingle(id: string) {
    setDeleteMode("single");
    setPendingIds([id]);
    setDeleteOpen(true);
  }

  function openDeleteBulk() {
    if (selected.size === 0) return;
    setDeleteMode("bulk");
    setPendingIds([...selected]);
    setDeleteOpen(true);
  }

  function confirmDelete() {
    if (tab === "companies") {
      let projectsRemoved = 0;
      for (const id of pendingIds) {
        projectsRemoved += cascadeDeleteCompany(id);
      }
      toast.success(
        `Deleted ${pendingIds.length} compan${pendingIds.length === 1 ? "y" : "ies"}` +
          (projectsRemoved ? ` and ${projectsRemoved} project${projectsRemoved === 1 ? "" : "s"}` : ""),
      );
    } else {
      for (const id of pendingIds) deleteProject(id);
      toast.success(`Deleted ${pendingIds.length} project${pendingIds.length === 1 ? "" : "s"}`);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pendingIds) next.delete(id);
      return next;
    });
    setDeleteOpen(false);
    setPendingIds([]);
  }

  const deleteTitle =
    tab === "companies"
      ? deleteMode === "bulk"
        ? `Delete ${pendingIds.length} companies?`
        : "Delete company?"
      : deleteMode === "bulk"
        ? `Delete ${pendingIds.length} projects?`
        : "Delete project?";

  const deleteDescription =
    tab === "companies"
      ? `This permanently removes ${pendingIds.length} compan${pendingIds.length === 1 ? "y" : "ies"} and ${linkedProjectCount(pendingIds)} linked project${linkedProjectCount(pendingIds) === 1 ? "" : "s"} (including post-sales trackers).`
      : pendingIds.length === 1
        ? `Remove ${projects.find((p) => p.id === pendingIds[0])?.name ?? "this project"}? Onboarding data for it will also be cleared.`
        : `Remove ${pendingIds.length} projects and their onboarding data?`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Table2 className="h-4 w-4 text-primary" />
            Data Control
          </h3>
          <p className="text-xs text-muted-foreground">
            Edit every field on companies and projects. Delete single or multiple records. Company
            delete cascades to linked projects.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["companies", "projects"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {t} ({t === "companies" ? companies.length : projects.length})
          </button>
        ))}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "companies" ? "Search companies…" : "Search projects…"}
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <span className="text-sm font-medium">
            {selected.size} selected
            {tab === "companies" ? ` · ${linkedProjectCount([...selected])} linked projects` : ""}
          </span>
          <Button type="button" size="sm" variant="destructive" className="gap-1.5" onClick={openDeleteBulk}>
            <Trash2 className="h-3.5 w-3.5" /> Delete selected
          </Button>
        </div>
      )}

      <div className="card-soft overflow-hidden">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          {tab === "companies" ? (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b bg-muted/90 backdrop-blur">
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Company</th>
                  <th className="px-3 py-2.5 font-medium">Contact</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 font-medium">Start</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Projects</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No companies match.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((c) => {
                    const projectCount = getByCompany(c.id).length;
                    return (
                      <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleOne(c.id)}
                            aria-label={`Select ${c.name}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.city}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div>{c.contact}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.plan}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {formatDate(c.startDate || c.agreementDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={c.status} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{projectCount}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingCompany(c)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => openDeleteSingle(c.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b bg-muted/90 backdrop-blur">
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Project</th>
                  <th className="px-3 py-2.5 font-medium">Company</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Start</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Units</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No projects match.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => {
                    const companyName = companies.find((c) => c.id === p.companyId)?.name ?? "—";
                    return (
                      <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                            aria-label={`Select ${p.name}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.city}</div>
                        </td>
                        <td className="px-3 py-2.5">{companyName}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.type}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatDate(p.startDate)}</td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.units}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingProject(p);
                                setProjectModalOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => openDeleteSingle(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CompanyAdminEditModal
        company={editingCompany}
        employees={employees}
        onClose={() => setEditingCompany(null)}
        onSave={(id, patch) => {
          updateCompany(id, patch);
          toast.success("Company updated");
          setEditingCompany(null);
        }}
      />

      <ProjectFormModal
        open={projectModalOpen}
        onOpenChange={(open) => {
          setProjectModalOpen(open);
          if (!open) setEditingProject(null);
        }}
        companies={companies}
        editing={editingProject}
        adminMode
        onSave={(data) => {
          if (!editingProject) return;
          updateProject(editingProject.id, formValuesToProjectAdminPatch(data as ProjectAdminFormValues));
          toast.success("Project updated");
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel="Delete permanently"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CompanyAdminEditModal({
  company,
  employees,
  onClose,
  onSave,
}: {
  company: Company | null;
  employees: { id: string; name: string; role: string }[];
  onClose: () => void;
  onSave: (id: string, patch: Partial<Company>) => void;
}) {
  const form = useForm<CompanyAdminForm>({
    resolver: zodResolver(companyAdminSchema),
    defaultValues: companyToForm(company),
  });

  const open = !!company;

  useEffect(() => {
    if (company) form.reset(companyToForm(company));
  }, [company, form]);

  const managers = employees.filter(
    (e) => e.role.includes("Onboarding") || e.role.includes("Implementation") || e.role === "Admin",
  );
  const csms = employees.filter((e) => e.role === "CSM" || e.role === "Admin");

  function submit() {
    if (!company) return;
    void form.handleSubmit((data) => {
      const modules = createCompanyModules(data.modules as ModuleKey[], data.startDate).map((m) => {
        const prev = company.modules.find((x) => x.moduleKey === m.moduleKey);
        if (m.optedIn && prev?.optedIn) return { ...m, optedOnDate: prev.optedOnDate ?? m.optedOnDate };
        return m;
      });
      onSave(company.id, {
        name: data.name.trim(),
        contact: data.contact.trim(),
        designation: data.designation.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
        city: data.city.trim(),
        officeAddress: data.officeAddress?.trim() || undefined,
        gstNumber: data.gstNumber?.trim() || undefined,
        billingInfo: data.billingInfo?.trim() || undefined,
        onboardingManagerId: data.onboardingManagerId,
        csmId: data.csmId,
        status: data.status as StatusKey,
        plan: data.plan as CompanyPlan,
        health: data.health as CompanyHealth,
        agreementDate: data.agreementDate,
        startDate: data.startDate,
        goLiveTarget: data.goLiveTarget,
        planExpiry: data.planExpiry,
        renewedAt: data.renewedAt?.trim() || undefined,
        modules,
      });
    }, () => toast.error("Please fix the highlighted fields"))();
  }

  const selectedModules = form.watch("modules") ?? [];

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="flex max-h-[92vh] w-[min(96vw,720px)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="border-b px-6 py-4 text-left">
          <AlertDialogTitle>Edit company — {company?.name}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto px-6 py-4">
          <Section title="Profile">
            <Field label="Name">
              <input {...form.register("name")} className={inputClass} />
            </Field>
            <Field label="City">
              <input {...form.register("city")} className={inputClass} />
            </Field>
            <Field label="Office address" className="sm:col-span-2">
              <input {...form.register("officeAddress")} className={inputClass} />
            </Field>
            <Field label="GST">
              <input {...form.register("gstNumber")} className={inputClass} />
            </Field>
            <Field label="Billing info">
              <input {...form.register("billingInfo")} className={inputClass} />
            </Field>
          </Section>

          <Section title="Primary contact">
            <Field label="Contact">
              <input {...form.register("contact")} className={inputClass} />
            </Field>
            <Field label="Designation">
              <input {...form.register("designation")} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input {...form.register("phone")} className={inputClass} />
            </Field>
            <Field label="Email">
              <input {...form.register("email")} className={inputClass} />
            </Field>
          </Section>

          <Section title="Ownership & status">
            <Field label="Onboarding manager">
              <select {...form.register("onboardingManagerId")} className={inputClass}>
                {managers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="CSM">
              <select {...form.register("csmId")} className={inputClass}>
                {csms.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select {...form.register("status")} className={inputClass}>
                {(Object.keys(STATUS_LABEL) as StatusKey[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Plan">
              <select {...form.register("plan")} className={inputClass}>
                {(["Starter", "Growth", "Enterprise"] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Health">
              <select {...form.register("health")} className={inputClass}>
                {(["Healthy", "Moderate", "Critical"] as const).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Dates">
            <Field label="Start date">
              <input type="date" {...form.register("startDate")} className={inputClass} />
            </Field>
            <Field label="Agreement date">
              <input type="date" {...form.register("agreementDate")} className={inputClass} />
            </Field>
            <Field label="Go-live target">
              <input type="date" {...form.register("goLiveTarget")} className={inputClass} />
            </Field>
            <Field label="Plan expiry">
              <input type="date" {...form.register("planExpiry")} className={inputClass} />
            </Field>
            <Field label="Renewed at (ISO optional)" className="sm:col-span-2">
              <input
                {...form.register("renewedAt")}
                className={inputClass}
                placeholder="2025-01-15T10:00:00.000Z"
              />
            </Field>
          </Section>

          <Section title="Modules">
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              {MODULE_CATALOG.map((m) => {
                const checked = selectedModules.includes(m.key);
                return (
                  <label
                    key={m.key}
                    className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selectedModules.filter((k) => k !== m.key)
                          : [...selectedModules, m.key];
                        form.setValue("modules", next, { shouldDirty: true });
                      }}
                    />
                    <span>
                      <span className="font-medium">{m.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{m.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Section>
        </div>
        <AlertDialogFooter className="border-t px-6 py-4">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" onClick={submit}>
            Save changes
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function companyToForm(company: Company | null): CompanyAdminForm {
  if (!company) {
    return {
      name: "",
      contact: "",
      designation: "",
      phone: "",
      email: "",
      city: "",
      officeAddress: "",
      gstNumber: "",
      billingInfo: "",
      onboardingManagerId: "",
      csmId: "",
      status: "not_started",
      plan: "Growth",
      health: "Healthy",
      agreementDate: "",
      startDate: "",
      goLiveTarget: "",
      planExpiry: "",
      renewedAt: "",
      modules: [],
    };
  }
  return {
    name: company.name,
    contact: company.contact,
    designation: company.designation,
    phone: company.phone,
    email: company.email,
    city: company.city,
    officeAddress: company.officeAddress ?? "",
    gstNumber: company.gstNumber ?? "",
    billingInfo: company.billingInfo ?? "",
    onboardingManagerId: company.onboardingManagerId,
    csmId: company.csmId,
    status: company.status,
    plan: company.plan,
    health: company.health,
    agreementDate: company.agreementDate,
    startDate: company.startDate || company.agreementDate,
    goLiveTarget: company.goLiveTarget,
    planExpiry: company.planExpiry,
    renewedAt: company.renewedAt ?? "",
    modules: company.modules.filter((m) => m.optedIn).map((m) => m.moduleKey),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-xs font-medium", className)}>
      {label}
      {children}
    </label>
  );
}
