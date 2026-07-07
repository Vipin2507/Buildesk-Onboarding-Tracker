import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { MODULES } from "@/data/constants";
import {
  useCompanyStore,
  useEmployeeStore,
  useProjectStore,
  useDashboardKpis,
} from "@/stores";
import type { Company } from "@/types";
import { cn } from "@/lib/utils";

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
  onboardingManagerId: z.string(),
  csmId: z.string(),
  plan: z.enum(["Starter", "Growth", "Enterprise"]),
  health: z.enum(["Healthy", "Moderate", "Critical"]),
  modules: z.array(z.string()).min(1),
  agreementDate: z.string(),
  goLiveTarget: z.string(),
  planExpiry: z.string(),
});

type CompanyForm = z.infer<typeof companySchema>;

const FILTERS = ["All", "In Progress", "Completed", "On Hold", "Not Started"] as const;

function CompaniesPage() {
  const addCompany = useCompanyStore((s) => s.addCompany);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const deleteCompany = useCompanyStore((s) => s.deleteCompany);
  const allProjects = useProjectStore((s) => s.projects);
  const employees = useEmployeeStore((s) => s.employees);
  const kpis = useDashboardKpis();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "", contact: "", designation: "", phone: "", email: "", city: "",
      onboardingManagerId: employees[0]?.id ?? "",
      csmId: employees.find((e) => e.role === "CSM")?.id ?? "",
      plan: "Growth", health: "Healthy",
      modules: [...MODULES.slice(0, 3)],
      agreementDate: new Date().toISOString().slice(0, 10),
      goLiveTarget: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      planExpiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    },
  });

  const enriched = kpis.companiesWithProgress;

  const filtered = enriched.filter((c) => {
    if (filter === "All") return true;
    const map: Record<string, string> = {
      "In Progress": "in_progress",
      Completed: "completed",
      "On Hold": "on_hold",
      "Not Started": "not_started",
    };
    return c.computedStatus === map[filter] || c.status === map[filter];
  });

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
      onboardingManagerId: c.onboardingManagerId, csmId: c.csmId,
      plan: c.plan, health: c.health, modules: c.modules,
      agreementDate: c.agreementDate, goLiveTarget: c.goLiveTarget, planExpiry: c.planExpiry,
    });
    setModalOpen(true);
  }

  function onSubmit() {
    form.handleSubmit((data) => {
      if (editing) {
        updateCompany(editing.id, { ...data, status: editing.status });
        toast.success("Company updated");
      } else {
        const company = addCompany({ ...data, status: "not_started" });
        toast.success("Company added", { action: { label: "View", onClick: () => navigate({ to: "/companies/$companyId", params: { companyId: company.id } }) } });
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

  return (
    <PageWrap>
      <PageHeader
        title="Companies"
        subtitle="All client companies onboarding to Buildesk."
        actions={<Button className="gap-1.5 bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="h-4 w-4" /> Add Company</Button>}
      />

      <div className="card-soft mb-4 flex flex-wrap items-center gap-2 p-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >{f}</button>
        ))}
      </div>

      <div className="card-soft overflow-hidden p-4">
        {filtered.length === 0 ? (
          <EmptyState title="No companies yet" description="Add your first client company to start onboarding." actionLabel="+ Add Company" onAction={openCreate} />
        ) : (
          <DataTable
            data={filtered}
            searchKeys={["name", "city"]}
            onRowClick={(c) => navigate({ to: "/companies/$companyId", params: { companyId: c.id } })}
            columns={[
              { key: "name", header: "Company", sortable: true, render: (c) => (
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.city} · {c.plan}</div>
                </div>
              )},
              { key: "contact", header: "Contact", render: (c) => (
                <div><div>{c.contact}</div><div className="text-xs text-muted-foreground">{c.designation}</div></div>
              )},
              { key: "onboardingManagerId", header: "Manager", render: (c) => employees.find((e) => e.id === c.onboardingManagerId)?.name ?? "—" },
              { key: "modules", header: "Modules", render: (c) => (
                <div className="flex flex-wrap gap-1">
                  {c.modules.slice(0, 2).map((m) => <Pill key={m} tone="accent">{m}</Pill>)}
                  {c.modules.length > 2 && <Pill>+{c.modules.length - 2}</Pill>}
                </div>
              )},
              { key: "progress", header: "Progress", sortable: true, render: (c) => (
                <div className="flex items-center gap-2">
                  <ProgressBar value={c.progress} className="w-28" />
                  <span className="text-xs text-muted-foreground">{c.progress}%</span>
                </div>
              )},
              { key: "computedStatus", header: "Status", render: (c) => <StatusPill status={c.computedStatus} /> },
              { key: "projects", header: "Projects", render: (c) => allProjects.filter((p) => p.companyId === c.id).length },
            ]}
            actions={(c) => (
              <div className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { setDeleting(c); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            )}
          />
        )}
      </div>

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit Company" : "Add Company"} onSubmit={onSubmit} submitLabel={editing ? "Update" : "Create"}>
        <div className="grid gap-3">
          {(["name", "contact", "designation", "phone", "email", "city"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs font-medium capitalize">{field}</label>
              <input {...form.register(field)} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium">Onboarding Manager</label>
            <select {...form.register("onboardingManagerId")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {employees.filter((e) => e.role.includes("Onboarding") || e.role.includes("Implementation")).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Plan</label>
            <select {...form.register("plan")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {["Starter", "Growth", "Enterprise"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
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
