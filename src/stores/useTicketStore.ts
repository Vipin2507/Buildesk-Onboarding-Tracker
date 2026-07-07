import type { Ticket, TicketStatus } from "@/types";
import { newId, nowIso } from "@/types";
import { seedTickets } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";

type TicketState = {
  tickets: Ticket[];
  addTicket: (data: Omit<Ticket, "id" | "createdAt" | "updatedAt">) => Ticket;
  updateTicket: (id: string, data: Partial<Ticket>) => void;
  deleteTicket: (id: string) => Ticket | undefined;
  moveTicket: (id: string, status: TicketStatus) => void;
  getById: (id: string) => Ticket | undefined;
};

export const useTicketStore = createPersistedStore<TicketState>("tickets", (set, get) => ({
  tickets: seedTickets,

  addTicket: (data) => {
    const now = nowIso();
    const ticket: Ticket = { ...data, id: `TKT-${1000 + get().tickets.length + 1}`, createdAt: now, updatedAt: now };
    set((s) => ({ tickets: [ticket, ...s.tickets] }));
    logActivity({ who: "You", what: `Created ticket ${ticket.id}: ${ticket.title}`, kind: "info" });
    return ticket;
  },

  updateTicket: (id, data) => {
    set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)) }));
    const ticket = get().getById(id);
    if (ticket) logActivity({ who: "You", what: `Updated ticket ${id}`, kind: "info" });
  },

  deleteTicket: (id) => {
    const ticket = get().getById(id);
    set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) }));
    if (ticket) logActivity({ who: "You", what: `Deleted ticket ${id}`, kind: "warning" });
    return ticket;
  },

  moveTicket: (id, status) => {
    set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? touch({ ...t, status }) : t)) }));
    logActivity({ who: "You", what: `Ticket ${id} moved to ${status}`, kind: "info" });
  },

  getById: (id) => get().tickets.find((t) => t.id === id),
}));
