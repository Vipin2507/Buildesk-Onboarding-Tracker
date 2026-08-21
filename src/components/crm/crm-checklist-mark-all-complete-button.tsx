import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChecklistPhaseState } from "@/types";

type Props = {
  item: ChecklistPhaseState;
  na: boolean;
  layout: "mobile" | "desktop";
  onClick: () => void;
};

export function checklistItemNeedsMarkAllComplete(item: ChecklistPhaseState, na: boolean) {
  return !na && !(item.collected && item.uploaded && item.live);
}

export function CrmChecklistMarkAllCompleteButton({ item, na, layout, onClick }: Props) {
  if (!checklistItemNeedsMarkAllComplete(item, na)) return null;

  const isMobile = layout === "mobile";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/5 font-medium text-primary transition-colors hover:bg-primary/10",
        isMobile ? "mt-2 h-8 w-full px-3 text-[11px]" : "h-7 px-2 text-[10px]",
      )}
    >
      <CheckCircle2 className={isMobile ? "h-3.5 w-3.5" : "h-3 w-3"} />
      Mark complete
    </button>
  );
}
