import { and, eq, inArray } from "drizzle-orm";

import { isTaskInReminderWindow, TASK_REMINDER_NOTIFICATION_TITLE } from "@/lib/task-reminder-window";
import { localWallClockIso } from "@/lib/booking-slots";
import {
  isInCrmQuietHours,
  loadCrmServerNotificationSettings,
  type CrmServerNotificationSettings,
} from "@/server/lib/crm-settings-config";
import { isWebPushConfigured, sendPushToUser } from "@/server/lib/web-push";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { mapTaskRow, parseAssigneeIdsJson } from "@/server/lib/task-schedule";
import { newId, nowIso } from "@/types";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";

export const CRM_TASK_WEB_PUSH_RULE_ID = "crm-web-push";

function taskAssigneeIds(row: typeof t.followUpTasks.$inferSelect): string[] {
  const fromJson = parseAssigneeIdsJson(row.assigneeUserIdsJson);
  if (fromJson.length) return fromJson;
  return row.assigneeUserId ? [row.assigneeUserId] : [];
}

function reminderAlreadySent(
  db: ReturnType<typeof getDb>,
  taskId: string,
  assigneeUserId: string,
  startsAt: string,
): boolean {
  const row = db
    .select({ id: t.automationRemindersSent.id })
    .from(t.automationRemindersSent)
    .where(
      and(
        eq(t.automationRemindersSent.taskId, taskId),
        eq(t.automationRemindersSent.ruleId, CRM_TASK_WEB_PUSH_RULE_ID),
        eq(t.automationRemindersSent.assigneeUserId, assigneeUserId),
        eq(t.automationRemindersSent.startsAt, startsAt),
      ),
    )
    .get();
  return Boolean(row);
}

function recordReminderSent(
  db: ReturnType<typeof getDb>,
  taskId: string,
  assigneeUserId: string,
  startsAt: string,
) {
  db.insert(t.automationRemindersSent)
    .values({
      id: newId(),
      taskId,
      ruleId: CRM_TASK_WEB_PUSH_RULE_ID,
      assigneeUserId,
      startsAt,
      sentAt: nowIso(),
    })
    .run();
}

function formatTaskWhen(iso: string) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export type TaskWebPushDiagnostics = {
  vapidConfigured: boolean;
  settings: CrmServerNotificationSettings;
  crmSettingsSaved: boolean;
  nowWall: string;
  inQuietHours: boolean;
  scheduledTaskCount: number;
  subscriptionCount: number;
  userSubscriptionCount: number;
  dueNowCount: number;
  dueTasks: Array<{
    taskId: string;
    title: string;
    startsAt: string;
    assigneeIds: string[];
    alreadySent: boolean;
  }>;
};

export function getTaskWebPushDiagnostics(
  db: ReturnType<typeof getDb>,
  userId?: string,
  timezone = DEFAULT_BOOKING_TIMEZONE,
): TaskWebPushDiagnostics {
  const settings = loadCrmServerNotificationSettings(db);
  const crmSettingsRow = db
    .select({ valueJson: t.appConfig.valueJson })
    .from(t.appConfig)
    .where(eq(t.appConfig.key, "crm-settings"))
    .get();
  const nowWall = localWallClockIso(timezone);
  const offsetMinutes = settings.taskReminderMinutesBefore;

  const taskRows = db
    .select()
    .from(t.followUpTasks)
    .where(inArray(t.followUpTasks.status, ["open", "in_progress", "blocked"]))
    .all()
    .filter((row) => row.productScope === "crm" && row.startsAt);

  const subscriptionCount = db.select({ id: t.pushSubscriptions.id }).from(t.pushSubscriptions).all()
    .length;
  const userSubscriptionCount = userId
    ? db
        .select({ id: t.pushSubscriptions.id })
        .from(t.pushSubscriptions)
        .where(eq(t.pushSubscriptions.userId, userId))
        .all().length
    : 0;

  const dueTasks: TaskWebPushDiagnostics["dueTasks"] = [];

  for (const row of taskRows) {
    const task = mapTaskRow(row);
    if (!isTaskInReminderWindow(task, nowWall, offsetMinutes)) continue;

    const startsAt = task.startsAt!.slice(0, 19);
    const assigneeIds = taskAssigneeIds(row);
    dueTasks.push({
      taskId: task.id,
      title: task.title,
      startsAt,
      assigneeIds,
      alreadySent: assigneeIds.some((id) => reminderAlreadySent(db, task.id, id, startsAt)),
    });
  }

  return {
    vapidConfigured: isWebPushConfigured(),
    settings,
    crmSettingsSaved: Boolean(crmSettingsRow?.valueJson),
    nowWall,
    inQuietHours: isInCrmQuietHours(settings, nowWall),
    scheduledTaskCount: taskRows.length,
    subscriptionCount,
    userSubscriptionCount,
    dueNowCount: dueTasks.length,
    dueTasks: dueTasks.slice(0, 10),
  };
}

/** Send browser push notifications for upcoming scheduled tasks. */
export async function processTaskWebPushReminders(
  db: ReturnType<typeof getDb>,
  timezone = DEFAULT_BOOKING_TIMEZONE,
): Promise<number> {
  if (!isWebPushConfigured()) return 0;

  const settings = loadCrmServerNotificationSettings(db);
  if (!settings.taskReminderWebPushEnabled) return 0;

  const nowWall = localWallClockIso(timezone);
  if (isInCrmQuietHours(settings, nowWall)) return 0;

  const offsetMinutes = settings.taskReminderMinutesBefore;
  if (offsetMinutes <= 0) return 0;

  const taskRows = db
    .select()
    .from(t.followUpTasks)
    .where(inArray(t.followUpTasks.status, ["open", "in_progress", "blocked"]))
    .all()
    .filter((row) => row.productScope === "crm" && row.startsAt);

  let sentCount = 0;

  for (const row of taskRows) {
    const task = mapTaskRow(row);
    if (!isTaskInReminderWindow(task, nowWall, offsetMinutes)) continue;

    const startsAt = task.startsAt!.slice(0, 19);

    const account =
      db
        .select({ name: t.crmAccounts.name })
        .from(t.crmAccounts)
        .where(eq(t.crmAccounts.id, task.companyId))
        .get() ??
      db
        .select({ name: t.companies.name })
        .from(t.companies)
        .where(eq(t.companies.id, task.companyId))
        .get();
    const accountName = account?.name ?? "CRM account";

    const assigneeIds = taskAssigneeIds(row);
    if (assigneeIds.length === 0) continue;

    for (const assigneeId of assigneeIds) {
      if (reminderAlreadySent(db, task.id, assigneeId, startsAt)) continue;

      const assignee = db.select().from(t.users).where(eq(t.users.id, assigneeId)).get();
      if (!assignee || assignee.active === false) continue;

      const when = formatTaskWhen(startsAt);
      const taskUrl = `/crm/tasks?taskId=${encodeURIComponent(task.id)}`;
      const body = `${task.title} for ${accountName} starts at ${when} (in ${offsetMinutes} min)`;

      const delivered = await sendPushToUser(db, assigneeId, {
        title: TASK_REMINDER_NOTIFICATION_TITLE,
        body,
        url: taskUrl,
      });

      if (delivered > 0) {
        recordReminderSent(db, task.id, assigneeId, startsAt);
        sentCount += delivered;
      } else {
        console.warn(
          `[web-push] no delivery task=${task.id} assignee=${assigneeId} (no subscription or send failed)`,
        );
      }
    }
  }

  return sentCount;
}
