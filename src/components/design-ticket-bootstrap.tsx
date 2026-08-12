import { useEffect } from "react";

import { ensureCompanyPortals, listDesignTickets, listNotifications } from "@/lib/api";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";
import { useNotificationStore } from "@/stores/useNotificationStore";

const POLL_MS = 15_000;

/** Keeps portal slugs, client tickets, and in-app notifications in sync for admins. */
export function DesignTicketBootstrap() {
  const companies = useCompanyStore((s) => s.companies);
  const hydrateAccess = useCompanyPortalStore((s) => s.hydrateAccess);
  const hydrateTickets = useDesignTicketStore((s) => s.hydrateTickets);
  const hydrateNotifications = useNotificationStore((s) => s.hydrateNotifications);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const [tickets, notifications] = await Promise.all([
          listDesignTickets({ data: {} }),
          listNotifications({ data: { limit: 80 } }).catch(() => []),
        ]);
        if (cancelled) return;
        hydrateTickets(tickets);
        hydrateNotifications(notifications);
      } catch (e) {
        console.warn("[design tickets bootstrap]", e);
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hydrateTickets, hydrateNotifications]);

  useEffect(() => {
    if (companies.length === 0) return;
    void ensureCompanyPortals()
      .then(hydrateAccess)
      .catch((e) => console.warn("[portal bootstrap]", e));
  }, [companies.length, hydrateAccess]);

  return null;
}
