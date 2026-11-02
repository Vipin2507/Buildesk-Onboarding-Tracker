import { toast } from "sonner";

import { DesignTicketSelect } from "@/components/design-ticket/design-ticket-fields";
import {
  CRM_ACCOUNT_STATUSES,
  crmAccountStatusLabel,
} from "@/lib/crm-account-status";
import { useCrmAccountStore } from "@/stores";
import type { CrmAccount } from "@/types/crm-account";

type Props = {
  companyId: string;
  status: CrmAccount["status"];
  who?: string;
  compact?: boolean;
  onUpdated?: () => void;
};

/** Admin-only status control — any status, no remarks / go-live gates. */
export function CrmAccountStatusSelect({
  companyId,
  status,
  who,
  compact = false,
  onUpdated,
}: Props) {
  const setAccountStatus = useCrmAccountStore((s) => s.setAccountStatus);

  function handleChange(next: string) {
    if (next === status) return;
    const nextStatus = next as CrmAccount["status"];
    setAccountStatus(companyId, nextStatus, { who });
    toast.success(`Status updated to ${crmAccountStatusLabel(nextStatus)}`);
    onUpdated?.();
  }

  return (
    <div className="min-w-0 max-w-[9.5rem]" onClick={(e) => e.stopPropagation()}>
      <DesignTicketSelect
        compact={compact}
        value={status}
        onChange={handleChange}
        options={CRM_ACCOUNT_STATUSES.map((s) => ({
          value: s,
          label: crmAccountStatusLabel(s),
        }))}
        className="min-w-0 max-w-full"
      />
    </div>
  );
}
