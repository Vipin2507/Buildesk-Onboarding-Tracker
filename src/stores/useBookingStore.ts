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
  ensureBookingDefaultsBatch,
  getAppConfig,
  listBookingAppointments,
  listBookingAvailability,
  listBookingBlocks,
  listBookingEventTypes,
  listPortalBookingEventTypes,
  listPortalBookingSlots,
  listPortalBookings,
  listStaffBookingSlots,
  replaceBookingAvailability,
  rescheduleBookingAppointment,
  retryBookingGoogleCalendarSync,
  updateBookingAppointmentStatus,
} from "@/lib/api";
import {
  getCrmMasterBookingCallTypes,
  getCrmMasterBookingHostHours,
} from "@/stores/useCrmMasterStore";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";
import type { AutomationLog } from "@/types/automation";
import { createStore } from "./persist";

function masterCatalogPayload() {
  const callTypes = getCrmMasterBookingCallTypes()
    .filter((c) => c.isActive)
    .map((c) => ({
      key: c.key,
      label: c.label,
      durationMinutes: c.durationMinutes,
      isActive: c.isActive,
    }));
  const hostHours = getCrmMasterBookingHostHours().map((h) => ({
    weekday: h.weekday,
    startTime: h.startTime,
    endTime: h.endTime,
    enabled: h.enabled,
  }));
  return { callTypes, hostHours };
}

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
  ensureDefaultsBatch: (companyIds: string[]) => Promise<void>;
  refreshStaff: (opts?: { hostUserId?: string }) => Promise<void>;
  listPortalEventTypes: (slug: string) => Promise<BookingEventType[]>;
  listPortalSlots: (
    slug: string,
    eventTypeId: string,
    from: string,
    to: string,
    durationMinutes?: number,
  ) => Promise<BookingSlot[]>;
  listPortalAppointments: (slug: string, guestEmail?: string) => Promise<BookingAppointment[]>;
  createPortalRequest: (input: {
    slug: string;
    eventTypeId: string;
    startsAt: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    notes?: string;
    durationMinutes?: number;
  }) => Promise<BookingAppointment>;
  acceptAppointment: (id: string, hostNote?: string) => Promise<BookingAppointment>;
  declineAppointment: (id: string, hostNote?: string) => Promise<BookingAppointment>;
  cancelAppointment: (id: string, hostNote?: string) => Promise<BookingAppointment>;
  postponeAppointment: (id: string, hostNote?: string) => Promise<BookingAppointment>;
  rescheduleAppointment: (id: string, startsAt: string) => Promise<BookingAppointment>;
  retryGoogleCalendarSync: (id: string) => Promise<BookingAppointment>;
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

async function refreshCrmAutomationLogsFromServer() {
  try {
    const cfg = await getAppConfig({ data: { key: "crm-automation" } });
    if (cfg && typeof cfg === "object" && Array.isArray((cfg as { logs?: unknown }).logs)) {
      const logs = (cfg as { logs: AutomationLog[] }).logs.slice(0, 500);
      useCrmAutomationStore.setState((s) => ({ ...s, logs }));
    }
  } catch {
    // Non-blocking — logs sync on next app bootstrap.
  }
}

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
    const catalog = masterCatalogPayload();
    const result = await ensureBookingDefaults({
      data: { companyId, ...catalog },
    });
    if (result.skipped) return;
    set((s) => {
      const byId = new Map(s.eventTypes.map((e) => [e.id, e]));
      for (const et of result.eventTypes) byId.set(et.id, et);
      return {
        eventTypes: [...byId.values()],
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

  ensureDefaultsBatch: async (companyIds) => {
    if (companyIds.length === 0) return;
    const catalog = masterCatalogPayload();
    const result = await ensureBookingDefaultsBatch({
      data: { companyIds, ...catalog },
    });
    set((s) => {
      const byId = new Map(s.eventTypes.map((e) => [e.id, e]));
      for (const et of result.eventTypes) byId.set(et.id, et);
      const hostIds = new Set(result.availability.map((a) => a.hostUserId));
      return {
        eventTypes: [...byId.values()],
        availability: [
          ...s.availability.filter((a) => !hostIds.has(a.hostUserId)),
          ...result.availability,
        ],
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
    const rows = await listPortalBookingEventTypes({
      data: { slug },
    });
    set((s) => {
      const byId = new Map(s.eventTypes.map((e) => [e.id, e]));
      for (const row of rows) byId.set(row.id, row);
      return { eventTypes: [...byId.values()] };
    });
    return rows;
  },

  listPortalSlots: (slug, eventTypeId, from, to, durationMinutes) =>
    listPortalBookingSlots({
      data: { slug, eventTypeId, from, to, durationMinutes },
    }),

  listPortalAppointments: async (slug, guestEmail) => {
    const rows = await listPortalBookings({
      data: { slug, guestEmail },
    });
    set((s) => {
      const byId = new Map(s.appointments.map((a) => [a.id, a]));
      for (const row of rows) byId.set(row.id, row);
      return { appointments: [...byId.values()] };
    });
    return rows;
  },

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
    void refreshCrmAutomationLogsFromServer();
    return updated;
  },

  declineAppointment: async (id, hostNote) => {
    const updated = await updateBookingAppointmentStatus({
      data: { id, status: "declined", hostNote },
    });
    get().mergeAppointment(updated);
    void refreshCrmAutomationLogsFromServer();
    return updated;
  },

  cancelAppointment: async (id, hostNote) => {
    const updated = await updateBookingAppointmentStatus({
      data: { id, status: "cancelled", hostNote },
    });
    get().mergeAppointment(updated);
    void refreshCrmAutomationLogsFromServer();
    return updated;
  },

  postponeAppointment: async (id, hostNote) => {
    const updated = await updateBookingAppointmentStatus({
      data: { id, status: "postponed", hostNote },
    });
    get().mergeAppointment(updated);
    void refreshCrmAutomationLogsFromServer();
    return updated;
  },

  rescheduleAppointment: async (id, startsAt) => {
    const updated = await rescheduleBookingAppointment({ data: { id, startsAt } });
    get().mergeAppointment(updated);
    return updated;
  },

  retryGoogleCalendarSync: async (id) => {
    const updated = await retryBookingGoogleCalendarSync({ data: { id } });
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
