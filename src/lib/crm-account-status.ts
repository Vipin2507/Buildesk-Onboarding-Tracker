import type { CrmAccount } from "@/types/crm-account";

export const CRM_ACCOUNT_STATUSES = [
  "onboarding",
  "live",
  "active",
  "suspended",
  "inactive",
  "closed",
] as const satisfies readonly CrmAccount["status"][];

export function isCrmAccountEnded(status: CrmAccount["status"]) {
  return status === "closed" || status === "suspended" || status === "inactive";
}

export function crmAccountStatusLabel(status: CrmAccount["status"]) {
  if (status === "suspended") return "Suspended";
  if (status === "inactive") return "Inactive";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
