import type { Ticket, TicketActivity, TicketStatus } from "@/types";
import { nowIso } from "@/types";
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
      href: `/support/${ticket.id}`,
      companyId: ticket.companyId,
      ticketId: ticket.id,
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
        href: `/support/${id}`,
        companyId: ticket?.companyId ?? prev.companyId,
        ticketId: id,
      });
    }
    if (prev && data.developerId && data.developerId !== prev.developerId) {
      notifyInApp({
        title: `${id} reassigned`,
        body: ticket?.title ?? prev.title,
        kind: "info",
        href: `/support/${id}`,
        companyId: ticket?.companyId ?? prev.companyId,
        ticketId: id,
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
      href: `/support/${id}`,
      companyId: prev?.companyId,
      ticketId: id,
    });
    serverSync("moveTicket", () => apiUpdate({ data: { id, patch: { status } } }));
  },

  getById: (id) => get().tickets.find((t) => t.id === id),
}));
