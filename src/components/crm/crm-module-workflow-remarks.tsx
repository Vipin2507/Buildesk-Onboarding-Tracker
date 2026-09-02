import { useCrmOnboardingStore } from "@/stores";
import type { CrmModuleWorkflowStep, CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
  moduleKey: CrmProductModuleKey;
  step: CrmModuleWorkflowStep;
  hint?: string;
};

export function CrmModuleWorkflowRemarks({
  companyId,
  moduleKey,
  step,
  hint = "Optional comments for the executive team.",
}: Props) {
  const patchStep = useCrmOnboardingStore((s) => s.patchModuleWorkflowStep);

  return (
    <div className="rounded-lg border bg-background/80 p-2.5">
      <label className="block text-[11px] font-medium">{step.label}</label>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      <textarea
        className="mt-2 min-h-[72px] w-full rounded-md border bg-background px-2.5 py-2 text-xs"
        placeholder="Add remarks…"
        value={step.remarks ?? ""}
        onChange={(e) =>
          patchStep(companyId, moduleKey, step.key, {
            remarks: e.target.value,
          })
        }
      />
    </div>
  );
}
