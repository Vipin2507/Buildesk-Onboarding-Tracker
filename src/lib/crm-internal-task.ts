import type { FollowUpTask } from "@/types";

/** Sentinel companyId for CRM tasks not tied to a customer account. */
export const INTERNAL_CRM_TASK_COMPANY_ID = "__crm_internal__";

export const INTERNAL_CRM_TASK_ACCOUNT_LABEL = "Internal meeting";

export function isInternalCrmTask(task: Pick<FollowUpTask, "companyId" | "isInternal">) {
  return Boolean(task.isInternal) || task.companyId === INTERNAL_CRM_TASK_COMPANY_ID;
}

export function resolveCrmTaskAccountLabel(
  task: Pick<FollowUpTask, "companyId" | "isInternal">,
  accountName?: string,
) {
  if (isInternalCrmTask(task)) return INTERNAL_CRM_TASK_ACCOUNT_LABEL;
  return accountName ?? "—";
}
