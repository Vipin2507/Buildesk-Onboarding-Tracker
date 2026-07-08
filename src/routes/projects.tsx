import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { useCompanyStore, useProjectStore, useOnboardingStore, calcProjectProgress } from "@/stores";
import type { Project } from "@/types";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

const projectSchema = z.object({
  name: z.string().min(2),
  companyId: z.string(),
  type: z.string().min(2),
  units: z.coerce.number().min(1),
  city: z.string().min(2),
  rera: z.string().min(5),
});

type ProjectForm = z.infer<typeof projectSchema>;

function ProjectsPage() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;

  return <ProjectsListPage />;
}

function ProjectsListPage() {
  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const companies = useCompanyStore((s) => s.companies);
  const allProjects = useProjectStore((s) => s.projects);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const form = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", companyId: companies[0]?.id ?? "", type: "Residential", units: 100, city: "", rera: "" },
  });

  const enriched = useMemo(() => projects.map((p) => ({
    ...p,
    companyName: companies.find((c) => c.id === p.companyId)?.name ?? "",
    progress: calcProjectProgress(p.id, checklistItems),
  })), [projects, companies, checklistItems]);

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", companyId: companies[0]?.id ?? "", type: "Residential", units: 100, city: companies[0]?.city ?? "", rera: "" });
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    form.reset({ name: p.name, companyId: p.companyId, type: p.type, units: p.units, city: p.city, rera: p.rera });
    setModalOpen(true);
  }

  function onSubmit() {
    form.handleSubmit((data) => {
      if (editing) {
        updateProject(editing.id, data);
        toast.success("Project updated");
      } else {
        const project = addProject({ ...data, status: "not_started", currentStep: 0 });
        toast.success("Project created", { action: { label: "Open", onClick: () => navigate({ to: "/projects/$projectId", params: { projectId: project.id }, search: { tab: "onboarding" } }) } });
      }
      setModalOpen(false);
    })();
  }

  function confirmDelete() {
    if (!deleting) return;
    const removed = deleteProject(deleting.id);
    if (removed) toast.success("Project deleted");
    setDeleteOpen(false);
  }

  return (
    <PageWrap>
      <PageHeader
        title="Projects"
        subtitle="All projects across every client company."
        actions={<Button className="gap-1.5 bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="h-4 w-4" /> Add Project</Button>}
      />

      {enriched.length === 0 ? (
        <EmptyState title="No projects yet" description="Create a project linked to a company." actionLabel="+ Add Project" onAction={openCreate} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {enriched.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              search={{ tab: "onboarding" }}
              className="card-soft block p-5 transition-shadow hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.companyName} · {p.city}</p>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted-foreground">Type</div><div className="font-medium">{p.type}</div></div>
                <div><div className="text-muted-foreground">Units</div><div className="font-medium">{p.units}</div></div>
                <div><div className="text-muted-foreground">RERA</div><div className="truncate font-mono text-[10px]">{p.rera}</div></div>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Onboarding</span>
                  <span>{p.progress}%</span>
                </div>
                <ProgressBar value={p.progress} />
              </div>
              <div className="mt-3 flex justify-end gap-1" onClick={(e) => e.preventDefault()}>
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { setDeleting(p); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <EntityFormModal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit Project" : "Add Project"} onSubmit={onSubmit}>
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-medium">Company</label>
            <select {...form.register("companyId")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {(["name", "type", "city", "rera"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs font-medium capitalize">{field}</label>
              <input {...form.register(field)} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium">Units</label>
            <input type="number" {...form.register("units")} className="mt-1 h-9 w-full rounded-md border px-3 text-sm" />
          </div>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete project?" description={deleting ? `Remove ${deleting.name}?` : undefined} onConfirm={confirmDelete} />
    </PageWrap>
  );
}
