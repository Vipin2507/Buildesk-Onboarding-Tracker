import { resolveCrmTaskAccountLabel } from "@/lib/crm-internal-task";
import {
  FOLLOW_UP_TASK_TYPE_LABEL,
  type FollowUpTask,
  type FollowUpTaskType,
} from "@/types";

const TITLE_SEPARATOR = /\s*[–-]\s*/;

function titleStartsWithType(title: string, typeLabel: string): boolean {
  const left = title.split(TITLE_SEPARATOR)[0]?.trim().toLowerCase() ?? "";
  const type = typeLabel.trim().toLowerCase();
  if (!left || !type) return false;
  if (left === type) return true;
  if (type.startsWith(left) || left.startsWith(type.split("/")[0]?.trim() ?? type)) return true;
  return Object.values(FOLLOW_UP_TASK_TYPE_LABEL).some((label) => {
    const normalized = label.toLowerCase();
    return left === normalized || normalized.startsWith(left);
  });
}

/** Task list/calendar preview: customer or account name first, then task type. */
export function formatTaskPreviewTitle(
  task: Pick<FollowUpTask, "title" | "taskType" | "companyId" | "isInternal" | "source">,
  accountName?: string,
): string {
  const customer = resolveCrmTaskAccountLabel(task, accountName);
  const typeLabel = task.taskType
    ? FOLLOW_UP_TASK_TYPE_LABEL[task.taskType as FollowUpTaskType]
    : null;

  if (!typeLabel || !customer || customer === "—") return task.title;

  const customerKey = customer.trim().toLowerCase();
  const [left = ""] = task.title.split(TITLE_SEPARATOR);
  if (left.trim().toLowerCase() === customerKey) return task.title;

  if (task.source === "booking" || titleStartsWithType(task.title, typeLabel)) {
    return `${customer} – ${typeLabel}`;
  }

  return task.title;
}
