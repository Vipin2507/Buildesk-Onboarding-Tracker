import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { StatusPill, Pill } from "@/components/status-pill";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { EntityNotFound } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import {
  useCompanyStore,
  useProjectStore,
  useEmployeeStore,
  useOnboardingStore,
  useActivityStore,
  useCompanyProgress,
} from "@/stores";
import { formatRelativeTime } from "@/types/common";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/companies/$companyId")({
  component: CompanyDetailPage,
});

const TABS = ["Overview", "Projects", "Employees", "Documents", "Activity", "Billing"] as const;

function CompanyDetailPage() {
  const { companyId } = Route.useParams();
  const loading = useDetailLoading();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const deleteCompany = useCompanyStore((s) => s.deleteCompany);
  const allProjects = useProjectStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => p.companyId === companyId), [allProjects, companyId]);
  const employees = useEmployeeStore((s) => s.employees);
  const allActivities = useActivityStore((s) => s.activities);
  const activities = useMemo(
    () => allActivities.filter((a) => a.companyId === companyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allActivities, companyId],
  );
  const progress = useCompanyProgress(companyId);

  if (loading) return <DetailPageSkeleton />;
  if (!company) return <EntityNotFound entity="Company" listPath="/companies" listLabel="Companies" />;

  const manager = employees.find((e) => e.id === company.onboardingManagerId);
  const csm = employees.find((e) => e.id === company.csmId);

  function handleDelete() {
    if (projects.length > 0) {
      toast.error("Delete linked projects first");
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
          <Link to="/companies"><ArrowLeft className="mr-1 h-4 w-4" /> Companies</Link>
        </Button>
      </div>

      <PageHeader
        title={company.name}
        subtitle={`${company.city} · ${company.plan} plan`}
        actions={
          <div className="flex gap-2">
            <StatusPill status={progress >= 100 ? "completed" : company.status} />
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">Progress</div><div className="mt-2"><ProgressBar value={progress} /><span className="text-sm font-medium">{progress}%</span></div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">Projects</div><div className="text-2xl font-semibold">{projects.length}</div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">Manager</div><div className="font-medium">{manager?.name ?? "—"}</div></div>
        <div className="card-soft p-4"><div className="text-xs text-muted-foreground">Health</div><Pill tone={company.health === "Healthy" ? "success" : company.health === "Moderate" ? "warning" : "danger"}>{company.health}</Pill></div>
      </div>

      <div className="card-soft mb-4 flex flex-wrap gap-1 p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="card-soft grid gap-4 p-5 md:grid-cols-2">
          <div><div className="text-xs text-muted-foreground">Contact</div><div className="font-medium">{company.contact}</div><div className="text-sm text-muted-foreground">{company.designation}</div></div>
          <div><div className="text-xs text-muted-foreground">Email / Phone</div><div>{company.email}</div><div className="text-sm text-muted-foreground">{company.phone}</div></div>
          <div><div className="text-xs text-muted-foreground">CSM</div><div>{csm?.name ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Go-Live Target</div><div>{company.goLiveTarget}</div></div>
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground mb-2">Modules</div>
            <div className="flex flex-wrap gap-1">{company.modules.map((m) => <Pill key={m} tone="accent">{m}</Pill>)}</div>
          </div>
        </div>
      )}

      {tab === "Projects" && (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet.</p> : projects.map((p) => (
            <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }} search={{ tab: "onboarding" }} className="card-soft p-4 hover:shadow-md">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.type} · {p.units} units</div>
            </Link>
          ))}
        </div>
      )}

      {tab === "Activity" && (
        <div className="card-soft p-5">
          <ol className="space-y-4">
            {activities.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : activities.map((a) => (
              <li key={a.id} className="text-sm">
                <div className="font-medium">{a.what}</div>
                <div className="text-xs text-muted-foreground">{a.who} · {formatRelativeTime(a.createdAt)}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === "Billing" && (
        <div className="card-soft p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div><div className="text-xs text-muted-foreground">Plan</div><Pill tone="accent">{company.plan}</Pill></div>
            <div><div className="text-xs text-muted-foreground">Agreement Date</div><div>{company.agreementDate}</div></div>
            <div><div className="text-xs text-muted-foreground">Plan Expiry</div><div>{company.planExpiry}</div></div>
          </div>
        </div>
      )}

      {(tab === "Employees" || tab === "Documents") && (
        <div className="card-soft p-5 text-sm text-muted-foreground">View project-level {tab.toLowerCase()} from individual project pages.</div>
      )}

      <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete company?" onConfirm={handleDelete} />
    </PageWrap>
  );
}
