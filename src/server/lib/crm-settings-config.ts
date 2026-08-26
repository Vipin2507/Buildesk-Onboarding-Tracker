import { eq } from "drizzle-orm";

import { DEFAULT_TASK_REMINDER_OFFSET_MINUTES } from "@/data/crm-automation-defaults";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

export type CrmServerNotificationSettings = {
  taskReminderInAppEnabled: boolean;
  taskReminderWebPushEnabled: boolean;
  taskReminderMinutesBefore: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

const DEFAULTS: CrmServerNotificationSettings = {
  taskReminderInAppEnabled: true,
  taskReminderWebPushEnabled: false,
  taskReminderMinutesBefore: DEFAULT_TASK_REMINDER_OFFSET_MINUTES,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

export function loadCrmServerNotificationSettings(
  db: ReturnType<typeof getDb> = getDb(),
): CrmServerNotificationSettings {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "crm-settings")).get();
  if (!row?.valueJson) return { ...DEFAULTS };

  try {
    const parsed = JSON.parse(row.valueJson) as { notifications?: Record<string, unknown> };
    const n = parsed.notifications;
    if (!n || typeof n !== "object") return { ...DEFAULTS };

    const minutes = Number(n.taskReminderMinutesBefore ?? n.taskReminderWebPushMinutesBefore);
    return {
      taskReminderInAppEnabled:
        n.taskReminderInAppEnabled !== undefined
          ? Boolean(n.taskReminderInAppEnabled)
          : DEFAULTS.taskReminderInAppEnabled,
      taskReminderWebPushEnabled: Boolean(n.taskReminderWebPushEnabled),
      taskReminderMinutesBefore:
        Number.isFinite(minutes) && minutes > 0
          ? Math.min(24 * 60, Math.round(minutes))
          : DEFAULTS.taskReminderMinutesBefore,
      quietHoursEnabled: Boolean(n.quietHoursEnabled),
      quietHoursStart:
        typeof n.quietHoursStart === "string" && n.quietHoursStart
          ? n.quietHoursStart
          : DEFAULTS.quietHoursStart,
      quietHoursEnd:
        typeof n.quietHoursEnd === "string" && n.quietHoursEnd
          ? n.quietHoursEnd
          : DEFAULTS.quietHoursEnd,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function isInCrmQuietHours(
  settings: CrmServerNotificationSettings,
  wallClockIso: string,
): boolean {
  if (!settings.quietHoursEnabled) return false;
  const time = wallClockIso.slice(11, 16);
  const { quietHoursStart: start, quietHoursEnd: end } = settings;
  if (start <= end) return time >= start && time < end;
  return time >= start || time < end;
}
