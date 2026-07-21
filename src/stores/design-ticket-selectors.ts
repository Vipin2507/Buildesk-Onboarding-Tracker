import { useMemo } from "react";

import type { DesignTicket, DesignTicketStatus } from "@/types/design-ticket";
import { useDesignTicketStore } from "./useDesignTicketStore";

export type DesignTicketStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
};

function computeStats(tickets: DesignTicket[]): DesignTicketStats {
  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in-progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };
}

export function useDesignTicketStats(companyId?: string): DesignTicketStats {
  const tickets = useDesignTicketStore((s) => s.tickets);
  return useMemo(() => {
    const scoped = companyId ? tickets.filter((t) => t.companyId === companyId) : tickets;
    return computeStats(scoped);
  }, [tickets, companyId]);
}

export function useDesignTicketsForCompany(companyId: string) {
  const tickets = useDesignTicketStore((s) => s.tickets);
  return useMemo(
    () =>
      tickets
        .filter((t) => t.companyId === companyId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tickets, companyId],
  );
}

export function useDesignTicketHighlights() {
  return useDesignTicketStore((s) => s.highlightIds);
}

export function isDesignTicketActive(status: DesignTicketStatus) {
  return status === "open" || status === "in-progress";
}

export function isDesignTicketSolved(status: DesignTicketStatus) {
  return status === "resolved" || status === "closed";
}
