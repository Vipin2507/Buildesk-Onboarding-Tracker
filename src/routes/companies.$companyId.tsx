import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
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

import { AnimatedSection, PageWrap } from "@/components/page-header";
import {
  DesignTicketPageHeader,
  DesignTicketSection,
  DesignTicketTabNav,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
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
  useErpTaskStore,
  useCrmEventStore,
} from "@/stores";
import { getModuleLabel } from "@/data/module-catalog";
import { calcPostSalesProjectProgress } from "@/lib/post-sales-status";
import { resolveAssigneeName } from "@/lib/managers";
import { formatDate } from "@/lib/utils";
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
  const allTasks = useErpTaskStore((s) => s.tasks);
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
    <PageWrap compact>
      <AnimatedSection className="mb-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground" asChild>
          <Link to="/companies">
            <ArrowLeft className="h-4 w-4" /> Companies
          </Link>
        </Button>
      </AnimatedSection>

      <DesignTicketPageHeader
        compact
        title={company.name}
        subtitle={`${company.city}${company.region ? ` · ${company.region}` : ""} · ${company.plan} · Started ${formatDate(company.startDate || company.agreementDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
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
            <Button size="sm" className="h-8 gap-1 bg-primary" onClick={openAddProject}>
              <Plus className="h-3.5 w-3.5" /> Add Project
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      <AnimatedSection delay={0.04} className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Progress"
          icon={TrendingUp}
          value={`${progress}%`}
          foot={<ProgressBar value={progress} className="mt-1.5" />}
        />
        <StatCard
          label="Modules"
          icon={Layers}
          value={String(optedModules.length)}
          foot={
            <span className="text-[10px] text-muted-foreground">
              {modulesWithProgress.length} available · avg {avgModuleProgress}%
            </span>
          }
        />
        <StatCard
          label="Manager"
          icon={Building2}
          value={managerName ?? "—"}
          foot={
            <span className="text-[10px] text-muted-foreground">Sales {salesAgentName ?? "—"}</span>
          }
        />
        <StatCard
          label="Follow-ups"
          icon={CalendarClock}
          value={`${openTasks} open`}
          foot={
            <span className="text-[10px] text-muted-foreground">
              {visitCount} visits · {companyTasks.length} tasks
            </span>
          }
        />
        <StatCard
          label="Go-Live"
          icon={CalendarClock}
          value={formatDate(company.goLiveTarget)}
          foot={
            <span className="text-[10px] text-muted-foreground">
              {projects.length + postSalesProjects.length} projects
            </span>
          }
        />
      </AnimatedSection>

      <DesignTicketTabNav
        compact
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: TICKET_EASE }}
      >
      {tab === "Overview" && <CompanyOverviewTab company={company} />}

      {tab === "Modules" && (
        <DesignTicketSection compact title="Module catalog" delay={0.02}>
          <p className="mb-2 text-xs text-muted-foreground">
            Enable modules, mark Live, and open hubs for Customer App, Vendors, or Labor.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
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
        </DesignTicketSection>
      )}

      {tab === "Progress" && (
        <DesignTicketSection compact title="Module progress" delay={0.02}>
          <p className="mb-2 text-xs text-muted-foreground">
            Completion across opted-in modules. Drill into a module to update steps.
          </p>
          <ProgressSummaryCards cards={progressCards} />
          {optedModules.length === 0 ? (
            <EmptyState
              title="No modules opted in"
              description="Enable a module from the Modules tab to start tracking progress."
              actionLabel="Open Modules"
              onAction={() => setTab("Modules")}
            />
          ) : (
            <div className="mt-2 space-y-1.5">
              {optedModules.map((m) => (
                <div
                  key={m.moduleKey}
                  className="card-soft flex flex-wrap items-center gap-2.5 px-3 py-2 transition-shadow hover:shadow-sm"
                >
                  <div className="min-w-[140px]">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.isLive
                        ? "Live"
                        : m.progressPercent >= 100
                          ? "Ready for Live"
                          : m.progressPercent === 0
                            ? "Not started"
                            : "In progress"}
                    </div>
                  </div>
                  <div className="min-w-[120px] flex-1">
                    <ProgressBar value={m.progressPercent} />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold tabular-nums">
                    {m.progressPercent}%
                  </span>
                  <Pill tone={m.isLive ? "success" : "muted"}>{m.isLive ? "Live" : "Not Live"}</Pill>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() =>
                      navigate({
                        to: "/companies/$companyId/modules/$moduleKey",
                        params: { companyId, moduleKey: m.moduleKey },
                      })
                    }
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DesignTicketSection>
      )}

      {tab === "Project" && (
        <div className="space-y-4">
          <DesignTicketSection compact title="Projects" delay={0.02}>
            <p className="mb-2 text-xs text-muted-foreground">
              Onboarding and Post Sales trackers — edit address, towers, floors, and commercial details.
            </p>
          </DesignTicketSection>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground">Onboarding</h4>
                <Pill>{projects.length}</Pill>
              </div>
              <Button
                size="sm"
                className="h-7 gap-1 bg-primary text-xs"
                onClick={() => {
                  setEditingProject(null);
                  setProjectModalOpen(true);
                }}
              >
                <Plus className="h-3 w-3" /> Add Project
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
              <div className="grid gap-2 md:grid-cols-2">
                {projects.map((p) => {
                  const pct = calcProjectProgress(p.id, checklistItems);
                  return (
                    <div
                      key={p.id}
                      className="card-soft group p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: p.id }}
                          search={{ tab: "onboarding" }}
                          className="min-w-0 flex-1"
                        >
                          <div className="text-sm font-semibold group-hover:text-primary">{p.name}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {p.type} · {p.units} units · {p.city || "No city"}
                            {p.address ? ` · ${p.address}` : ""}
                          </div>
                        </Link>
                        <div className="flex shrink-0 items-center gap-1">
                          <StatusPill status={p.status} />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => openEditProject(p)}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                        </div>
                      </div>
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: p.id }}
                        search={{ tab: "onboarding" }}
                        className="mt-2 block"
                      >
                        <ProgressBar value={pct} />
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{pct}% complete</div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground">Post Sales</h4>
                <Pill>{postSalesProjects.length}</Pill>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
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
              <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                No Post Sales projects. Open the Post Sales module to create one.
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {postSalesProjects.map((p) => {
                  const pct = calcPostSalesProjectProgress(p);
                  return (
                    <Link
                      key={p.id}
                      to="/companies/$companyId/modules/post-sales/projects/$projectId"
                      params={{ companyId, projectId: p.id }}
                      className="card-soft group block p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-muted-foreground">{p.projectNumber}</div>
                          <div className="text-sm font-semibold group-hover:text-primary">{p.projectName}</div>
                        </div>
                        <Pill tone={pct >= 100 ? "success" : pct > 0 ? "accent" : "muted"}>
                          {pct}%
                        </Pill>
                      </div>
                      <div className="mt-2">
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
        <DesignTicketSection compact title="Billing & subscription" delay={0.02}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Plan, agreement, and renewal details for this account.
            </p>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                markRenewed(companyId);
                toast.success("Plan renewed for 12 months");
              }}
            >
              <RefreshCw className="h-3 w-3" /> Mark Renewed
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <div className="card-soft p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Plan</div>
              <div className="mt-1.5">
                <Pill tone="accent">{company.plan}</Pill>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {company.billingInfo || "No custom billing notes"}
              </p>
            </div>
            <div className="card-soft p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Start Date</div>
              <div className="mt-1.5 text-base font-semibold">
                {formatDate(company.startDate || company.agreementDate)}
              </div>
            </div>
            <div className="card-soft p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Agreement</div>
              <div className="mt-1.5 text-base font-semibold">{formatDate(company.agreementDate)}</div>
            </div>
            <div className="card-soft p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Plan Expiry</div>
              <div className="mt-1.5 text-base font-semibold">{formatDate(company.planExpiry)}</div>
              {company.renewedAt && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Last renewed {new Date(company.renewedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="card-soft p-3 md:col-span-2 xl:col-span-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">GST / Tax</div>
              <div className="mt-1 text-sm font-medium">{company.gstNumber || "—"}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                Billing Address
              </div>
              <div className="mt-0.5 text-xs">{company.officeAddress || company.city}</div>
            </div>
          </div>

          <div className="card-soft mt-2 space-y-2.5 p-3">
            <div>
              <div className="text-xs font-semibold">Module subscriptions</div>
              <p className="text-[10px] text-muted-foreground">
                Commercial entitlement status (separate from module go-live).
              </p>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 px-2.5 py-2">
                <div className="text-[10px] text-muted-foreground">Active</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{subscriptionSummary.active}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-2.5 py-2">
                <div className="text-[10px] text-muted-foreground">Expiring (30d)</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{subscriptionSummary.expiring}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-2.5 py-2">
                <div className="text-[10px] text-muted-foreground">Expired</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{subscriptionSummary.expired}</div>
              </div>
            </div>
            {subscriptionSummary.rows.length > 0 ? (
              <>
                <div className="space-y-2 md:hidden">
                  {subscriptionSummary.rows.map((s) => (
                    <div key={s.id} className="rounded-lg border bg-card p-3 text-sm">
                      <div className="font-medium">{getModuleLabel(s.moduleKey)}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Pill>{s.status}</Pill>
                        <span className="text-muted-foreground">Start {formatDate(s.startDate)}</span>
                        <span className="text-muted-foreground">
                          Until {s.validUntil ? formatDate(s.validUntil) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
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
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                No subscription rows yet — created when modules are opted in or managed from each hub.
              </p>
            )}
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground">
            Edit plan, dates, GST, and billing notes from the Details tab.
          </p>
        </DesignTicketSection>
      )}
      </motion.div>

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
    <div className="card-soft flex flex-col gap-0.5 px-2.5 py-2">
      <div className="flex items-center justify-between gap-1">
        <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
      </div>
      <div className="truncate text-sm font-semibold leading-tight">{value}</div>
      {foot}
    </div>
  );
}
