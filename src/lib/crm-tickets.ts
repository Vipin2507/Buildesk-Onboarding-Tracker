import type { DesignTicket } from "@/types/design-ticket";
import type { Ticket } from "@/types/ticket";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";

/** CRM implementation tickets use projectId "crm" (see account hub TicketsTab). */
export const CRM_TICKET_PROJECT_ID = "crm";

export function crmAccountIds(): Set<string> {
  return new Set(useCrmAccountStore.getState().accounts.map((a) => a.id));
}

export function isCrmTicket(ticket: Ticket, accountIds?: Set<string>) {
  const ids = accountIds ?? crmAccountIds();
  if (ticket.projectId === CRM_TICKET_PROJECT_ID) return true;
  if (ids.has(ticket.companyId)) return true;
  return false;
}

export function filterCrmTickets(tickets: Ticket[]) {
  const ids = crmAccountIds();
  return tickets.filter((t) => isCrmTicket(t, ids));
}

export function crmAccountName(companyId: string) {
  return useCrmAccountStore.getState().getById(companyId)?.name ?? "CRM account";
}

export function isCrmChatCompany(companyId: string | undefined | null) {
  if (!companyId) return true; // unlinked — show in CRM inbox so agents can pick up
  return crmAccountIds().has(companyId);
}

/**
 * Portal / design tickets for CRM accounts (companyId = CRM account id / stub).
 * Real ERP companies are never treated as CRM here.
 */
export function isCrmDesignTicket(ticket: Pick<DesignTicket, "companyId">, accountIds?: Set<string>) {
  const ids = accountIds ?? crmAccountIds();
  if (ids.has(ticket.companyId)) return true;

  const erpCompanyIds = new Set(useCompanyStore.getState().companies.map((c) => c.id));
  if (erpCompanyIds.has(ticket.companyId)) return false;

  // CRM stub portals exist without appearing in the ERP company list.
  return Boolean(useCompanyPortalStore.getState().getByCompanyId(ticket.companyId));
}

/** CRM Ticket Tracking — only accounts the current user can see (managers are scoped). */
export function filterCrmDesignTickets(tickets: DesignTicket[]) {
  const ids = crmAccountIds();
  return tickets.filter((t) => ids.has(t.companyId));
}

/** ERP Ticket Tracking — exclude CRM account portal tickets. */
export function filterErpDesignTickets(tickets: DesignTicket[]) {
  return tickets.filter((t) => !isCrmDesignTicket(t));
}
