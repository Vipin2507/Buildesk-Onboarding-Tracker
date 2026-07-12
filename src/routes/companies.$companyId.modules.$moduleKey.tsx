import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { EmptyState, EntityNotFound } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import {
  useCompanyStore,
  useModuleProgress,
  usePostSalesProjectsForCompany,
  usePostSalesStore,
} from "@/stores";
import { MODULE_CATALOG, getModuleLabel } from "@/data/module-catalog";
import type { ModuleKey, PostSalesProject } from "@/types";
import { formatRelativeTime } from "@/types/common";

export const Route = createFileRoute("/companies/$companyId/modules/$moduleKey")({
  component: ModuleLandingPage,
});

function ModuleLandingPage() {
  const rawParams = Route.useParams();
  const { companyId, moduleKey } = z
    .object({
      companyId: z.string(),
      moduleKey: z.enum([
        "post-sales",
        "vendor-management",
        "labor-management",
        "customer-app",
        "construction-management",
        "project-management",
      ]),
    })
    .parse(rawParams);
  const loading = useDetailLoading();
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const progress = useModuleProgress(companyId, moduleKey as ModuleKey);
  const catalog = MODULE_CATALOG.find((m) => m.key === moduleKey);

  if (loading) return <DetailPageSkeleton />;
  if (!company) return <EntityNotFound entity="Company" listPath="/companies" listLabel="Companies" />;

  const companyModule = company.modules.find((m) => m.moduleKey === moduleKey);
  if (!companyModule?.optedIn) {
    return (
      <PageWrap>
        <Breadcrumbs
          items={[
            { label: "Companies", to: "/companies" },
            { label: company.name, to: "/companies/$companyId", params: { companyId } },
            { label: getModuleLabel(moduleKey as ModuleKey) },
          ]}
        />
        <PageHeader title={catalog?.label ?? moduleKey} subtitle="This module is not purchased for this company." />
      </PageWrap>
    );
  }

  if (moduleKey === "post-sales") {
    return <PostSalesModulePage companyId={companyId} companyName={company.name} progress={progress} />;
  }

  return (
    <PageWrap>
      <Breadcrumbs
        items={[
          { label: "Companies", to: "/companies" },
          { label: company.name, to: "/companies/$companyId", params: { companyId } },
          { label: catalog?.label ?? moduleKey },
        ]}
      />
      <PageHeader
        title={catalog?.label ?? moduleKey}
        subtitle={`${company.name} · Opted in${companyModule.optedOnDate ? ` · ${companyModule.optedOnDate}` : ""}`}
      />
      <div className="card-soft p-8 text-center">
        <p className="font-medium">Detail view coming soon</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {catalog?.description} The same project + Template → Upload → Approval pattern as Post Sales will plug in here.
        </p>
        <div className="mx-auto mt-6 max-w-xs">
          <div className="mb-1 text-xs text-muted-foreground">Module progress</div>
          <ProgressBar value={progress} />
          <div className="mt-1 text-sm font-medium">{progress}%</div>
        </div>
      </div>
    </PageWrap>
  );
}

function PostSalesModulePage({
  companyId,
  companyName,
  progress,
}: {
  companyId: string;
  companyName: string;
  progress: number;
}) {
  const navigate = useNavigate();
  const projects = usePostSalesProjectsForCompany(companyId);
  const addProject = usePostSalesStore((s) => s.addProject);
  const updateProject = usePostSalesStore((s) => s.updateProject);
  const deleteProject = usePostSalesStore((s) => s.deleteProject);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<PostSalesProject | null>(null);
  const [deleting, setDeleting] = useState<PostSalesProject | null>(null);
  const [form, setForm] = useState({ projectNumber: "", projectName: "" });

  const nextNumber = useMemo(() => {
    const nums = projects
      .map((p) => Number(p.projectNumber.replace(/\D/g, "")))
      .filter((n) => !Number.isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `PRJ-${String(max + 1).padStart(3, "0")}`;
  }, [projects]);

  function openCreate() {
    setEditing(null);
    setForm({ projectNumber: nextNumber, projectName: "" });
    setModalOpen(true);
  }

  function openEdit(p: PostSalesProject) {
    setEditing(p);
    setForm({ projectNumber: p.projectNumber, projectName: p.projectName });
    setModalOpen(true);
  }

  function onSubmit() {
    if (!form.projectNumber.trim() || !form.projectName.trim()) {
      toast.error("Project number and name are required");
      return;
    }
    if (editing) {
      updateProject(editing.id, {
        projectNumber: form.projectNumber.trim(),
        projectName: form.projectName.trim(),
      });
      toast.success("Project updated");
      setModalOpen(false);
      return;
    }
    const project = addProject({
      companyId,
      projectNumber: form.projectNumber.trim(),
      projectName: form.projectName.trim(),
    });
    toast.success("Project created");
    setModalOpen(false);
    navigate({
      to: "/companies/$companyId/modules/post-sales/projects/$projectId",
      params: { companyId, projectId: project.id },
    });
  }

  return (
    <PageWrap>
      <Breadcrumbs
        items={[
          { label: "Companies", to: "/companies" },
          { label: companyName, to: "/companies/$companyId", params: { companyId } },
          { label: "Post Sales" },
        ]}
      />
      <PageHeader
        title="Post Sales"
        subtitle={`${companyName} · overall module progress ${progress}%`}
        actions={
          <Button className="gap-1.5 bg-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Project
          </Button>
        }
      />

      <div className="card-soft mb-4 p-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Post Sales progress</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects under Post Sales yet"
          description="Add the first one to start Template → Upload → Approval workflows."
          actionLabel="+ Add Project"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="space-y-2.5 md:hidden">
            {projects.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className="rounded-xl border border-border bg-card p-3.5 active:bg-muted/50"
                onClick={() =>
                  navigate({
                    to: "/companies/$companyId/modules/post-sales/projects/$projectId",
                    params: { companyId, projectId: p.id },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    navigate({
                      to: "/companies/$companyId/modules/post-sales/projects/$projectId",
                      params: { companyId, projectId: p.id },
                    });
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.projectName}</div>
                    <div className="text-xs text-muted-foreground">{p.projectNumber}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {p.stepsDone}/{p.steps.length}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={p.progress} className="flex-1" />
                  <span className="text-xs text-muted-foreground">{p.progress}%</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(p.updatedAt)}</span>
                  <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setDeleting(p);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card-soft hidden overflow-hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Project Number</th>
                <th className="px-4 py-2 text-left">Project Name</th>
                <th className="px-4 py-2 text-left">Progress</th>
                <th className="px-4 py-2 text-left">Steps</th>
                <th className="px-4 py-2 text-left">Updated</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-t hover:bg-muted/40"
                  onClick={() =>
                    navigate({
                      to: "/companies/$companyId/modules/post-sales/projects/$projectId",
                      params: { companyId, projectId: p.id },
                    })
                  }
                >
                  <td className="px-4 py-3 font-medium">{p.projectNumber}</td>
                  <td className="px-4 py-3">{p.projectName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.progress} className="w-24" />
                      <span className="text-xs text-muted-foreground">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.stepsDone}/{p.steps.length}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatRelativeTime(p.updatedAt)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setDeleting(p);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      <EntityFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Project" : "Add Project"}
        onSubmit={onSubmit}
        submitLabel={editing ? "Update" : "Create"}
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-medium">Project Number</label>
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={form.projectNumber}
              onChange={(e) => setForm({ ...form, projectNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Project Name</label>
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              placeholder="e.g. Green Valley"
            />
          </div>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={deleting ? `Remove ${deleting.projectNumber} — ${deleting.projectName}?` : undefined}
        onConfirm={() => {
          if (deleting) {
            deleteProject(deleting.id);
            toast.success("Project deleted");
          }
          setDeleteOpen(false);
          setDeleting(null);
        }}
      />
    </PageWrap>
  );
}
