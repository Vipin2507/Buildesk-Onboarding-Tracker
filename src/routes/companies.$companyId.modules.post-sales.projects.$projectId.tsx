import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageWrap } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProgressRing, ProgressBar } from "@/components/progress-bar";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { StepWorkflowCard } from "@/components/step-workflow-card";
import { EntityNotFound } from "@/components/empty-state";
import { DetailPageSkeleton } from "@/components/loading-skeleton";
import { EntityFormModal } from "@/components/entity-form-modal";
import { useDetailLoading } from "@/hooks/use-detail-loading";
import { useCompanyStore, usePostSalesStore, useActivityStore } from "@/stores";
import {
  calcPostSalesProjectProgress,
  countApprovedSteps,
  getStepStatus,
  STEP_STATUS_TONE,
  STEP_STATUS_LABEL,
} from "@/lib/post-sales-status";
import { formatRelativeTime } from "@/types/common";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/companies/$companyId/modules/post-sales/projects/$projectId")({
  component: PostSalesProjectTrackerPage,
});

function PostSalesProjectTrackerPage() {
  const { companyId, projectId } = Route.useParams();
  const loading = useDetailLoading(450);
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === companyId));
  const project = usePostSalesStore((s) => s.projects.find((p) => p.id === projectId));
  const addCustomStep = usePostSalesStore((s) => s.addCustomStep);
  const allActivities = useActivityStore((s) => s.activities);
  const [stepModal, setStepModal] = useState(false);
  const [stepForm, setStepForm] = useState({ label: "", requiresTemplate: true });

  const steps = useMemo(
    () => (project ? [...project.steps].sort((a, b) => a.order - b.order) : []),
    [project],
  );
  const progress = project ? calcPostSalesProjectProgress(project) : 0;
  const counts = project ? countApprovedSteps(project) : { done: 0, total: 0 };
  const activities = useMemo(
    () =>
      allActivities
        .filter((a) => a.projectId === projectId || (a.companyId === companyId && a.what.includes(project?.projectNumber ?? "")))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12),
    [allActivities, projectId, companyId, project?.projectNumber],
  );

  if (loading) return <DetailPageSkeleton />;
  if (!company) return <EntityNotFound entity="Company" listPath="/companies" listLabel="Companies" />;
  if (!project || project.companyId !== companyId) {
    return (
      <EntityNotFound
        entity="Project"
        listPath="/companies/$companyId/modules/$moduleKey"
        listLabel="Post Sales"
      />
    );
  }

  function scrollToStep(id: string) {
    document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <PageWrap>
      <Breadcrumbs
        items={[
          { label: "Companies", to: "/companies" },
          { label: company.name, to: "/companies/$companyId", params: { companyId } },
          {
            label: "Post Sales",
            to: "/companies/$companyId/modules/$moduleKey",
            params: { companyId, moduleKey: "post-sales" },
          },
          { label: project.projectName },
        ]}
      />

      <PageHeader
        title={`${project.projectNumber} · ${project.projectName}`}
        subtitle={`Steps completed ${counts.done} / ${counts.total}`}
        actions={<ProgressRing value={progress} size={72} stroke={7} />}
      />

      <div className="card-soft mb-6 overflow-x-auto p-4">
        <div className="flex min-w-max items-center gap-2">
          {steps.map((step, i) => {
            const st = getStepStatus(step);
            const tone = STEP_STATUS_TONE[st];
            return (
              <div key={step.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollToStep(step.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-center transition-colors hover:bg-muted/50",
                    st === "approved" && "border-success/40 bg-success/5",
                    st === "rejected" && "border-destructive/40 bg-destructive/5",
                    st === "pending_approval" && "border-primary/40 bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                      tone === "success" && "bg-success text-white",
                      tone === "danger" && "bg-destructive text-white",
                      tone === "warning" && "bg-warning text-warning-foreground",
                      tone === "info" && "bg-info text-white",
                      tone === "accent" && "bg-primary text-primary-foreground",
                      tone === "muted" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="max-w-[88px] truncate text-[11px] font-medium">{step.label}</span>
                  <Pill tone={tone} className="scale-90">
                    {STEP_STATUS_LABEL[st]}
                  </Pill>
                </button>
                {i < steps.length - 1 && <div className="h-0.5 w-6 rounded-full bg-border" />}
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <ProgressBar value={progress} />
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <StepWorkflowCard key={step.id} projectId={project.id} step={step} />
        ))}
      </div>

      <div className="mt-6">
        <Button variant="outline" className="gap-1.5" onClick={() => { setStepForm({ label: "", requiresTemplate: true }); setStepModal(true); }}>
          <Plus className="h-4 w-4" /> Add Custom Step
        </Button>
      </div>

      <div className="card-soft mt-8 p-5">
        <h3 className="mb-3 font-semibold">Project Activity</h3>
        <ol className="space-y-3">
          {activities.length === 0 ? (
            <li className="text-sm text-muted-foreground">No activity yet for this project.</li>
          ) : (
            activities.map((a) => (
              <li key={a.id} className="text-sm">
                <div className="font-medium">{a.what}</div>
                <div className="text-xs text-muted-foreground">
                  {a.who} · {formatRelativeTime(a.createdAt)}
                </div>
              </li>
            ))
          )}
        </ol>
      </div>

      <EntityFormModal
        open={stepModal}
        onOpenChange={setStepModal}
        title="Add Custom Step"
        onSubmit={() => {
          if (!stepForm.label.trim()) {
            toast.error("Label is required");
            return;
          }
          addCustomStep(project.id, {
            label: stepForm.label.trim(),
            requiresTemplate: stepForm.requiresTemplate,
          });
          toast.success("Custom step added");
          setStepModal(false);
        }}
        submitLabel="Add Step"
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-medium">Step label</label>
            <input
              className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
              value={stepForm.label}
              onChange={(e) => setStepForm({ ...stepForm, label: e.target.value })}
              placeholder="e.g. Loan Documents"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stepForm.requiresTemplate}
              onChange={(e) => setStepForm({ ...stepForm, requiresTemplate: e.target.checked })}
            />
            Requires template stage
          </label>
        </div>
      </EntityFormModal>
    </PageWrap>
  );
}
