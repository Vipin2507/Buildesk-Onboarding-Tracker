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
