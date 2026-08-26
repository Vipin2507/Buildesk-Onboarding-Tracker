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
  taskReminderWebPushEnabled: boolean;
  taskReminderWebPushMinutesBefore: number;
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
  taskReminderWebPushEnabled: false,
  taskReminderWebPushMinutesBefore: 15,
};

type CrmSettingsState = {
  notifications: CrmNotificationSettings;
  updateNotifications: (patch: Partial<CrmNotificationSettings>) => void;
};

export const useCrmSettingsStore = createPersistedStore<CrmSettingsState>(
  "crm-app-settings-v1",
  (set) => ({
    notifications: { ...SEED_NOTIFICATIONS },
    updateNotifications: (patch) => {
      set((s) => ({ notifications: { ...s.notifications, ...patch } }));
    },
  }),
);

export function hydrateCrmSettingsFromServer(raw: Record<string, unknown>) {
  const notifications = raw.notifications;
  if (!notifications || typeof notifications !== "object") return;

  useCrmSettingsStore.setState((s) => ({
    notifications: {
      ...s.notifications,
      ...(notifications as Partial<CrmNotificationSettings>),
    },
  }));
}

function crmSettingsSnapshot() {
  return { notifications: useCrmSettingsStore.getState().notifications };
}

export { crmSettingsSnapshot };
