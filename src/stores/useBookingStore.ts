import type {
  BookingAppointment,
  BookingAvailability,
  BookingBlock,
  BookingEventType,
  BookingSlot,
} from "@/types/booking";
import {
  createBookingBlock,
  createPortalBooking,
  deleteBookingAvailability,
  deleteBookingBlock,
  ensureBookingDefaults,
  listBookingAppointments,
  listBookingAvailability,
  listBookingBlocks,
  listBookingEventTypes,
  listPortalBookingEventTypes,
  listPortalBookingSlots,
  listStaffBookingSlots,
  replaceBookingAvailability,
  rescheduleBookingAppointment,
  updateBookingAppointmentStatus,
} from "@/lib/api";
import { createStore } from "./persist";

type BookingState = {
  eventTypes: BookingEventType[];
  appointments: BookingAppointment[];
  availability: BookingAvailability[];
  blocks: BookingBlock[];
  hydrateEventTypes: (rows: BookingEventType[]) => void;
  hydrateAppointments: (rows: BookingAppointment[]) => void;
  hydrateAvailability: (rows: BookingAvailability[]) => void;
  hydrateBlocks: (rows: BookingBlock[]) => void;
  mergeAppointment: (row: BookingAppointment) => void;
  ensureDefaults: (companyId: string) => Promise<void>;
  refreshStaff: (opts?: { hostUserId?: string }) => Promise<void>;
  listPortalEventTypes: (slug: string) => Promise<BookingEventType[]>;
  listPortalSlots: (
    slug: string,
    eventTypeId: string,
    from: string,
    to: string,
  ) => Promise<BookingSlot[]>;
  createPortalRequest: (input: {
    slug: string;
    eventTypeId: string;
    startsAt: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    notes?: string;
  }) => Promise<BookingAppointment>;
  acceptAppointment: (id: string, hostNote?: string) => Promise<BookingAppointment>;
  declineAppointment: (id: string, hostNote?: string) => Promise<BookingAppointment>;
  cancelAppointment: (id: string, hostNote?: string) => Promise<BookingAppointment>;
  rescheduleAppointment: (id: string, startsAt: string) => Promise<BookingAppointment>;
  listSlotsForEvent: (eventTypeId: string, from: string, to: string) => Promise<BookingSlot[]>;
  saveAvailabilityWindows: (input: {
    hostUserId?: string;
    timezone?: string;
    windows: { weekday: number; startTime: string; endTime: string; isActive?: boolean }[];
  }) => Promise<BookingAvailability[]>;
  removeAvailability: (id: string) => Promise<void>;
  addBlock: (input: {
    hostUserId?: string;
    startsAt: string;
    endsAt: string;
    reason?: string;
  }) => Promise<BookingBlock>;
  removeBlock: (id: string) => Promise<void>;
};

export const useBookingStore = createStore<BookingState>((set, get) => ({
  eventTypes: [],
  appointments: [],
  availability: [],
  blocks: [],

  hydrateEventTypes: (rows) => set({ eventTypes: rows }),
  hydrateAppointments: (rows) => set({ appointments: rows }),
  hydrateAvailability: (rows) => set({ availability: rows }),
  hydrateBlocks: (rows) => set({ blocks: rows }),

  mergeAppointment: (row) =>
    set((s) => {
      const idx = s.appointments.findIndex((a) => a.id === row.id);
      if (idx === -1) return { appointments: [...s.appointments, row] };
      const next = [...s.appointments];
      next[idx] = row;
      return { appointments: next };
    }),

  ensureDefaults: async (companyId) => {
    const result = await ensureBookingDefaults({ data: { companyId } });
    set((s) => {
      const others = s.eventTypes.filter(
        (e) => !(e.companyId === companyId && e.slug === result.eventType.slug),
      );
      return {
        eventTypes: [...others, result.eventType],
        availability:
          result.availability.length > 0
            ? [
                ...s.availability.filter((a) => a.hostUserId !== result.hostUserId),
                ...result.availability,
              ]
            : s.availability,
      };
    });
  },

  refreshStaff: async (opts) => {
    const [eventTypes, appointments, availability, blocks] = await Promise.all([
      listBookingEventTypes({ data: {} }),
      listBookingAppointments({ data: opts?.hostUserId ? { hostUserId: opts.hostUserId } : {} }),
      listBookingAvailability({ data: opts?.hostUserId ? { hostUserId: opts.hostUserId } : {} }),
      listBookingBlocks({ data: opts?.hostUserId ? { hostUserId: opts.hostUserId } : {} }),
    ]);
    set({ eventTypes, appointments, availability, blocks });
  },

  listPortalEventTypes: async (slug) => {
    const rows = await listPortalBookingEventTypes({ data: { slug } });
    set((s) => {
      const byId = new Map(s.eventTypes.map((e) => [e.id, e]));
      for (const row of rows) byId.set(row.id, row);
      return { eventTypes: [...byId.values()] };
    });
    return rows;
  },

  listPortalSlots: (slug, eventTypeId, from, to) =>
    listPortalBookingSlots({ data: { slug, eventTypeId, from, to } }),

  createPortalRequest: async (input) => {
    const created = await createPortalBooking({ data: input });
    get().mergeAppointment(created);
    return created;
  },

  acceptAppointment: async (id, hostNote) => {
    const updated = await updateBookingAppointmentStatus({
      data: { id, status: "confirmed", hostNote },
    });
    get().mergeAppointment(updated);
    return updated;
  },

  declineAppointment: async (id, hostNote) => {
    const updated = await updateBookingAppointmentStatus({
      data: { id, status: "declined", hostNote },
    });
    get().mergeAppointment(updated);
    return updated;
  },

  cancelAppointment: async (id, hostNote) => {
    const updated = await updateBookingAppointmentStatus({
      data: { id, status: "cancelled", hostNote },
    });
    get().mergeAppointment(updated);
    return updated;
  },

  rescheduleAppointment: async (id, startsAt) => {
    const updated = await rescheduleBookingAppointment({ data: { id, startsAt } });
    get().mergeAppointment(updated);
    return updated;
  },

  listSlotsForEvent: (eventTypeId, from, to) =>
    listStaffBookingSlots({ data: { eventTypeId, from, to } }),

  saveAvailabilityWindows: async (input) => {
    const rows = await replaceBookingAvailability({ data: input });
    set((s) => {
      const hostId = input.hostUserId ?? rows[0]?.hostUserId;
      return {
        availability: hostId
          ? [...s.availability.filter((a) => a.hostUserId !== hostId), ...rows]
          : rows,
      };
    });
    return rows;
  },

  removeAvailability: async (id) => {
    await deleteBookingAvailability({ data: { id } });
    set((s) => ({ availability: s.availability.filter((a) => a.id !== id) }));
  },

  addBlock: async (input) => {
    const row = await createBookingBlock({ data: input });
    set((s) => ({ blocks: [...s.blocks, row] }));
    return row;
  },

  removeBlock: async (id) => {
    await deleteBookingBlock({ data: { id } });
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
  },
}));
