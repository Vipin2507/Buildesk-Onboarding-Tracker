import { useRef, useState } from "react";
import { Check, Lock, Upload } from "lucide-react";
import { toast } from "sonner";

import { CrmModuleWorkflowRemarks } from "@/components/crm/crm-module-workflow-remarks";
import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import {
  calcCpApplicationWorkflowProgress,
  getVisibleCpApplicationSteps,
  isModuleWorkflowStepComplete,
} from "@/data/crm-onboarding-defaults";
import { cn, formatDate } from "@/lib/utils";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmModuleWorkflowStep } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
  moduleLabel: string;
  steps: CrmModuleWorkflowStep[];
  progress: number;
  className?: string;
};

function priorStepsComplete(steps: CrmModuleWorkflowStep[], index: number): boolean {
  return steps.slice(0, index).every(isModuleWorkflowStepComplete);
}

export function CrmCpApplicationWorkflow({
  companyId,
  moduleLabel,
  steps,
  progress,
  className,
}: Props) {
  const patchStep = useCrmOnboardingStore((s) => s.patchModuleWorkflowStep);
  const setStepDate = useCrmOnboardingStore((s) => s.setModuleWorkflowStepDate);
  const toggleStep = useCrmOnboardingStore((s) => s.toggleModuleWorkflowStep);

  const visible = getVisibleCpApplicationSteps(steps);
  const counted = visible.filter((s) => s.kind !== "remarks");
  const doneCount = counted.filter(isModuleWorkflowStepComplete).length;
  const pct = progress || calcCpApplicationWorkflowProgress(steps);

  const todayYmd = new Date().toISOString().slice(0, 10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStepKey, setUploadStepKey] = useState<string | null>(null);
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
    setStepDate(companyId, "cp-application", stepDialog.stepKey, stepDateValue);
    toast.success(
      stepDialog.mode === "edit"
        ? `${stepDialog.stepLabel} date updated`
        : `${stepDialog.stepLabel} completed`,
    );
    setStepDialog(null);
  }

  function clearStepDialog() {
    if (!stepDialog) return;
    toggleStep(companyId, "cp-application", stepDialog.stepKey, false);
    toast.success(`${stepDialog.stepLabel} cleared`);
    setStepDialog(null);
  }

  function handleFilePick(stepKey: string, file: File | undefined) {
    if (!file) return;
    patchStep(companyId, "cp-application", stepKey, { fileName: file.name });
    toast.success(`Logo file "${file.name}" attached`);
    setUploadStepKey(null);
  }

  if (visible.length === 0) return null;

  return (
    <>
      <div className={className}>
        <div className="text-[10px] text-muted-foreground">
          {doneCount}/{counted.length} steps · {pct}%
        </div>
        <ProgressBar value={pct} className="mt-1.5 h-1.5" />

        <div className="mt-3 space-y-2">
          {visible.map((step, idx) => {
            const complete = isModuleWorkflowStepComplete(step);
            const locked = !complete && !priorStepsComplete(visible, idx);
            const kind = step.kind ?? "date";

            if (kind === "remarks") {
              return (
                <CrmModuleWorkflowRemarks
                  key={step.key}
                  companyId={companyId}
                  moduleKey="cp-application"
                  step={step}
                />
              );
            }

            if (kind === "yes_no") {
              return (
                <div
                  key={step.key}
                  className={cn(
                    "rounded-lg border p-2.5",
                    complete ? "border-success/40 bg-success/5" : "bg-background/80",
                    locked && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-medium">
                      {locked ? <Lock className="mr-1 inline h-3 w-3" /> : null}
                      {step.label}
                    </div>
                    {complete && step.completedAt ? (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(step.completedAt)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {(["yes", "no"] as const).map((option) => {
                      const selected = step.value === option;
                      return (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          className={cn(
                            "h-7 flex-1 text-xs capitalize",
                            selected && option === "yes" && "bg-success hover:bg-success/90",
                            selected && option === "no" && "bg-muted-foreground hover:bg-muted-foreground/90",
                          )}
                          disabled={locked && !selected}
                          onClick={() => {
                            if (locked) {
                              toast.error("Complete prior steps first");
                              return;
                            }
                            patchStep(companyId, "cp-application", step.key, { value: option });
                            toast.success(`${step.label}: ${option === "yes" ? "Yes" : "No"}`);
                          }}
                        >
                          {option === "yes" ? "Yes" : "No"}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (kind === "file") {
              return (
                <div
                  key={step.key}
                  className={cn(
                    "rounded-lg border p-2.5",
                    complete ? "border-success/40 bg-success/5" : "bg-background/80",
                    locked && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-medium">
                      {locked ? <Lock className="mr-1 inline h-3 w-3" /> : null}
                      {step.label}
                    </div>
                    {complete ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-success">
                        <Check className="h-3 w-3" />
                        {step.fileName}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.svg,.png,.jpg,.jpeg,.webp,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (uploadStepKey) handleFilePick(uploadStepKey, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      disabled={locked}
                      onClick={() => {
                        if (locked) {
                          toast.error("Complete prior steps first");
                          return;
                        }
                        setUploadStepKey(step.key);
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {step.fileName ? "Replace logo" : "Upload logo"}
                    </Button>
                    {step.fileName ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        onClick={() =>
                          patchStep(companyId, "cp-application", step.key, {
                            fileName: "",
                            done: false,
                            completedAt: undefined,
                          })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            }

            const laterDone = visible.slice(idx + 1).some(isModuleWorkflowStepComplete);
            return (
              <button
                key={step.key}
                type="button"
                disabled={locked && !complete}
                onClick={() => {
                  if (locked) {
                    toast.error("Complete prior steps first");
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
                  "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors",
                  complete
                    ? "border-success/40 bg-success/5"
                    : locked
                      ? "cursor-not-allowed border-input bg-muted/30 opacity-60"
                      : "border-input bg-background/80 hover:border-primary",
                )}
              >
                <span className="font-medium">
                  {locked && !complete ? <Lock className="mr-1 inline h-3 w-3" /> : null}
                  {complete ? <Check className="mr-1 inline h-3 w-3 text-success" /> : null}
                  {step.label}
                </span>
                {complete && step.completedAt ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDate(step.completedAt)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-muted-foreground">Set date</span>
                )}
              </button>
            );
          })}
        </div>
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
