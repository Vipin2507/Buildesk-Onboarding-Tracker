import { toast } from "sonner";

import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import { listActiveCrmImplementationStages, resolveCrmStageLabel } from "@/lib/crm-implementation-stages";
import type { CrmImplementationStage } from "@/types/crm-onboarding";
import { useCrmOnboardingStore } from "@/stores";

type Props = {
  companyId: string;
  stage: CrmImplementationStage;
  who?: string;
  compact?: boolean;
  onUpdated?: () => void;
};

export function CrmAccountStageSelect({
  companyId,
  stage,
  who,
  compact = false,
  onUpdated,
}: Props) {
  const updateTracker = useCrmOnboardingStore((s) => s.updateTracker);
  const options = listActiveCrmImplementationStages();

  function handleChange(nextStage: string) {
    if (nextStage === stage) return;
    updateTracker(companyId, { stage: nextStage as CrmImplementationStage }, who);
    toast.success(`Stage updated to ${resolveCrmStageLabel(nextStage)}`);
    onUpdated?.();
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DesignTicketSelect
        compact={compact}
        value={stage}
        onChange={handleChange}
        options={options.map((s) => ({ value: s.key, label: s.label }))}
        className="min-w-[10rem] max-w-[12rem]"
      />
    </div>
  );
}
