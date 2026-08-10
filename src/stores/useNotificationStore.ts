import type { ActivityKind, AppNotification } from "@/types";
import { nowIso } from "@/types";
import { createStore } from "./persist";
import {
  createNotification as apiCreate,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAll,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";
import { useCrmSettingsStore } from "./useCrmSettingsStore";
import { useSettingsStore } from "./useSettingsStore";

export type NotifyGate =
  | "ticket"
  | "golive"
  | "crmStage"
  | "crmTraining"
  | "crmGoLive"
  | "none";

type NotifyInput = {
  title: string;
  body?: string;
  kind?: ActivityKind;
  href?: string;
  companyId?: string;
  ticketId?: string;
  userId?: string;
  /** Which settings toggle gates this notification. Default: ticket. */
  gate?: NotifyGate;
};

type NotificationState = {
  notifications: AppNotification[];
  hydrateNotifications: (notifications: AppNotification[]) => void;
  push: (input: NotifyInput) => AppNotification | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: () => number;
};

function isGateOpen(gate: NotifyGate = "ticket") {
  if (gate === "none") return true;

  const crm = useCrmSettingsStore.getState().notifications;
  if (gate === "crmStage") return crm.notifyOnStageChange;
  if (gate === "crmTraining") return crm.notifyOnTraining;
  if (gate === "crmGoLive") return crm.notifyOnGoLive;

  const n = useSettingsStore.getState().notifications;
  if (gate === "golive") return n.notifyOnGoLive;
  return n.notifyOnTicketUpdates;
}

export const useNotificationStore = createStore<NotificationState>((set, get) => ({
  notifications: [],

  hydrateNotifications: (notifications) => {
    set({ notifications });
  },

  push: (input) => {
    if (!isGateOpen(input.gate)) {
      return null;
    }
    const now = nowIso();
    const notification: AppNotification = {
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: input.title,
      body: input.body ?? "",
      kind: input.kind ?? "info",
      href: input.href,
      companyId: input.companyId,
      ticketId: input.ticketId,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ notifications: [notification, ...s.notifications] }));
    serverSync("createNotification", () =>
      apiCreate({
        data: {
          id: notification.id,
          title: notification.title,
          body: notification.body,
          kind: notification.kind,
          href: notification.href,
          companyId: notification.companyId,
          ticketId: notification.ticketId,
          userId: notification.userId,
        },
      }),
    );
    return notification;
  },

  markRead: (id) => {
    const now = nowIso();
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id && !n.readAt ? { ...n, readAt: now, updatedAt: now } : n,
      ),
    }));
    serverSync("markNotificationRead", () => apiMarkRead({ data: { id } }));
  },

  markAllRead: () => {
    const now = nowIso();
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.readAt ? n : { ...n, readAt: now, updatedAt: now },
      ),
    }));
    serverSync("markAllNotificationsRead", () => apiMarkAll());
  },

  unreadCount: () => get().notifications.filter((n) => !n.readAt).length,
}));

export function notifyInApp(input: NotifyInput) {
  return useNotificationStore.getState().push(input);
}
