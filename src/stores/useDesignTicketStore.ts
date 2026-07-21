import type {
  DesignTicket,
  DesignTicketAttachment,
  DesignTicketMessage,
  DesignTicketPriority,
  DesignTicketStatus,
} from "@/types/design-ticket";
import { newId, nowIso } from "@/types";
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
  nextTicketSeq: number;
  createTicket: (input: CreateDesignTicketInput) => DesignTicket;
  addMessage: (
    ticketId: string,
    input: {
      authorType: "client" | "team";
      authorName: string;
      message: string;
      attachments?: DesignTicketAttachment[];
    },
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

function nextTicketNumber(seq: number) {
  return `DT-${String(seq).padStart(3, "0")}`;
}

function systemMessage(
  ticketId: string,
  text: string,
): DesignTicketMessage {
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

export const useDesignTicketStore = createPersistedStore<DesignTicketState>(
  "design-tickets-v1",
  (set, get) => ({
    tickets: [],
    highlightIds: [],
    nextTicketSeq: 1,

    createTicket: (input) => {
      const now = nowIso();
      const seq = get().nextTicketSeq;
      const id = newId();
      const ticketNumber = nextTicketNumber(seq);
      const initialMessages: DesignTicketMessage[] = [];

      if (input.description.trim()) {
        initialMessages.push(
          userMessage(id, {
            authorType: input.createdBy.type,
            authorName: input.createdBy.name,
            message: input.description.trim(),
            attachments: input.attachments,
          }),
        );
      }

      const ticket: DesignTicket = {
        id,
        ticketNumber,
        companyId: input.companyId,
        subject: input.subject.trim(),
        description: input.description.trim(),
        category: input.category,
        priority: input.priority ?? "medium",
        status: "open",
        createdBy: input.createdBy,
        messages: initialMessages,
        createdAt: now,
        updatedAt: now,
      };

      set((s) => ({
        tickets: [ticket, ...s.tickets],
        nextTicketSeq: seq + 1,
        highlightIds: [...s.highlightIds.filter((x) => x !== id), id],
      }));

      if (typeof window !== "undefined") {
        window.setTimeout(() => get().clearHighlight(id), 8000);
      }

      return ticket;
    },

    addMessage: (ticketId, input) => {
      if (!input.message.trim()) return;
      const msg = userMessage(ticketId, { ...input, message: input.message.trim() });
      set((s) => ({
        tickets: s.tickets.map((t) =>
          t.id === ticketId
            ? touch({
                ...t,
                messages: [...t.messages, msg],
              })
            : t,
        ),
      }));
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
                  status === "resolved" ? t.resolvedAt ?? now : status === "closed" ? t.resolvedAt ?? now : undefined,
                messages: [...t.messages, log],
              })
            : t,
        ),
      }));
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
    },

    deleteTicket: (ticketId) => {
      set((s) => ({
        tickets: s.tickets.filter((t) => t.id !== ticketId),
        highlightIds: s.highlightIds.filter((id) => id !== ticketId),
      }));
    },

    getById: (id) => get().tickets.find((t) => t.id === id),

    clearHighlight: (ticketId) => {
      set((s) => ({
        highlightIds: s.highlightIds.filter((id) => id !== ticketId),
      }));
    },
  }),
);
