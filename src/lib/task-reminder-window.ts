import { subtractWallClockMinutes } from "@/lib/task-scheduling";
import type { AppNotification } from "@/types";
import type { FollowUpTask } from "@/types";

export const TASK_REMINDER_NOTIFICATION_TITLE = "Upcoming task reminder";

export function isTaskReminderNotification(
  notification: Pick<AppNotification, "title" | "href">,
): boolean {
  return (
    notification.title === TASK_REMINDER_NOTIFICATION_TITLE ||
    Boolean(notification.href?.startsWith("/crm/tasks?taskId="))
  );
}

const ACTIVE_STATUSES = new Set<FollowUpTask["status"]>(["open", "in_progress", "blocked"]);

/** True when wall-clock now is inside the pre-start reminder window. */
export function isTaskInReminderWindow(
  task: Pick<FollowUpTask, "startsAt" | "status">,
  nowWall: string,
  offsetMinutes: number,
): boolean {
  if (!task.startsAt || offsetMinutes <= 0) return false;
  if (!ACTIVE_STATUSES.has(task.status)) return false;

  const now = nowWall.slice(0, 19);
  const startsAt = task.startsAt.slice(0, 19);
  if (now >= startsAt) return false;

  const reminderAt = subtractWallClockMinutes(startsAt, offsetMinutes);
  return now >= reminderAt;
}

export function taskAssigneeMatches(
  task: Pick<FollowUpTask, "assigneeUserId" | "assigneeUserIds">,
  userId: string,
): boolean {
  if (task.assigneeUserIds?.includes(userId)) return true;
  return task.assigneeUserId === userId;
}

export function countTasksInReminderWindow(
  tasks: FollowUpTask[],
  userId: string,
  nowWall: string,
  offsetMinutes: number,
): number {
  return tasks.filter(
    (task) =>
      taskAssigneeMatches(task, userId) &&
      isTaskInReminderWindow(task, nowWall, offsetMinutes),
  ).length;
}

export function listTasksInReminderWindow(
  tasks: FollowUpTask[],
  userId: string,
  nowWall: string,
  offsetMinutes: number,
): FollowUpTask[] {
  return tasks.filter(
    (task) =>
      taskAssigneeMatches(task, userId) &&
      isTaskInReminderWindow(task, nowWall, offsetMinutes),
  );
}
