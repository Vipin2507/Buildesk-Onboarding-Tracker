import { useEffect } from "react";

import { listBookingAppointments, listCrmEvents, listDesignTickets, listModuleSubscriptionEvents, listNotifications, listAllCrmAccountQueries, listCrmWhatsappLastEngaged } from "@/lib/api";
import { useTaskTimeStatusSync } from "@/hooks/use-task-time-status";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCrmEventStore } from "@/stores/useCrmEventStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import { useCrmAccountQueryStore } from "@/stores/useCrmAccountQueryStore";
import { useCrmWhatsappEngagementStore } from "@/stores/useCrmWhatsappEngagementStore";

const POLL_MS = 15_000;

/** Keeps CRM dashboard metrics fresh while viewing /crm routes. */
export function CrmDashboardBootstrap() {
  const user = useAuthStore((s) => s.user);
  useTaskTimeStatusSync(Boolean(user));
  const hydrateNotifications = useNotificationStore((s) => s.hydrateNotifications);
  const setEvents = useCrmEventStore((s) => s.setEvents);
  const setSubscriptionEvents = useCrmEventStore((s) => s.setSubscriptionEvents);
  const hydrateTickets = useDesignTicketStore((s) => s.hydrateTickets);
  const hydrateAppointments = useBookingStore((s) => s.hydrateAppointments);
  const hydrateAllQueries = useCrmAccountQueryStore((s) => s.hydrateAllQueries);
  const hydrateWhatsappEngagement = useCrmWhatsappEngagementStore((s) => s.hydrate);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function sync() {
      try {
        const [events, subscriptionEvents, tickets, appointments, notifications, queries, whatsappLast] =
          await Promise.all([
            listCrmEvents({ data: { limit: 200 } }).catch(() => []),
            listModuleSubscriptionEvents({ data: {} }).catch(() => []),
            listDesignTickets({ data: {} }).catch(() => []),
            listBookingAppointments({ data: {} }).catch(() => []),
            listNotifications({ data: { limit: 80 } }).catch(() => []),
            listAllCrmAccountQueries({ data: {} }).catch(() => []),
            listCrmWhatsappLastEngaged({ data: {} }).catch(() => []),
          ]);
        if (cancelled) return;
        setEvents(events);
        setSubscriptionEvents(subscriptionEvents);
        hydrateTickets(tickets);
        hydrateAppointments(appointments);
        hydrateNotifications(notifications);
        hydrateAllQueries(queries);
        hydrateWhatsappEngagement(whatsappLast);
      } catch (e) {
        console.warn("[crm dashboard bootstrap]", e);
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    hydrateAllQueries,
    hydrateAppointments,
    hydrateNotifications,
    hydrateTickets,
    hydrateWhatsappEngagement,
    setEvents,
    setSubscriptionEvents,
    user,
  ]);

  return null;
}
