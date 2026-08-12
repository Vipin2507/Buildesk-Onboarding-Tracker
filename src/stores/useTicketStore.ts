import type { Ticket, TicketActivity, TicketStatus } from "@/types";
import { nowIso } from "@/types";
import { isCrmTicket } from "@/lib/crm-tickets";
import { logActivity } from "./useActivityStore";
import { notifyInApp } from "./useNotificationStore";
import { createStore, touch } from "./persist";
import {
  createTicket as apiCreate,
  updateTicket as apiUpdate,
  deleteTicket as apiDelete,
  listTicketActivities as apiListActivities,
} from "@/lib/api";
import { serverSync } from "@/lib/sync";
import {
  dispatchAutomationTrigger,
  isClosedTicketStatus,
} from "@/services/automation";
import { dispatchCrmAutomationTrigger } from "@/services/crm-automation";

function ticketNotifyHref(ticket: Pick<Ticket, "id" | "projectId" | "companyId">) {
  return isCrmTicket(ticket as Ticket) ? `/crm/support/${ticket.id}` : `/support/${ticket.id}`;
}

function dispatchTicketAutomation(
  trigger: Parameters<typeof dispatchAutomationTrigger>[0],
  ticket: Ticket,
  opts?: { replyMessage?: string },
) {
  if (isCrmTicket(ticket)) {
    dispatchCrmAutomationTrigger(trigger, ticket, opts);
    return;
  }
  dispatchAutomationTrigger(trigger, ticket, opts);
}

type TicketState = {
  tickets: Ticket[];
  activities: TicketActivity[];
  setActivities: (activities: TicketActivity[]) => void;
  addTicket: (
    data: Omit<
      Ticket,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "backendAssigned"
      | "resolutionStatus"
      | "actionTaken"
      | "resolutionNotes"
    > &
      Partial<
        Pick<
          Ticket,
          "backendAssigned" | "resolutionStatus" | "actionTaken" | "resolutionNotes"
        >
      >,
  ) => Ticket;
  updateTicket: (id: string, data: Partial<Ticket> & { updateRemark?: string }) => void;
  deleteTicket: (id: string) => Ticket | undefined;
  moveTicket: (id: string, status: TicketStatus) => void;
  bulkDeleteTickets: (ticketIds: string[]) => void;
  bulkAssignDeveloper: (ticketIds: string[], developerId: string) => void;
  bulkAssignOwner: (ticketIds: string[], assignedUserId: string | undefined) => void;
  bulkUpdateStatus: (ticketIds: string[], status: TicketStatus) => void;
  bulkUpdatePriority: (ticketIds: string[], priority: Ticket["priority"]) => void;
  getById: (id: string) => Ticket | undefined;
};

export const useTicketStore = createStore<TicketState>((set, get) => ({
  tickets: [],
  activities: [],
  setActivities: (activities) => set({ activities }),

  addTicket: (data) => {
    const now = nowIso();
    const ticket: Ticket = {
      ...data,
      description: data.description ?? "",
      projectId: data.projectId ?? "",
      assignedUserId: data.assignedUserId,
      actionTaken: data.actionTaken ?? "",
      backendAssigned: data.backendAssigned ?? false,
      backendAssigneeId: data.backendAssigneeId,
      backendForwardedAt: data.backendForwardedAt,
      resolutionStatus: data.resolutionStatus ?? "Not Resolved",
      resolutionAt: data.resolutionAt,
      etaRevisedAt: data.etaRevisedAt,
      resolutionNotes: data.resolutionNotes ?? "",
      id: `TKT-${1000 + get().tickets.length + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ tickets: [ticket, ...s.tickets] }));
    logActivity({ who: "You", what: `Created ticket ${ticket.id}: ${ticket.title}`, kind: "info" });
    notifyInApp({
      title: `New ticket ${ticket.id}`,
      body: ticket.title,
      kind: ticket.priority === "Critical" ? "danger" : "info",
      href: ticketNotifyHref(ticket),
      companyId: ticket.companyId,
      ticketId: ticket.id,
      gate: isCrmTicket(ticket) ? "none" : "ticket",
    });
    serverSync("createTicket", () =>
      apiCreate({
        data: {
          id: ticket.id,
          type: ticket.type,
          title: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
          raisedOn: ticket.raisedOn,
          eta: ticket.eta,
          developerId: ticket.developerId,
          companyId: ticket.companyId,
          projectId: ticket.projectId || undefined,
          description: ticket.description,
          assignedUserId: ticket.assignedUserId,
          actionTaken: ticket.actionTaken,
          backendAssigned: ticket.backendAssigned,
          backendAssigneeId: ticket.backendAssigneeId,
          backendForwardedAt: ticket.backendForwardedAt,
          resolutionStatus: ticket.resolutionStatus,
          resolutionAt: ticket.resolutionAt,
          etaRevisedAt: ticket.etaRevisedAt,
          resolutionNotes: ticket.resolutionNotes,
        },
      }).then(async (saved) => {
        if (saved) {
          set((s) => ({ tickets: s.tickets.map((t) => (t.id === ticket.id ? saved as Ticket : t)) }));
        }
        const activities = await apiListActivities({ data: { ticketId: ticket.id } });
        set((s) => ({
          activities: [...activities, ...s.activities.filter((a) => a.ticketId !== ticket.id)],
        }));
        return saved;
      }),
    );
    dispatchTicketAutomation("ticket-created", ticket);
    return ticket;
  },

  updateTicket: (id, data) => {
    const prev = get().getById(id);
    const { updateRemark, ...patch } = data;
    set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? touch({ ...t, ...patch }) : t)) }));
    const ticket = get().getById(id);
    if (ticket) logActivity({ who: "You", what: `Updated ticket ${id}`, kind: "info" });
    if (prev && data.status && data.status !== prev.status) {
      notifyInApp({
        title: `${id} → ${data.status}`,
        body: ticket?.title ?? prev.title,
        kind: "info",
        href: ticketNotifyHref(ticket ?? prev),
        companyId: ticket?.companyId ?? prev.companyId,
        ticketId: id,
        gate: isCrmTicket(ticket ?? prev) ? "none" : "ticket",
      });
    }
    if (prev && data.developerId && data.developerId !== prev.developerId) {
      notifyInApp({
        title: `${id} reassigned`,
        body: ticket?.title ?? prev.title,
        kind: "info",
        href: ticketNotifyHref(ticket ?? prev),
        companyId: ticket?.companyId ?? prev.companyId,
        ticketId: id,
        gate: isCrmTicket(ticket ?? prev) ? "none" : "ticket",
      });
    }
    serverSync("updateTicket", () =>
      apiUpdate({ data: { id, patch: { ...patch, updateRemark } } }).then(async (saved) => {
        if (saved) {
          set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? saved as Ticket : t)) }));
        }
        const activities = await apiListActivities({ data: { ticketId: id } });
        set((s) => ({
          activities: [...activities, ...s.activities.filter((a) => a.ticketId !== id)],
        }));
        return saved;
      }),
    );
    const updated = get().getById(id);
    if (updated) {
      if (updateRemark?.trim()) {
        dispatchTicketAutomation("ticket-reply-from-team", updated, {
          replyMessage: updateRemark.trim(),
        });
      } else if (data.status && prev && data.status !== prev.status) {
        dispatchTicketAutomation(
          isClosedTicketStatus(data.status) ? "ticket-closed" : "ticket-updated",
          updated,
        );
      } else if (data.status && !prev) {
        dispatchTicketAutomation(
          isClosedTicketStatus(data.status) ? "ticket-closed" : "ticket-updated",
          updated,
        );
      }
    }
  },

  deleteTicket: (id) => {
    const ticket = get().getById(id);
    set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) }));
    if (ticket) {
      logActivity({ who: "You", what: `Deleted ticket ${id}`, kind: "warning" });
      serverSync("deleteTicket", () => apiDelete({ data: { id } }));
    }
    return ticket;
  },

  moveTicket: (id, status) => {
    const prev = get().getById(id);
    if (prev?.status === status) return;
    set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? touch({ ...t, status }) : t)) }));
    logActivity({ who: "You", what: `Ticket ${id} moved to ${status}`, kind: "info" });
    notifyInApp({
      title: `${id} → ${status}`,
      body: prev?.title ?? "Ticket status updated",
      kind: "info",
      href: prev ? ticketNotifyHref(prev) : `/support/${id}`,
      companyId: prev?.companyId,
      ticketId: id,
      gate: prev && isCrmTicket(prev) ? "none" : "ticket",
    });
    serverSync("moveTicket", () => apiUpdate({ data: { id, patch: { status } } }));
    const updated = get().getById(id);
    if (updated) {
      dispatchTicketAutomation(
        isClosedTicketStatus(status) ? "ticket-closed" : "ticket-updated",
        updated,
      );
    }
  },

  getById: (id) => get().tickets.find((t) => t.id === id),

  bulkDeleteTickets: (ticketIds) => {
    for (const id of ticketIds) {
      get().deleteTicket(id);
    }
  },

  bulkAssignDeveloper: (ticketIds, developerId) => {
    for (const id of ticketIds) {
      get().updateTicket(id, { developerId });
    }
  },

  bulkAssignOwner: (ticketIds, assignedUserId) => {
    for (const id of ticketIds) {
      get().updateTicket(id, { assignedUserId: assignedUserId || undefined });
    }
  },

  bulkUpdateStatus: (ticketIds, status) => {
    for (const id of ticketIds) {
      get().moveTicket(id, status);
    }
  },

  bulkUpdatePriority: (ticketIds, priority) => {
    for (const id of ticketIds) {
      get().updateTicket(id, { priority });
    }
  },
}));
