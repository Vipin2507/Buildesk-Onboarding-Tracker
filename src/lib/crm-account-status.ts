import { isCrmGoLiveStage } from "@/lib/crm-implementation-stages";
import type { CrmAccount } from "@/types/crm-account";

export const CRM_ACCOUNT_STATUSES = [
  "onboarding",
  "live",
  "active",
  "suspended",
  "suspend_and_close",
  "inactive",
  "closed",
] as const satisfies readonly CrmAccount["status"][];

export function isCrmAccountEnded(status: CrmAccount["status"]) {
  return (
    status === "closed" ||
    status === "suspended" ||
    status === "suspend_and_close" ||
    status === "inactive"
  );
}

/**
 * Live list filter: status is live, or still onboarding at a go-live stage.
 * Ended statuses (suspend / suspend-and-close / inactive / closed) never count as Live
 * even if the tracker stage is still Post Go-Live.
 */
export function isCrmAccountLiveForList(row: {
  status: CrmAccount["status"] | string;
  stage?: string;
}): boolean {
  if (row.status === "live") return true;
  if (row.status === "onboarding" && isCrmGoLiveStage(row.stage)) return true;
  return false;
}

/** Hold only — not classified as lost in Payments. */
export function isCrmAccountSuspendedOnly(status: CrmAccount["status"] | string) {
  return status === "suspended";
}

/** Suspended and closed — feeds Sales Lost / Customer Lost in Payments. */
export function isCrmAccountSuspendAndClose(status: CrmAccount["status"] | string) {
  return status === "suspend_and_close";
}

export function crmAccountStatusLabel(status: CrmAccount["status"] | string) {
  if (status === "suspended") return "Suspend";
  if (status === "suspend_and_close") return "Suspend and Close";
  if (status === "inactive") return "Inactive";
  if (status === "onboarding") return "Onboarding";
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
