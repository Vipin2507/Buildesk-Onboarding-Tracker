import { Check } from "lucide-react";

import { canToggleChecklistPhase, type ChecklistPhase } from "@/lib/checklist";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { ChecklistPhaseState } from "@/types";

type Props = {
  item: ChecklistPhaseState;
  phase: ChecklistPhase;
  na: boolean;
  label?: string;
  layout: "mobile" | "desktop";
  priorStepsHint?: string;
  at?: string;
  onToggle: () => void;
};

export function CrmChecklistPhaseCell({
  item,
  phase,
  na,
  label,
  layout,
  priorStepsHint = "Complete prior steps first (Collected → Uploaded → Live)",
  at,
  onToggle,
}: Props) {
  const allowed = !na && canToggleChecklistPhase(item, phase);
  const displayLabel = label ?? phase;
  const isMobile = layout === "mobile";

  return (
    <button
      type="button"
      disabled={na || (!allowed && !item[phase])}
      title={
        na
          ? "Not applicable"
          : !allowed && !item[phase]
            ? priorStepsHint
            : at
              ? formatDateTime(at)
              : undefined
      }
      onClick={onToggle}
      className={cn(
        "inline-flex flex-col items-center justify-center gap-0.5 rounded-lg border font-medium capitalize",
        isMobile
          ? "min-h-10 min-w-[5.5rem] px-3 py-1.5 text-xs"
          : "min-h-9 min-w-[4.5rem] rounded-md px-1.5 py-1",
        na || (!allowed && !item[phase])
          ? "cursor-not-allowed opacity-40"
          : item[phase]
            ? "border-success bg-success text-white"
            : allowed
              ? "border-input bg-background hover:border-primary"
              : "border-input bg-muted/40 text-muted-foreground opacity-50",
      )}
    >
      {!na && item[phase] ? (
        <span className="inline-flex items-center gap-1">
          <Check className="h-3.5 w-3.5" />
          {isMobile ? displayLabel : null}
        </span>
      ) : na ? (
        <span className="text-[10px] text-muted-foreground">—</span>
      ) : isMobile ? (
        displayLabel
      ) : null}
      {!na && item[phase] && at ? (
        <span className="text-[9px] font-normal normal-case leading-tight opacity-90">
          {formatDate(at)}
        </span>
      ) : !na && allowed ? (
        <span
          className={cn(
            "font-normal normal-case leading-tight text-muted-foreground",
            isMobile ? "text-[9px] opacity-70" : "text-[9px]",
          )}
        >
          {isMobile ? "Pick date" : "Date"}
        </span>
      ) : null}
    </button>
  );
}
