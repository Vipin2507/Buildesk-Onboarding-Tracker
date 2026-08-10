import type { Ticket } from "@/types/ticket";
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
