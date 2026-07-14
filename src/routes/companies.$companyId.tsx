import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  FolderKanban,
  Layers,
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
import { CompanyTicketsPanel } from "@/components/company-tickets-panel";
import { EntityNotFound, EmptyState } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
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
  useProjectProgressStore,
} from "@/stores";
import { calcPostSalesProjectProgress } from "@/lib/post-sales-status";
import { cn, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/companies/$companyId")({
  component: CompanyDetailPage,
});

const TABS = [
  { id: "Overview", label: "Details" },
  { id: "Modules", label: "Modules" },
  { id: "Progress", label: "Progress" },
  { id: "Projects", label: "Projects" },
  { id: "Tickets", label: "Tickets" },
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
  const loading = useDetailLoading();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("Overview");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const deleteCompany = useCompanyStore((s) => s.deleteCompany);
  const markRenewed = useCompanyStore((s) => s.markRenewed);
  const allProjects = useProjectStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => p.companyId === companyId), [allProjects, companyId]);
  const postSalesProjects = usePostSalesProjectsForCompany(companyId);
  const checklistItems = useOnboardingStore((s) => s.checklistItems);
  const progressByProject = useProjectProgressStore((s) => s.byProjectId);
  const employees = useEmployeeStore((s) => s.employees);
  const progress = useCompanyProgress(companyId);
  const modulesWithProgress = useCompanyModulesWithProgress(companyId);

  if (loading) return <DetailPageSkeleton />;
  if (!company) return <EntityNotFound entity="Company" listPath="/companies" listLabel="Companies" />;

  const manager = employees.find((e) => e.id === company.onboardingManagerId);
  const optedModules = modulesWithProgress.filter((m) => m.optedIn);
  const avgModuleProgress =
    optedModules.length === 0
      ? 0
      : Math.round(optedModules.reduce((sum, m) => sum + m.progressPercent, 0) / optedModules.length);

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
        subtitle={`${company.city} · ${company.plan} plan · Started ${formatDate(company.startDate || company.agreementDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={progress >= 100 ? "completed" : company.status} />
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          value={manager?.name ?? "—"}
          foot={<span className="text-xs text-muted-foreground">Avg module {avgModuleProgress}%</span>}
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
            description="Enable purchased modules and open project trackers for opted-in products."
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
                      {m.progressPercent >= 100 ? "Complete" : m.progressPercent === 0 ? "Not started" : "In progress"}
                    </div>
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <ProgressBar value={m.progressPercent} />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold">{m.progressPercent}%</span>
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

      {tab === "Projects" && (
        <div className="space-y-6">
          <TabIntro
            title="Projects"
            description="Onboarding projects and Post Sales trackers linked to this company."
          />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Onboarding Projects</h4>
              <Pill>{projects.length}</Pill>
            </div>
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No onboarding projects yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {projects.map((p) => {
                  // progressByProject keeps cards in sync when Progress Tracker updates
                  void progressByProject;
                  const pct = calcProjectProgress(p.id, checklistItems);
                  return (
                    <Link
                      key={p.id}
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      search={{ tab: "onboarding" }}
                      className="card-soft group block p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold group-hover:text-primary">{p.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {p.type} · {p.units} units · {p.city}
                          </div>
                        </div>
                        <StatusPill status={p.status} />
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={pct} />
                        <div className="mt-1 text-xs text-muted-foreground">{pct}% complete</div>
                      </div>
                    </Link>
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

      {tab === "Tickets" && <CompanyTicketsPanel companyId={companyId} />}

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
          <p className="text-xs text-muted-foreground">
            Edit plan, dates, GST, and billing notes from the Details tab.
          </p>
        </div>
      )}

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
