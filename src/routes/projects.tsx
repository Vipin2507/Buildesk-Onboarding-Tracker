import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import {
  ProjectFormModal,
  formValuesToProjectPatch,
  type ProjectFormValues,
} from "@/components/project-form-modal";
import { useCompanyStore, useProjectStore, useOnboardingStore, calcProjectProgress } from "@/stores";
import type { Project } from "@/types";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

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
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const enriched = useMemo(
    () =>
      projects.map((p) => ({
        ...p,
        companyName: companies.find((c) => c.id === p.companyId)?.name ?? "",
        progress: calcProjectProgress(p.id, checklistItems),
      })),
    [projects, companies, checklistItems],
  );

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setModalOpen(true);
  }

  function onSave(data: ProjectFormValues) {
    const patch = formValuesToProjectPatch(data);
    if (editing) {
      updateProject(editing.id, patch);
      toast.success("Project updated");
    } else {
      const project = addProject({ ...patch, status: "not_started", currentStep: 0 });
      toast.success("Project created", {
        action: {
          label: "Open",
          onClick: () =>
            navigate({
              to: "/projects/$projectId",
              params: { projectId: project.id },
              search: { tab: "onboarding" },
            }),
        },
      });
    }
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
        actions={
          <Button className="gap-1.5 bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Project
          </Button>
        }
      />

      {enriched.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project linked to a company."
          actionLabel="+ Add Project"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {enriched.map((p) => (
            <div key={p.id} className="card-soft relative p-4 transition-shadow hover:shadow-[var(--shadow-elevated)] sm:p-5">
              <Link
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                search={{ tab: "onboarding" }}
                className="block"
              >
                <div className="mb-2 flex items-start gap-3">
                  {p.logoUrl ? (
                    <img src={p.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-border" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {p.companyName}
                      {p.city ? ` · ${p.city}` : ""}
                      {p.state ? `, ${p.state}` : ""}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {p.type} · {p.units} units
                    {p.totalTowers ? ` · ${p.totalTowers} towers` : ""}
                  </span>
                </div>
                <div className="mt-3">
                  <ProgressBar value={p.progress} />
                </div>
              </Link>
              <div className="mt-3 flex justify-end gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => openEdit(p)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    setDeleting(p);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        companies={companies}
        editing={editing}
        onSave={onSave}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={deleting ? `Remove ${deleting.name}?` : undefined}
        onConfirm={confirmDelete}
      />
    </PageWrap>
  );
}
