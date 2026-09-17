import { resolveCrmTaskAccountLabel } from "@/lib/crm-internal-task";
import type { FollowUpTask } from "@/types";

const TITLE_SEPARATOR = /\s*[–-]\s*/;

/** Task list/calendar preview: always `{Account} – {Task title}` when an account is known. */
export function formatTaskPreviewTitle(
  task: Pick<FollowUpTask, "title" | "taskType" | "companyId" | "isInternal" | "source">,
  accountName?: string,
): string {
  const customer = resolveCrmTaskAccountLabel(task, accountName);
  const title = task.title?.trim() || "Untitled task";
  if (!customer || customer === "—") return title;

  const customerKey = customer.trim().toLowerCase();
  const [left = ""] = title.split(TITLE_SEPARATOR);
  if (left.trim().toLowerCase() === customerKey) return title;

  return `${customer} – ${title}`;
}
