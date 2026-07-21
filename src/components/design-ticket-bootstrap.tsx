import { useEffect } from "react";

import { ensureCompanyPortals, listDesignTickets } from "@/lib/api";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

const POLL_MS = 20_000;

/** Keeps server-backed portal slugs and design tickets in sync for admins. */
export function DesignTicketBootstrap() {
  const companies = useCompanyStore((s) => s.companies);
  const hydrateAccess = useCompanyPortalStore((s) => s.hydrateAccess);
  const hydrateTickets = useDesignTicketStore((s) => s.hydrateTickets);

  useEffect(() => {
    if (companies.length === 0) return;
    void ensureCompanyPortals()
      .then(hydrateAccess)
      .catch((e) => console.warn("[portal bootstrap]", e));
  }, [companies.length, hydrateAccess]);

  useEffect(() => {
    let cancelled = false;

    async function syncTickets() {
      try {
        const tickets = await listDesignTickets({ data: {} });
        if (!cancelled) hydrateTickets(tickets);
      } catch (e) {
        console.warn("[design tickets bootstrap]", e);
      }
    }

    void syncTickets();
    const timer = window.setInterval(() => void syncTickets(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hydrateTickets]);

  return null;
}
