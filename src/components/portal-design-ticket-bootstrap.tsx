import { useEffect } from "react";

import { listPortalDesignTickets } from "@/lib/api";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { useDesignTicketStore } from "@/stores/useDesignTicketStore";

const POLL_MS = 20_000;

/** Loads and polls design tickets for a client portal (no admin login). */
export function PortalDesignTicketBootstrap({ access }: { access: CompanyPortalAccess }) {
  const hydrateCompanyTickets = useDesignTicketStore((s) => s.hydrateCompanyTickets);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const tickets = await listPortalDesignTickets({ data: { slug: access.slug } });
        if (!cancelled) hydrateCompanyTickets(access.companyId, tickets);
      } catch (e) {
        console.warn("[portal tickets]", e);
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [access.slug, access.companyId, hydrateCompanyTickets]);

  return null;
}
