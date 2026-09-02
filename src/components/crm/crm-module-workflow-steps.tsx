import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";

import { CrmModuleWorkflowRemarks } from "@/components/crm/crm-module-workflow-remarks";
import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import {
  getWorkflowProgressSteps,
  isModuleWorkflowStepComplete,
  moduleRequiresProvider,
} from "@/data/crm-onboarding-defaults";
import { cn, formatDate } from "@/lib/utils";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmModuleWorkflowStep, CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
  moduleKey: CrmProductModuleKey;
  moduleLabel: string;
  steps: CrmModuleWorkflowStep[];
  progress: number;
  className?: string;
};

export function CrmModuleWorkflowSteps({
  companyId,
  moduleKey,
  moduleLabel,
  steps,
  progress,
  className,
}: Props) {
  const setStepDate = useCrmOnboardingStore((s) => s.setModuleWorkflowStepDate);
  const toggleStep = useCrmOnboardingStore((s) => s.toggleModuleWorkflowStep);

  const todayYmd = new Date().toISOString().slice(0, 10);
  const requiresProvider = moduleRequiresProvider(moduleKey);
  const progressSteps = getWorkflowProgressSteps(steps);
  const remarksStep = steps.find((s) => s.kind === "remarks");
  const doneCount = progressSteps.filter(isModuleWorkflowStepComplete).length;

  const [stepDialog, setStepDialog] = useState<{
    stepKey: string;
    stepLabel: string;
    mode: "complete" | "edit";
    canClear: boolean;
  } | null>(null);
  const [stepDateValue, setStepDateValue] = useState("");

  function confirmStepDialog() {
    if (!stepDialog || !stepDateValue) {
      toast.error("Pick a date for this step");
      return;
    }
    setStepDate(companyId, moduleKey, stepDialog.stepKey, stepDateValue);
    toast.success(
      stepDialog.mode === "edit"
        ? `${stepDialog.stepLabel} date updated`
        : `${stepDialog.stepLabel} completed`,
    );
    setStepDialog(null);
  }

  function clearStepDialog() {
    if (!stepDialog) return;
    toggleStep(companyId, moduleKey, stepDialog.stepKey, false);
    toast.success(`${stepDialog.stepLabel} cleared`);
    setStepDialog(null);
  }

  if (steps.length === 0) return null;

  return (
    <>
      <div className={className}>
        <div className="text-[10px] text-muted-foreground">
          {doneCount}/{progressSteps.length} steps · {progress}%
        </div>
        <ProgressBar value={progress} className="mt-1.5 h-1.5" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {progressSteps.map((step, idx) => {
            const priorDone = progressSteps.slice(0, idx).every(isModuleWorkflowStepComplete);
            const laterDone = progressSteps.slice(idx + 1).some(isModuleWorkflowStepComplete);
            const isProviderStep = requiresProvider && step.key === "provider_selected";
            const complete = isModuleWorkflowStepComplete(step);
            const locked = !complete && !priorDone;
            return (
              <button
                key={step.key}
                type="button"
                disabled={(locked || isProviderStep) && !complete}
                title={
                  isProviderStep
                    ? "Set via the provider selector above"
                    : locked
                      ? "Complete prior steps first"
                      : step.completedAt
                        ? `Completed ${formatDate(step.completedAt)}`
                        : undefined
                }
                onClick={() => {
                  if (isProviderStep) {
                    toast.info("Select the provider above to complete this step");
                    return;
                  }
                  if (locked) {
                    toast.error("Complete prior steps first", {
                      description: "Steps unlock in order",
                    });
                    return;
                  }
                  setStepDialog({
                    stepKey: step.key,
                    stepLabel: step.label,
                    mode: complete ? "edit" : "complete",
                    canClear: complete && !laterDone,
                  });
                  setStepDateValue((step.completedAt ?? todayYmd).slice(0, 10));
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  complete
                    ? "border-success bg-success text-white"
                    : locked
                      ? "cursor-not-allowed border-input bg-muted/40 text-muted-foreground opacity-60"
                      : "border-input bg-background hover:border-primary",
                )}
              >
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                  {complete ? (
                    <Check className="h-3 w-3" />
                  ) : locked ? (
                    <Lock className="h-2.5 w-2.5" />
                  ) : (
                    <span className="text-[9px] tabular-nums">{idx + 1}</span>
                  )}
                </span>
                <span className="truncate">{step.label}</span>
                {complete && step.completedAt ? (
                  <span className="text-[9px] font-normal opacity-90">
                    {formatDate(step.completedAt)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {remarksStep ? (
          <div className="mt-3">
            <CrmModuleWorkflowRemarks
              companyId={companyId}
              moduleKey={moduleKey}
              step={remarksStep}
            />
          </div>
        ) : null}
      </div>

      <EntityFormModal
        open={!!stepDialog}
        onOpenChange={(open) => {
          if (!open) setStepDialog(null);
        }}
        title={
          stepDialog
            ? stepDialog.mode === "edit"
              ? `Edit "${stepDialog.stepLabel}" date`
              : `Complete "${stepDialog.stepLabel}"`
            : "Workflow step"
        }
        submitLabel={stepDialog?.mode === "edit" ? "Save date" : "Confirm"}
        onSubmit={confirmStepDialog}
      >
        {stepDialog ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{moduleLabel}</span>
              {" · "}
              {stepDialog.stepLabel}
            </p>
            <label className="block text-xs font-medium">
              Completion date
              <DatePickerField
                modal
                className="mt-1"
                value={stepDateValue}
                onChange={(v) => setStepDateValue(v)}
              />
            </label>
            {stepDialog.canClear ? (
              <Button type="button" variant="outline" className="w-full" onClick={clearStepDialog}>
                Clear step
              </Button>
            ) : null}
          </div>
        ) : null}
      </EntityFormModal>
    </>
  );
}
