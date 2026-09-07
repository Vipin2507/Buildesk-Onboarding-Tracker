import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ExternalLink, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/status-pill";
import { EmptyState, EntityNotFound } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import {
  ProjectFormModal,
  formValuesToProjectPatch,
  type ProjectAdminFormValues,
} from "@/components/project-form-modal";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import {
  useCompanyStore,
  useModuleProgress,
  useOnboardingStore,
  useCompanyChecklistProjectsForCompany,
  useProjectProgressStore,
  useProjectStore,
  calcProjectProgress,
} from "@/stores";
import { MODULE_CATALOG, getModuleLabel } from "@/data/module-catalog";
import { milestonesForModule } from "@/lib/module-progress";
import { ModuleSubscriptionPanel } from "@/components/module-subscription-panel";
import type { ModuleKey, Project } from "@/types";
import { formatRelativeTime } from "@/types/common";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/companies/$companyId/modules/$moduleKey")({
  component: ModuleLandingPage,
});

const CRUD_LINKS: Partial<Record<ModuleKey, { to: string; label: string }>> = {
  "customer-app": { to: "/customer-app", label: "Open Customer App" },
  "vendor-management": { to: "/vendors", label: "Open Vendors" },
  "labor-management": { to: "/labor", label: "Open Labor" },
};

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
    <GenericModuleHub
      companyId={companyId}
      companyName={company.name}
      companyPocName={company.pocName || company.contact}
      companyPocMobile={company.pocMobile || company.phone}
      moduleKey={moduleKey as ModuleKey}
      label={catalog?.label ?? moduleKey}
      description={catalog?.description}
      companyModule={companyModule}
      optedOnDate={companyModule.optedOnDate}
      liveAt={companyModule.liveAt}
      pocName={companyModule.pocName}
      pocMobile={companyModule.pocMobile}
      progress={progress}
    />
  );
}

function GenericModuleHub({
  companyId,
  companyName,
  companyPocName,
  companyPocMobile,
  moduleKey,
  label,
  description,
  companyModule,
  optedOnDate,
  liveAt,
  pocName,
  pocMobile,
  progress,
}: {
  companyId: string;
  companyName: string;
  companyPocName: string;
  companyPocMobile: string;
  moduleKey: ModuleKey;
  label: string;
  description?: string;
  companyModule: {
    moduleKey: ModuleKey;
    label: string;
    optedIn: boolean;
    optedOnDate?: string;
    liveAt?: string;
    pocName?: string;
    pocMobile?: string;
    subscriptionId?: string;
    subscriptionStatus?: import("@/types").ModuleSubscriptionStatus;
    subscriptionStartDate?: string;
    subscriptionValidUntil?: string;
  };
  optedOnDate?: string;
  liveAt?: string;
  pocName?: string;
  pocMobile?: string;
  progress: number;
}) {
  const setModuleLive = useCompanyStore((s) => s.setModuleLive);
  const updateModuleMeta = useCompanyStore((s) => s.updateModuleMeta);
  const allProjects = useProjectStore((s) => s.projects);
  const projects = useMemo(
    () => allProjects.filter((p) => p.companyId === companyId),
    [allProjects, companyId],
  );
  const byProjectId = useProjectProgressStore((s) => s.byProjectId);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const crud = CRUD_LINKS[moduleKey];
  const milestones = milestonesForModule(moduleKey);

  const [draftPoc, setDraftPoc] = useState(pocName ?? "");
  const [draftMobile, setDraftMobile] = useState(pocMobile ?? "");

  const checklist = useMemo(() => {
    return milestones.map((m) => {
      let done = 0;
      let total = 0;
      for (const p of projects) {
        const row = byProjectId[p.id];
        if (row) {
          if (row.notApplicable?.[m.key]) continue;
          total += 1;
          if (row.checks[m.key]) done += 1;
          continue;
        }
        // No Progress Tracker row yet — fall back to onboarding checklist completion.
        total += 1;
        if (calcProjectProgress(p.id, checklistItems) >= 100) done += 1;
      }
      return {
        key: m.key,
        label: m.label,
        description: "description" in m ? String(m.description ?? "") : "",
        done,
        total,
        complete: total > 0 ? done === total : false,
      };
    });
  }, [milestones, projects, byProjectId, checklistItems]);

  function savePoc() {
    updateModuleMeta(companyId, moduleKey, {
      pocName: draftPoc.trim() || undefined,
      pocMobile: draftMobile.trim() || undefined,
    });
    toast.success("Module POC saved");
  }

  function toggleLive() {
    setModuleLive(companyId, moduleKey, !liveAt);
    toast.success(liveAt ? `${label} marked Not Live` : `${label} is Live`);
  }

  return (
    <PageWrap>
      <Breadcrumbs
        items={[
          { label: "Companies", to: "/companies" },
          { label: companyName, to: "/companies/$companyId", params: { companyId } },
          { label },
        ]}
      />
      <PageHeader
        title={label}
        subtitle={`${companyName} · Opted in${optedOnDate ? ` · ${optedOnDate}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Pill tone={liveAt ? "success" : "muted"}>{liveAt ? "Live" : "Not Live"}</Pill>
            <Button size="sm" variant="outline" onClick={toggleLive}>
              {liveAt ? "Clear Live" : "Mark Live"}
            </Button>
            {crud ? (
              <Button size="sm" variant="outline" asChild>
                <Link to={crud.to as "/vendors"} search={{ companyId }}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> {crud.label}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4">
        <ModuleSubscriptionPanel companyId={companyId} module={companyModule} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-4 lg:col-span-2">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Module progress</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} />
          {description ? <p className="mt-3 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="card-soft space-y-3 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Module POC
          </div>
          <p className="text-xs text-muted-foreground">
            Defaults to company POC ({companyPocName} · {companyPocMobile})
          </p>
          <label className="block text-xs font-medium">
            Name
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={draftPoc}
              onChange={(e) => setDraftPoc(e.target.value)}
              placeholder={companyPocName}
            />
          </label>
          <label className="block text-xs font-medium">
            Mobile
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={draftMobile}
              onChange={(e) => setDraftMobile(e.target.value)}
              placeholder={companyPocMobile}
            />
          </label>
          <Button size="sm" onClick={savePoc}>
            Save POC
          </Button>
        </div>
      </div>

      <div className="card-soft p-4">
        <h3 className="mb-1 font-semibold">Task checklist</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Derived from project onboarding milestones across {projects.length} project
          {projects.length === 1 ? "" : "s"}. Update checklist phases on each project.
        </p>
        {checklist.length === 0 ? (
          <EmptyState
            title="No milestone tasks mapped"
            description="This module uses overall project readiness until specific milestones are configured."
          />
        ) : (
          <div className="space-y-2">
            {checklist.map((item) => (
              <div
                key={item.key}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                  item.complete ? "border-success/40 bg-success/5" : "border-border",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  {item.description ? (
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  ) : null}
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">
                  {item.total === 0 ? "—" : `${item.done}/${item.total}`}
                </div>
                <Pill tone={item.complete ? "success" : "muted"}>
                  {item.complete ? "Done" : "Open"}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </div>

      {projects.length > 0 ? (
        <div className="mt-4 card-soft p-4">
          <h3 className="mb-3 text-sm font-semibold">Linked onboarding projects</h3>
          <div className="space-y-2">
            {projects.map((p) => {
              const pct = calcProjectProgress(p.id, checklistItems);
              return (
                <Link
                  key={p.id}
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  search={{ tab: "onboarding" }}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.status === "completed" || p.goLiveAt ? "Completed" : "In progress"}
                    </div>
                  </div>
                  <ProgressBar value={pct} className="w-24" />
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="No onboarding projects yet"
            description="Import a sheet or add a project on the company Project tab. Module progress follows those projects."
          />
        </div>
      )}
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
  const enableModule = useCompanyStore((s) => s.enableModule);
  const projects = useCompanyChecklistProjectsForCompany(companyId);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const companyFormOptions = useMemo(
    () => [{ id: companyId, name: companyName, city: "—" }],
    [companyId, companyName],
  );

  function openCreate() {
    enableModule(companyId, "post-sales");
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setModalOpen(true);
  }

  function onSaveProject(data: ProjectAdminFormValues) {
    const patch = formValuesToProjectPatch({ ...data, companyId });
    if (editing) {
      updateProject(editing.id, patch);
      toast.success("Project updated");
      setModalOpen(false);
      setEditing(null);
      return;
    }
    const project = addProject({ ...patch, status: "not_started", currentStep: 0 });
    toast.success("Post Sales project created");
    setModalOpen(false);
    navigate({
      to: "/projects/$projectId",
      params: { projectId: project.id },
      search: { tab: "onboarding" },
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
        subtitle={`${companyName} · checklist progress ${progress}%`}
        actions={
          <Button className="gap-1.5 bg-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Project
          </Button>
        }
      />

      <div className="card-soft mb-4 p-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Post Sales progress (onboarding checklist)</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects under Post Sales yet"
          description="Add a project to start the onboarding checklist workflow."
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
                    to: "/projects/$projectId",
                    params: { projectId: p.id },
                    search: { tab: "onboarding" },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    navigate({
                      to: "/projects/$projectId",
                      params: { projectId: p.id },
                      search: { tab: "onboarding" },
                    });
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.type} · {p.city || "No city"}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {p.checklistDone}/{p.checklistTotal}
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
                  <th className="px-4 py-2 text-left">Project Name</th>
                  <th className="px-4 py-2 text-left">Progress</th>
                  <th className="px-4 py-2 text-left">Checklist</th>
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
                        to: "/projects/$projectId",
                        params: { projectId: p.id },
                        search: { tab: "onboarding" },
                      })
                    }
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={p.progress} className="w-24" />
                        <span className="text-xs text-muted-foreground">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.checklistDone}/{p.checklistTotal}
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

      <ProjectFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        companies={companyFormOptions}
        editing={editing}
        defaultCompanyId={companyId}
        onSave={onSaveProject}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={deleting ? `Remove ${deleting.name}? Checklist data will be deleted.` : undefined}
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
