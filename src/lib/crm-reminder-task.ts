import type { FollowUpTask, FollowUpTaskType } from "@/types/crm";

/** Reminder tasks nudge assignees without blocking calendar availability. */
export function isCrmReminderTaskType(taskType: FollowUpTaskType | string | null | undefined) {
  return taskType === "reminder";
}

export function isCrmReminderTask(task: Pick<FollowUpTask, "taskType">) {
  return isCrmReminderTaskType(task.taskType);
}
