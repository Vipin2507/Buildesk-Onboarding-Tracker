import { useEffect } from "react";

import { listBookingAppointments, listCrmEvents, listDesignTickets, listModuleSubscriptionEvents } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCrmEventStore } from "@/stores/useCrmEventStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

const POLL_MS = 15_000;

/** Keeps CRM dashboard metrics fresh while viewing /crm routes. */
export function CrmDashboardBootstrap() {
  const user = useAuthStore((s) => s.user);
  const setEvents = useCrmEventStore((s) => s.setEvents);
  const setSubscriptionEvents = useCrmEventStore((s) => s.setSubscriptionEvents);
  const hydrateTickets = useDesignTicketStore((s) => s.hydrateTickets);
  const hydrateAppointments = useBookingStore((s) => s.hydrateAppointments);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function sync() {
      try {
        const [events, subscriptionEvents, tickets, appointments] = await Promise.all([
          listCrmEvents({ data: { limit: 200 } }).catch(() => []),
          listModuleSubscriptionEvents({ data: {} }).catch(() => []),
          listDesignTickets({ data: {} }).catch(() => []),
          listBookingAppointments({ data: {} }).catch(() => []),
        ]);
        if (cancelled) return;
        setEvents(events);
        setSubscriptionEvents(subscriptionEvents);
        hydrateTickets(tickets);
        hydrateAppointments(appointments);
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
  }, [hydrateAppointments, hydrateTickets, setEvents, setSubscriptionEvents, user]);

  return null;
}
