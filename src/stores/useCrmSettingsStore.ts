import { createPersistedStore } from "./persist";

export type CrmNotificationSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFromName: string;
  smtpFromEmail: string;
  digestCadence: "off" | "daily" | "weekly";
  digestHour: number;
  notifyOnStageChange: boolean;
  notifyOnTraining: boolean;
  notifyOnGoLive: boolean;
  notifyOnPendingActivities: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  taskReminderInAppEnabled: boolean;
  taskReminderWebPushEnabled: boolean;
  /** Minutes before scheduled start for in-app + web push reminders. */
  taskReminderMinutesBefore: number;
  /** @deprecated Use taskReminderMinutesBefore */
  taskReminderWebPushMinutesBefore?: number;
};

const SEED_NOTIFICATIONS: CrmNotificationSettings = {
  smtpHost: "smtp.buildesk.com",
  smtpPort: 587,
  smtpUser: "crm-noreply@buildesk.com",
  smtpFromName: "Buildesk CRM",
  smtpFromEmail: "crm-noreply@buildesk.com",
  digestCadence: "daily",
  digestHour: 9,
  notifyOnStageChange: true,
  notifyOnTraining: true,
  notifyOnGoLive: true,
  notifyOnPendingActivities: true,
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  taskReminderInAppEnabled: true,
  taskReminderWebPushEnabled: false,
  taskReminderMinutesBefore: 15,
};

type CrmSettingsState = {
  notifications: CrmNotificationSettings;
  updateNotifications: (patch: Partial<CrmNotificationSettings>) => void;
};

function normalizeNotifications(
  notifications: Partial<CrmNotificationSettings>,
): CrmNotificationSettings {
  const minutes =
    notifications.taskReminderMinutesBefore ??
    notifications.taskReminderWebPushMinutesBefore ??
    SEED_NOTIFICATIONS.taskReminderMinutesBefore;
  return {
    ...SEED_NOTIFICATIONS,
    ...notifications,
    taskReminderMinutesBefore: Math.min(24 * 60, Math.max(1, Number(minutes) || 15)),
  };
}

export const useCrmSettingsStore = createPersistedStore<CrmSettingsState>(
  "crm-app-settings-v1",
  (set) => ({
    notifications: { ...SEED_NOTIFICATIONS },
    updateNotifications: (patch) => {
      set((s) => ({ notifications: normalizeNotifications({ ...s.notifications, ...patch }) }));
    },
  }),
);

export function hydrateCrmSettingsFromServer(raw: Record<string, unknown>) {
  const notifications = raw.notifications;
  if (!notifications || typeof notifications !== "object") return;

  useCrmSettingsStore.setState((s) => ({
    notifications: normalizeNotifications({
      ...s.notifications,
      ...(notifications as Partial<CrmNotificationSettings>),
    }),
  }));
}

function crmSettingsSnapshot() {
  return { notifications: useCrmSettingsStore.getState().notifications };
}

export { crmSettingsSnapshot };
