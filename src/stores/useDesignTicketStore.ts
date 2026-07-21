import type {
  DesignTicket,
  DesignTicketAttachment,
  DesignTicketMessage,
  DesignTicketPriority,
  DesignTicketStatus,
} from "@/types/design-ticket";
import { newId, nowIso } from "@/types";
import {
  addDesignTicketMessage,
  addPortalDesignTicketMessage,
  assignDesignTicket,
  createPortalDesignTicket,
  deleteDesignTicket,
  updateDesignTicketPriority,
  updateDesignTicketStatus,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";
import { createPersistedStore, touch } from "./persist";

export type CreateDesignTicketInput = {
  companyId: string;
  subject: string;
  description: string;
  category?: string;
  priority?: DesignTicketPriority;
  createdBy: { type: "client" | "team"; name: string };
  attachments?: DesignTicketAttachment[];
};

type DesignTicketState = {
  tickets: DesignTicket[];
  /** Ticket ids to highlight as newly created (cleared after a few seconds). */
  highlightIds: string[];
  hydrateTickets: (tickets: DesignTicket[]) => void;
  hydrateCompanyTickets: (companyId: string, tickets: DesignTicket[]) => void;
  mergeTicket: (ticket: DesignTicket) => void;
  createPortalTicket: (
    slug: string,
    input: Omit<CreateDesignTicketInput, "companyId" | "createdBy"> & { authorName: string },
  ) => Promise<DesignTicket>;
  addMessage: (
    ticketId: string,
    input: {
      authorType: "client" | "team";
      authorName: string;
      message: string;
      attachments?: DesignTicketAttachment[];
    },
    opts?: { portalSlug?: string },
  ) => void;
  updateStatus: (ticketId: string, status: DesignTicketStatus, actorName: string) => void;
  assignTicket: (
    ticketId: string,
    assigneeId: string | undefined,
    assigneeName: string,
    actorName: string,
  ) => void;
  updatePriority: (ticketId: string, priority: DesignTicketPriority, actorName: string) => void;
  deleteTicket: (ticketId: string) => void;
  getById: (id: string) => DesignTicket | undefined;
  clearHighlight: (ticketId: string) => void;
};

function userMessage(
  ticketId: string,
  input: {
    authorType: "client" | "team";
    authorName: string;
    message: string;
    attachments?: DesignTicketAttachment[];
  },
): DesignTicketMessage {
  return {
    id: newId(),
    ticketId,
    kind: "message",
    authorType: input.authorType,
    authorName: input.authorName,
    message: input.message,
    attachments: input.attachments?.length ? input.attachments : undefined,
    createdAt: nowIso(),
  };
}

function statusLabel(status: DesignTicketStatus) {
  return status === "in-progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
}

function systemMessage(ticketId: string, text: string): DesignTicketMessage {
  return {
    id: newId(),
    ticketId,
    kind: "system",
    authorType: "system",
    authorName: "System",
    message: text,
    createdAt: nowIso(),
  };
}

function highlightTicket(get: () => DesignTicketState, set: (fn: (s: DesignTicketState) => Partial<DesignTicketState>) => void, ticketId: string) {
  set((s) => ({
    highlightIds: [...s.highlightIds.filter((x) => x !== ticketId), ticketId],
  }));
  if (typeof window !== "undefined") {
    window.setTimeout(() => get().clearHighlight(ticketId), 8000);
  }
}

export const useDesignTicketStore = createPersistedStore<DesignTicketState>(
  "design-tickets-v1",
  (set, get) => ({
    tickets: [],
    highlightIds: [],

    hydrateTickets: (tickets) => {
      set({ tickets });
    },

    hydrateCompanyTickets: (companyId, tickets) => {
      set((s) => {
        const others = s.tickets.filter((t) => t.companyId !== companyId);
        return { tickets: [...others, ...tickets] };
      });
    },

    mergeTicket: (ticket) => {
      set((s) => {
        const idx = s.tickets.findIndex((t) => t.id === ticket.id);
        if (idx === -1) return { tickets: [ticket, ...s.tickets] };
        const next = [...s.tickets];
        next[idx] = ticket;
        return { tickets: next };
      });
    },

    createPortalTicket: async (slug, input) => {
      const ticket = await createPortalDesignTicket({
        data: {
          slug,
          subject: input.subject,
          description: input.description,
          category: input.category,
          priority: input.priority,
          authorName: input.authorName,
          attachments: input.attachments,
        },
      });
      get().mergeTicket(ticket);
      highlightTicket(get, set, ticket.id);
      return ticket;
    },

    addMessage: (ticketId, input, opts) => {
      if (!input.message.trim()) return;
      const msg = userMessage(ticketId, { ...input, message: input.message.trim() });
      set((s) => ({
        tickets: s.tickets.map((t) =>
          t.id === ticketId ? touch({ ...t, messages: [...t.messages, msg] }) : t,
        ),
      }));

      if (opts?.portalSlug) {
        serverSync("portal reply", () =>
          addPortalDesignTicketMessage({
            data: {
              slug: opts.portalSlug!,
              ticketId,
              authorName: input.authorName,
              message: input.message.trim(),
              attachments: input.attachments,
            },
          }).then((ticket) => get().mergeTicket(ticket)),
        );
        return;
      }

      serverSync("design ticket reply", () =>
        addDesignTicketMessage({
          data: {
            ticketId,
            authorType: input.authorType,
            authorName: input.authorName,
            message: input.message.trim(),
            attachments: input.attachments,
          },
        }).then((ticket) => get().mergeTicket(ticket)),
      );
    },

    updateStatus: (ticketId, status, actorName) => {
      const prev = get().getById(ticketId);
      if (!prev || prev.status === status) return;
      const now = nowIso();
      const log = systemMessage(
        ticketId,
        `Status changed to ${statusLabel(status)} by ${actorName}`,
      );
      set((s) => ({
        tickets: s.tickets.map((t) =>
          t.id === ticketId
            ? touch({
                ...t,
                status,
                resolvedAt:
                  status === "resolved"
                    ? (t.resolvedAt ?? now)
                    : status === "closed"
                      ? (t.resolvedAt ?? now)
                      : undefined,
                messages: [...t.messages, log],
              })
            : t,
        ),
      }));
      serverSync("design ticket status", () =>
        updateDesignTicketStatus({ data: { ticketId, status, actorName } }).then((ticket) =>
          get().mergeTicket(ticket),
        ),
      );
    },

    assignTicket: (ticketId, assigneeId, assigneeName, actorName) => {
      const prev = get().getById(ticketId);
      if (!prev) return;
      const label = assigneeId ? assigneeName : "Unassigned";
      const log = systemMessage(ticketId, `Assignee set to ${label} by ${actorName}`);
      set((s) => ({
        tickets: s.tickets.map((t) =>
          t.id === ticketId
            ? touch({
                ...t,
                assigneeId,
                messages: [...t.messages, log],
              })
            : t,
        ),
      }));
      serverSync("design ticket assignee", () =>
        assignDesignTicket({
          data: { ticketId, assigneeId, assigneeName, actorName },
        }).then((ticket) => get().mergeTicket(ticket)),
      );
    },

    updatePriority: (ticketId, priority, actorName) => {
      const prev = get().getById(ticketId);
      if (!prev || prev.priority === priority) return;
      const log = systemMessage(
        ticketId,
        `Priority changed to ${priority.charAt(0).toUpperCase() + priority.slice(1)} by ${actorName}`,
      );
      set((s) => ({
        tickets: s.tickets.map((t) =>
          t.id === ticketId
            ? touch({
                ...t,
                priority,
                messages: [...t.messages, log],
              })
            : t,
        ),
      }));
      serverSync("design ticket priority", () =>
        updateDesignTicketPriority({ data: { ticketId, priority, actorName } }).then((ticket) =>
          get().mergeTicket(ticket),
        ),
      );
    },

    deleteTicket: (ticketId) => {
      set((s) => ({
        tickets: s.tickets.filter((t) => t.id !== ticketId),
        highlightIds: s.highlightIds.filter((id) => id !== ticketId),
      }));
      serverSync("delete design ticket", () => deleteDesignTicket({ data: { id: ticketId } }));
    },

    getById: (id) => get().tickets.find((t) => t.id === id),

    clearHighlight: (ticketId) => {
      set((s) => ({
        highlightIds: s.highlightIds.filter((id) => id !== ticketId),
      }));
    },
  }),
);
