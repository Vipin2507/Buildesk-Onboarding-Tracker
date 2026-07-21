import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  FolderKanban,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { StatusPill, Pill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { ModuleCard } from "@/components/module-card";
import { CompanyOverviewTab } from "@/components/company-overview-tab";
import { CompanyNotesAttachmentsTab } from "@/components/company-notes-attachments";
import { CompanyHistoryTab } from "@/components/company-history";
import { CompanyDesignTicketsPanel } from "@/components/company-design-tickets-panel";
import { CompanyTasksPanel } from "@/components/company-tasks-panel";
import { CompanyVisitsPanel } from "@/components/company-visits-panel";
import { EntityNotFound, EmptyState } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { ProgressSummaryCards } from "@/components/progress-summary-cards";
import {
  ProjectFormModal,
  formValuesToProjectPatch,
  type ProjectAdminFormValues,
} from "@/components/project-form-modal";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import {
  useCompanyStore,
  useProjectStore,
  useEmployeeStore,
  useCompanyProgress,
  useCompanyModulesWithProgress,
  usePostSalesProjectsForCompany,
  calcProjectProgress,
  useOnboardingStore,
  useUserStore,
  useClientVisitStore,
  useTaskStore,
  useCrmEventStore,
} from "@/stores";
import { getModuleLabel } from "@/data/module-catalog";
import { calcPostSalesProjectProgress } from "@/lib/post-sales-status";
import { resolveAssigneeName } from "@/lib/managers";
import { cn, formatDate } from "@/lib/utils";
import type { Project } from "@/types";

const tabSchema = z.enum([
  "Overview",
  "Modules",
  "Progress",
  "Project",
  "Tickets",
  "Tasks",
  "Visits",
  "Notes & Attachments",
  "History",
  "Billing",
]);

const searchSchema = z.object({
  tab: z
    .union([
      tabSchema,
      // Legacy company tab id from before Projects → Project rename
      z.literal("Projects").transform(() => "Project" as const),
    ])
    .optional(),
});

export const Route = createFileRoute("/companies/$companyId")({
  validateSearch: (search) => searchSchema.parse(search),
  component: CompanyDetailPage,
});

const TABS = [
  { id: "Overview", label: "Details" },
  { id: "Modules", label: "Modules" },
  { id: "Progress", label: "Progress" },
  { id: "Project", label: "Project" },
  { id: "Tickets", label: "Tickets" },
  { id: "Tasks", label: "Tasks" },
  { id: "Visits", label: "Visits" },
  { id: "Notes & Attachments", label: "Notes & Files" },
  { id: "History", label: "History" },
  { id: "Billing", label: "Billing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function CompanyDetailPage() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;

  return <CompanyDetailContent />;
}

function CompanyDetailContent() {
  const { companyId } = Route.useParams();
  const search = Route.useSearch();
  const tab: TabId = search.tab ?? "Overview";
  const loading = useDetailLoading();
  const navigate = useNavigate({ from: "/companies/$companyId" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const setTab = (next: TabId) => {
    void navigate({ search: { tab: next }, replace: true });
  };

  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const deleteCompany = useCompanyStore((s) => s.deleteCompany);
  const markRenewed = useCompanyStore((s) => s.markRenewed);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const allProjects = useProjectStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => p.companyId === companyId), [allProjects, companyId]);
  const postSalesProjects = usePostSalesProjectsForCompany(companyId);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const employees = useEmployeeStore((s) => s.employees);
  const users = useUserStore((s) => s.users);
  const companyFormOptions = useMemo(
    () => (company ? [{ id: company.id, name: company.name, city: company.city }] : []),
    [company],
  );
  const progress = useCompanyProgress(companyId);
  const modulesWithProgress = useCompanyModulesWithProgress(companyId);
  const allTasks = useTaskStore((s) => s.tasks);
  const allVisits = useClientVisitStore((s) => s.visits);
  const allSubscriptions = useCrmEventStore((s) => s.subscriptions);
  const companyTasks = useMemo(
    () => allTasks.filter((t) => t.companyId === companyId),
    [allTasks, companyId],
  );
  const companyVisits = useMemo(
    () => allVisits.filter((v) => v.companyId === companyId),
    [allVisits, companyId],
  );
  const companySubscriptions = useMemo(
    () => allSubscriptions.filter((s) => s.companyId === companyId),
    [allSubscriptions, companyId],
  );
  const subscriptionSummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const active = companySubscriptions.filter((s) => s.status === "active").length;
    const expired = companySubscriptions.filter(
      (s) => s.status === "expired" || (s.validUntil && s.validUntil < today),
    ).length;
    const expiring = companySubscriptions.filter(
      (s) =>
        s.status === "active" &&
        s.validUntil &&
        s.validUntil >= today &&
        s.validUntil <= in30,
    ).length;
    return { active, expiring, expired, rows: companySubscriptions };
  }, [companySubscriptions]);

  if (loading) return <DetailPageSkeleton />;
  if (!company) return <EntityNotFound entity="Company" listPath="/companies" listLabel="Companies" />;

  const managerName = resolveAssigneeName(company.onboardingManagerId, users, employees);
  const salesAgentName = resolveAssigneeName(company.salesAgentId, users, employees);
  const openTasks = companyTasks.filter((t) =>
    ["open", "in_progress", "blocked"].includes(t.status),
  ).length;
  const visitCount = companyVisits.length;
  const optedModules = modulesWithProgress.filter((m) => m.optedIn);
  const liveModules = optedModules.filter((m) => m.isLive);
  const companyLive =
    optedModules.length > 0 && optedModules.every((m) => m.isLive);
  const avgModuleProgress =
    optedModules.length === 0
      ? 0
      : Math.round(optedModules.reduce((sum, m) => sum + m.progressPercent, 0) / optedModules.length);
  const projectsLive = projects.filter((p) => p.status === "completed" || Boolean(p.goLiveAt)).length;
  const progressCards = [
    { id: "opted", label: "Modules Opted", value: optedModules.length },
    { id: "live", label: "Modules Live", value: liveModules.length },
    { id: "avg", label: "Avg Module %", value: avgModuleProgress, suffix: "%" },
    { id: "overall", label: "Overall %", value: progress, suffix: "%" },
    { id: "projects", label: "Projects", value: projects.length + postSalesProjects.length },
    {
      id: "projects_live",
      label: "Projects Live",
      value: projectsLive + postSalesProjects.filter((p) => p.progress >= 100).length,
    },
  ];

  function handleDelete() {
    if (projects.length > 0 || postSalesProjects.length > 0) {
      toast.error("Delete linked projects first", {
        description: `${projects.length + postSalesProjects.length} project(s) still linked`,
      });
      return;
    }
    deleteCompany(companyId);
    toast.success("Company deleted");
    navigate({ to: "/companies" });
  }

  function openAddProject() {
    setEditingProject(null);
    setTab("Project");
    setProjectModalOpen(true);
  }

  function openEditProject(project: Project) {
    setEditingProject(project);
    setProjectModalOpen(true);
  }

  function onSaveProject(data: ProjectAdminFormValues) {
    const patch = formValuesToProjectPatch({ ...data, companyId });
    if (editingProject) {
      updateProject(editingProject.id, patch);
      toast.success("Project details updated");
      setEditingProject(null);
      return;
    }
    const project = addProject({ ...patch, status: "not_started", currentStep: 0 });
    toast.success("Project created", {
      description: "Use Edit on the project card to add location, scale, and commercial details.",
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

  return (
    <PageWrap>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/companies">
            <ArrowLeft className="mr-1 h-4 w-4" /> Companies
          </Link>
        </Button>
      </div>

      <PageHeader
        title={company.name}
        subtitle={`${company.city}${company.region ? ` · ${company.region}` : ""} · ${company.plan} plan · Started ${formatDate(company.startDate || company.agreementDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {companyLive ? (
              <Pill tone="success">Live</Pill>
            ) : (
              <StatusPill status={progress >= 100 ? "completed" : company.status} />
            )}
            <Pill
              tone={
                company.health === "Healthy"
                  ? "success"
                  : company.health === "Moderate"
                    ? "warning"
                    : "danger"
              }
            >
              {company.health}
            </Pill>
            <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90" onClick={openAddProject}>
              <Plus className="h-4 w-4" /> Add Project
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Overall Progress"
          icon={TrendingUp}
          value={`${progress}%`}
          foot={<ProgressBar value={progress} className="mt-2" />}
        />
        <StatCard
          label="Modules Opted"
          icon={Layers}
          value={String(optedModules.length)}
          foot={<span className="text-xs text-muted-foreground">{modulesWithProgress.length} available</span>}
        />
        <StatCard
          label="Onboarding Manager"
          icon={Building2}
          value={managerName ?? "—"}
          foot={
            <span className="text-xs text-muted-foreground">
              Sales {salesAgentName ?? "—"} · Avg module {avgModuleProgress}%
            </span>
          }
        />
        <StatCard
          label="CRM Follow-ups"
          icon={CalendarClock}
          value={`${openTasks} open`}
          foot={
            <span className="text-xs text-muted-foreground">
              {visitCount} visits · {companyTasks.length} tasks
            </span>
          }
        />
        <StatCard
          label="Go-Live Target"
          icon={CalendarClock}
          value={company.goLiveTarget}
          foot={
            <span className="text-xs text-muted-foreground">
              {projects.length + postSalesProjects.length} projects
            </span>
          }
        />
      </div>

      <div className="card-soft mb-5 -mx-1 flex gap-1 overflow-x-auto px-1.5 py-1.5 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "min-h-10 shrink-0 snap-start rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "Overview" && <CompanyOverviewTab company={company} />}

      {tab === "Modules" && (
        <div className="space-y-4">
          <TabIntro
            title="Module Catalog"
            description="Enable or disable purchased modules and mark Live. Open a module hub for company-scoped Customer App, Vendors, or Labor tools."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modulesWithProgress.map((m) => (
              <ModuleCard
                key={m.moduleKey}
                companyId={companyId}
                moduleKey={m.moduleKey}
                label={m.label}
                optedIn={m.optedIn}
                progressPercent={m.progressPercent}
                isLive={m.isLive}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "Progress" && (
        <div className="space-y-4">
          <TabIntro
            title="Module Progress"
            description="Completion across each opted-in module. Drill into projects to update steps."
          />
          <ProgressSummaryCards cards={progressCards} />
          {optedModules.length === 0 ? (
            <EmptyState
              title="No modules opted in"
              description="Enable a module from the Modules tab to start tracking progress."
              actionLabel="Open Modules"
              onAction={() => setTab("Modules")}
            />
          ) : (
            <div className="space-y-3">
              {optedModules.map((m) => (
                <div
                  key={m.moduleKey}
                  className="card-soft flex flex-wrap items-center gap-4 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="min-w-[160px]">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.isLive
                        ? "Live"
                        : m.progressPercent >= 100
                          ? "Ready for Live"
                          : m.progressPercent === 0
                            ? "Not started"
                            : "In progress"}
                    </div>
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <ProgressBar value={m.progressPercent} />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold">{m.progressPercent}%</span>
                  <Pill tone={m.isLive ? "success" : "muted"}>{m.isLive ? "Live" : "Not Live"}</Pill>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() =>
                      navigate({
                        to: "/companies/$companyId/modules/$moduleKey",
                        params: { companyId, moduleKey: m.moduleKey },
                      })
                    }
                  >
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Project" && (
        <div className="space-y-6">
          <TabIntro
            title="Project"
            description="Onboarding projects and Post Sales trackers. Use Edit to fill address, towers, floors, units, and commercial details after import or create."
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Onboarding Projects</h4>
                <Pill>{projects.length}</Pill>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-primary hover:bg-primary/90"
                onClick={() => {
                  setEditingProject(null);
                  setProjectModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add Project
              </Button>
            </div>
            {projects.length === 0 ? (
              <EmptyState
                title="No onboarding projects yet"
                description="Create a project for this company to start the onboarding checklist."
                actionLabel="+ Add Project"
                onAction={() => {
                  setEditingProject(null);
                  setProjectModalOpen(true);
                }}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {projects.map((p) => {
                  const pct = calcProjectProgress(p.id, checklistItems);
                  return (
                    <div
                      key={p.id}
                      className="card-soft group p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: p.id }}
                          search={{ tab: "onboarding" }}
                          className="min-w-0 flex-1"
                        >
                          <div className="font-semibold group-hover:text-primary">{p.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {p.type} · {p.units} units · {p.city || "No city"}
                            {p.address ? ` · ${p.address}` : ""}
                          </div>
                        </Link>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <StatusPill status={p.status} />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 px-2"
                            onClick={() => openEditProject(p)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </div>
                      </div>
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: p.id }}
                        search={{ tab: "onboarding" }}
                        className="mt-3 block"
                      >
                        <ProgressBar value={pct} />
                        <div className="mt-1 text-xs text-muted-foreground">{pct}% complete</div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Post Sales Projects</h4>
                <Pill>{postSalesProjects.length}</Pill>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate({
                    to: "/companies/$companyId/modules/$moduleKey",
                    params: { companyId, moduleKey: "post-sales" },
                  })
                }
              >
                Manage Post Sales
              </Button>
            </div>
            {postSalesProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No Post Sales projects. Open the Post Sales module to create one.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {postSalesProjects.map((p) => {
                  const pct = calcPostSalesProjectProgress(p);
                  return (
                    <Link
                      key={p.id}
                      to="/companies/$companyId/modules/post-sales/projects/$projectId"
                      params={{ companyId, projectId: p.id }}
                      className="card-soft group block p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">{p.projectNumber}</div>
                          <div className="font-semibold group-hover:text-primary">{p.projectName}</div>
                        </div>
                        <Pill tone={pct >= 100 ? "success" : pct > 0 ? "accent" : "muted"}>
                          {pct}%
                        </Pill>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={pct} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "Tickets" && <CompanyDesignTicketsPanel companyId={companyId} />}

      {tab === "Tasks" && <CompanyTasksPanel companyId={companyId} />}

      {tab === "Visits" && <CompanyVisitsPanel companyId={companyId} />}

      {tab === "Notes & Attachments" && <CompanyNotesAttachmentsTab companyId={companyId} />}

      {tab === "History" && <CompanyHistoryTab companyId={companyId} />}

      {tab === "Billing" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabIntro
              title="Billing & Subscription"
              description="Plan, agreement, and renewal details for this account."
            />
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                markRenewed(companyId);
                toast.success("Plan renewed for 12 months");
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Mark Renewed
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="card-soft p-5">
              <div className="text-xs text-muted-foreground">Plan</div>
              <div className="mt-2">
                <Pill tone="accent">{company.plan}</Pill>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {company.billingInfo || "No custom billing notes"}
              </p>
            </div>
            <div className="card-soft p-5">
              <div className="text-xs text-muted-foreground">Start Date</div>
              <div className="mt-2 text-lg font-semibold">{formatDate(company.startDate || company.agreementDate)}</div>
            </div>
            <div className="card-soft p-5">
              <div className="text-xs text-muted-foreground">Agreement Date</div>
              <div className="mt-2 text-lg font-semibold">{formatDate(company.agreementDate)}</div>
            </div>
            <div className="card-soft p-5">
              <div className="text-xs text-muted-foreground">Plan Expiry</div>
              <div className="mt-2 text-lg font-semibold">{formatDate(company.planExpiry)}</div>
              {company.renewedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last renewed {new Date(company.renewedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="card-soft p-5 md:col-span-2 xl:col-span-3">
              <div className="text-xs text-muted-foreground">GST / Tax</div>
              <div className="mt-1 font-medium">{company.gstNumber || "—"}</div>
              <div className="mt-3 text-xs text-muted-foreground">Billing Address</div>
              <div className="mt-1 text-sm">{company.officeAddress || company.city}</div>
            </div>
          </div>

          <div className="card-soft space-y-3 p-5">
            <div>
              <div className="text-sm font-semibold">Module subscriptions</div>
              <p className="text-xs text-muted-foreground">
                Commercial entitlement status (separate from module go-live). Legacy opted modules
                remain accessible during rollout.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Active</div>
                <div className="mt-1 text-xl font-semibold">{subscriptionSummary.active}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Expiring (30d)</div>
                <div className="mt-1 text-xl font-semibold">{subscriptionSummary.expiring}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Expired</div>
                <div className="mt-1 text-xl font-semibold">{subscriptionSummary.expired}</div>
              </div>
            </div>
            {subscriptionSummary.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Module</th>
                      <th className="py-1.5 pr-3 font-medium">Status</th>
                      <th className="py-1.5 pr-3 font-medium">Start</th>
                      <th className="py-1.5 font-medium">Valid until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionSummary.rows.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-2 pr-3">{getModuleLabel(s.moduleKey)}</td>
                        <td className="py-2 pr-3">
                          <Pill>{s.status}</Pill>
                        </td>
                        <td className="py-2 pr-3">{formatDate(s.startDate)}</td>
                        <td className="py-2">{s.validUntil ? formatDate(s.validUntil) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No subscription rows yet — they are created when modules are opted in or managed
                from each module hub.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Edit plan, dates, GST, and billing notes from the Details tab.
          </p>
        </div>
      )}

      <ProjectFormModal
        open={projectModalOpen}
        onOpenChange={(open) => {
          setProjectModalOpen(open);
          if (!open) setEditingProject(null);
        }}
        companies={companyFormOptions}
        editing={editingProject}
        defaultCompanyId={companyId}
        onSave={onSaveProject}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete company?"
        description={`Permanently remove ${company.name}? This cannot be undone.`}
        onConfirm={handleDelete}
      />
    </PageWrap>
  );
}

function StatCard({
  label,
  icon: Icon,
  value,
  foot,
}: {
  label: string;
  icon: typeof TrendingUp;
  value: string;
  foot?: React.ReactNode;
}) {
  return (
    <div className="card-soft p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="truncate text-lg font-semibold">{value}</div>
      {foot}
    </div>
  );
}

function TabIntro({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
