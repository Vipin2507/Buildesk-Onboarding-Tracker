import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";

import { resolveBookingHostUserId, resolveHostTimezone } from "@/lib/booking-host";
import { computeOpenSlots } from "@/lib/booking-slots";
import { isAdminRoleKey } from "@/lib/permissions";
import { insertBookingRequestNotification } from "@/server/api/notifications";
import { ApiError, getSessionUser, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type {
  BookingAppointment,
  BookingAppointmentStatus,
  BookingAvailability,
  BookingBlock,
  BookingCreatedVia,
  BookingEventType,
} from "@/types/booking";
import {
  DEFAULT_BOOKING_DURATION_MINUTES,
  DEFAULT_BOOKING_EVENT_SLUG,
  DEFAULT_BOOKING_EVENT_TITLE,
} from "@/types/booking";
import { seedCrmBookingCallTypes, seedCrmBookingHostHours } from "@/data/crm-booking-defaults";

/* ---------- Mappers ---------- */

function mapEventType(row: typeof t.bookingEventTypes.$inferSelect): BookingEventType {
  return {
    id: row.id,
    companyId: row.companyId,
    slug: row.slug,
    title: row.title,
    durationMinutes: row.durationMinutes,
    hostUserId: row.hostUserId ?? undefined,
    bufferBeforeMinutes: row.bufferBeforeMinutes,
    bufferAfterMinutes: row.bufferAfterMinutes,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAvailability(row: typeof t.bookingAvailability.$inferSelect): BookingAvailability {
  return {
    id: row.id,
    hostUserId: row.hostUserId,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapBlock(row: typeof t.bookingBlocks.$inferSelect): BookingBlock {
  return {
    id: row.id,
    hostUserId: row.hostUserId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    reason: row.reason ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAppointment(row: typeof t.bookingAppointments.$inferSelect): BookingAppointment {
  return {
    id: row.id,
    eventTypeId: row.eventTypeId,
    companyId: row.companyId,
    hostUserId: row.hostUserId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status as BookingAppointmentStatus,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone ?? undefined,
    notes: row.notes ?? undefined,
    hostNote: row.hostNote ?? undefined,
    createdVia: row.createdVia as BookingCreatedVia,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* ---------- Helpers ---------- */

function resolveActivePortal(db: ReturnType<typeof getDb>, slug: string) {
  const row = db
    .select()
    .from(t.companyPortalAccess)
    .where(eq(t.companyPortalAccess.slug, slug))
    .get();
  if (!row) throw new ApiError(404, "Portal not found");
  if (!row.isActive) throw new ApiError(403, "Portal inactive");
  return row;
}

function assertCanManageAppointment(
  user: { id: string; role?: string },
  appointment: { hostUserId: string },
) {
  if (isAdminRoleKey(user.role)) return;
  if (appointment.hostUserId !== user.id) {
    throw new ApiError(403, "Not allowed to manage this booking");
  }
}

function seedDefaultAvailability(
  hostUserId: string,
  timezone: string,
  hostHours?: { weekday: number; startTime: string; endTime: string; enabled?: boolean }[],
) {
  const db = getDb();
  const existing = db
    .select()
    .from(t.bookingAvailability)
    .where(eq(t.bookingAvailability.hostUserId, hostUserId))
    .all();
  if (existing.length > 0) return existing.map(mapAvailability);

  const windows =
    hostHours && hostHours.length > 0
      ? hostHours.filter((h) => h.enabled !== false)
      : [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startTime: "10:00",
          endTime: "17:00",
          enabled: true,
        }));

  const now = nowIso();
  const created: BookingAvailability[] = [];
  for (const win of windows) {
    const id = newId();
    db.insert(t.bookingAvailability)
      .values({
        id,
        hostUserId,
        weekday: win.weekday,
        startTime: win.startTime,
        endTime: win.endTime,
        timezone,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    created.push({
      id,
      hostUserId,
      weekday: win.weekday,
      startTime: win.startTime,
      endTime: win.endTime,
      timezone,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  return created;
}

type CallTypeSeed = {
  key: string;
  label: string;
  durationMinutes: number;
  isActive?: boolean;
};

/** Upsert event types from Master call-type catalog (query/training/other…). */
function ensureEventTypesFromCatalog(
  companyId: string,
  callTypes?: CallTypeSeed[],
  hostHours?: { weekday: number; startTime: string; endTime: string; enabled?: boolean }[],
): BookingEventType[] {
  const db = getDb();
  const hostUserId = resolveBookingHostUserId(companyId);
  const now = nowIso();
  const catalog =
    callTypes && callTypes.length > 0
      ? callTypes
      : [
          {
            key: DEFAULT_BOOKING_EVENT_SLUG,
            label: DEFAULT_BOOKING_EVENT_TITLE,
            durationMinutes: DEFAULT_BOOKING_DURATION_MINUTES,
            isActive: true,
          },
        ];

  const out: BookingEventType[] = [];
  for (const ct of catalog) {
    const slug = ct.key.trim().toLowerCase();
    if (!slug) continue;
    const existing = db
      .select()
      .from(t.bookingEventTypes)
      .where(
        and(eq(t.bookingEventTypes.companyId, companyId), eq(t.bookingEventTypes.slug, slug)),
      )
      .get();
    if (existing) {
      db.update(t.bookingEventTypes)
        .set({
          title: ct.label.trim() || existing.title,
          durationMinutes: Math.max(5, ct.durationMinutes || existing.durationMinutes),
          isActive: ct.isActive !== false,
          hostUserId: existing.hostUserId ?? hostUserId ?? null,
          updatedAt: now,
        })
        .where(eq(t.bookingEventTypes.id, existing.id))
        .run();
      out.push(
        mapEventType(
          db.select().from(t.bookingEventTypes).where(eq(t.bookingEventTypes.id, existing.id)).get()!,
        ),
      );
      continue;
    }
    const id = newId();
    db.insert(t.bookingEventTypes)
      .values({
        id,
        companyId,
        slug,
        title: ct.label.trim() || slug,
        durationMinutes: Math.max(5, ct.durationMinutes || DEFAULT_BOOKING_DURATION_MINUTES),
        hostUserId: hostUserId ?? null,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        isActive: ct.isActive !== false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    out.push(
      mapEventType(db.select().from(t.bookingEventTypes).where(eq(t.bookingEventTypes.id, id)).get()!),
    );
  }

  if (hostUserId) {
    seedDefaultAvailability(hostUserId, resolveHostTimezone(hostUserId), hostHours);
  }
  return out;
}

function ensureDefaultEventType(companyId: string): BookingEventType {
  const types = ensureEventTypesFromCatalog(companyId);
  return types[0]!;
}

function resolveEventHost(event: BookingEventType): string {
  if (event.hostUserId) return event.hostUserId;
  const resolved = resolveBookingHostUserId(event.companyId);
  if (!resolved) throw new ApiError(400, "No booking host configured for this account");
  return resolved;
}

function collectBusyRanges(hostUserId: string, fromYmd: string, toYmd: string) {
  const db = getDb();
  const rangeStart = `${fromYmd}T00:00:00`;
  const rangeEnd = `${toYmd}T23:59:59`;

  const appts = db
    .select()
    .from(t.bookingAppointments)
    .where(
      and(
        eq(t.bookingAppointments.hostUserId, hostUserId),
        inArray(t.bookingAppointments.status, ["pending", "confirmed", "postponed"]),
        lte(t.bookingAppointments.startsAt, rangeEnd),
        gte(t.bookingAppointments.endsAt, rangeStart),
      ),
    )
    .all();

  const blocks = db
    .select()
    .from(t.bookingBlocks)
    .where(
      and(
        eq(t.bookingBlocks.hostUserId, hostUserId),
        lte(t.bookingBlocks.startsAt, rangeEnd),
        gte(t.bookingBlocks.endsAt, rangeStart),
      ),
    )
    .all();

  return [
    ...appts.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
    ...blocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
  ];
}

function loadOpenSlots(event: BookingEventType, fromYmd: string, toYmd: string) {
  const hostUserId = resolveEventHost(event);
  const db = getDb();
  const windows = db
    .select()
    .from(t.bookingAvailability)
    .where(
      and(
        eq(t.bookingAvailability.hostUserId, hostUserId),
        eq(t.bookingAvailability.isActive, true),
      ),
    )
    .all();

  if (windows.length === 0) {
    seedDefaultAvailability(hostUserId, resolveHostTimezone(hostUserId));
    return loadOpenSlots(event, fromYmd, toYmd);
  }

  return computeOpenSlots({
    fromYmd,
    toYmd,
    durationMinutes: event.durationMinutes,
    bufferBeforeMinutes: event.bufferBeforeMinutes,
    bufferAfterMinutes: event.bufferAfterMinutes,
    windows: windows.map(mapAvailability),
    busy: collectBusyRanges(hostUserId, fromYmd, toYmd),
  });
}

/* ---------- Portal (public) ---------- */

export const listPortalBookingEventTypes = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        callTypes: z
          .array(
            z.object({
              key: z.string().min(1),
              label: z.string().min(1),
              durationMinutes: z.number().int().min(5),
              isActive: z.boolean().optional(),
            }),
          )
          .optional(),
        hostHours: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              startTime: z.string().min(4),
              endTime: z.string().min(4),
              enabled: z.boolean().optional(),
            }),
          )
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const portal = resolveActivePortal(db, data.slug);
    const existing = db
      .select()
      .from(t.bookingEventTypes)
      .where(eq(t.bookingEventTypes.companyId, portal.companyId))
      .all();

    const sessionUser = getSessionUser();
    if (existing.length === 0) {
      const fallbackTypes =
        data.callTypes && data.callTypes.length > 0
          ? data.callTypes
          : seedCrmBookingCallTypes().map((c) => ({
              key: c.key,
              label: c.label,
              durationMinutes: c.durationMinutes,
              isActive: c.isActive,
            }));
      const fallbackHours =
        data.hostHours && data.hostHours.length > 0
          ? data.hostHours
          : seedCrmBookingHostHours().map((h) => ({
              weekday: h.weekday,
              startTime: h.startTime,
              endTime: h.endTime,
              enabled: h.enabled,
            }));
      ensureEventTypesFromCatalog(portal.companyId, fallbackTypes, fallbackHours);
    } else if (sessionUser && data.callTypes && data.callTypes.length > 0) {
      // Staff-driven Master sync only — avoid portal clients overwriting catalog
      ensureEventTypesFromCatalog(portal.companyId, data.callTypes, data.hostHours);
    }

    return db
      .select()
      .from(t.bookingEventTypes)
      .where(
        and(
          eq(t.bookingEventTypes.companyId, portal.companyId),
          eq(t.bookingEventTypes.isActive, true),
        ),
      )
      .all()
      .map(mapEventType);
  });

export const listPortalBookings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1), guestEmail: z.string().email().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const portal = resolveActivePortal(db, data.slug);
    let rows = db
      .select()
      .from(t.bookingAppointments)
      .where(eq(t.bookingAppointments.companyId, portal.companyId))
      .all()
      .map(mapAppointment);
    if (data.guestEmail) {
      const email = data.guestEmail.trim().toLowerCase();
      rows = rows.filter((r) => r.guestEmail.toLowerCase() === email);
    }
    return rows.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  });

export const listPortalBookingSlots = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        eventTypeId: z.string().min(1),
        from: z.string().min(8),
        to: z.string().min(8),
        durationMinutes: z.number().int().min(5).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const portal = resolveActivePortal(db, data.slug);
    const row = db
      .select()
      .from(t.bookingEventTypes)
      .where(eq(t.bookingEventTypes.id, data.eventTypeId))
      .get();
    if (!row || row.companyId !== portal.companyId || !row.isActive) {
      throw new ApiError(404, "Event type not found");
    }
    const event = mapEventType(row);
    if (data.durationMinutes) {
      event.durationMinutes = data.durationMinutes;
    }
    return loadOpenSlots(event, data.from.slice(0, 10), data.to.slice(0, 10));
  });

export const createPortalBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        eventTypeId: z.string().min(1),
        startsAt: z.string().min(10),
        guestName: z.string().min(1),
        guestEmail: z.string().email(),
        guestPhone: z.string().optional(),
        notes: z.string().optional(),
        durationMinutes: z.number().int().min(5).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const portal = resolveActivePortal(db, data.slug);
    const row = db
      .select()
      .from(t.bookingEventTypes)
      .where(eq(t.bookingEventTypes.id, data.eventTypeId))
      .get();
    if (!row || row.companyId !== portal.companyId || !row.isActive) {
      throw new ApiError(404, "Event type not found");
    }
    const event = mapEventType(row);
    if (data.durationMinutes) event.durationMinutes = data.durationMinutes;
    const hostUserId = resolveEventHost(event);
    const startsAt = data.startsAt.slice(0, 19);
    const ymd = startsAt.slice(0, 10);
    const open = loadOpenSlots(event, ymd, ymd);
    const slot = open.find((s) => s.startsAt.slice(0, 19) === startsAt);
    if (!slot) throw new ApiError(400, "Selected slot is no longer available");

    const now = nowIso();
    const id = newId();
    db.insert(t.bookingAppointments)
      .values({
        id,
        eventTypeId: event.id,
        companyId: portal.companyId,
        hostUserId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: "pending",
        guestName: data.guestName.trim(),
        guestEmail: data.guestEmail.trim().toLowerCase(),
        guestPhone: data.guestPhone?.trim() || null,
        notes: data.notes?.trim() || null,
        hostNote: null,
        createdVia: "portal",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const created = db
      .select()
      .from(t.bookingAppointments)
      .where(eq(t.bookingAppointments.id, id))
      .get()!;
    const mapped = mapAppointment(created);

    const account = db
      .select({ name: t.crmAccounts.name })
      .from(t.crmAccounts)
      .where(eq(t.crmAccounts.id, portal.companyId))
      .get();
    insertBookingRequestNotification(db, {
      appointment: mapped,
      eventTitle: event.title,
      accountName: account?.name ?? "CRM account",
    });

    return mapped;
  });

/* ---------- Staff: ensure / list ---------- */

export const ensureBookingDefaults = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().min(1),
        callTypes: z
          .array(
            z.object({
              key: z.string().min(1),
              label: z.string().min(1),
              durationMinutes: z.number().int().min(5),
              isActive: z.boolean().optional(),
            }),
          )
          .optional(),
        hostHours: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              startTime: z.string().min(4),
              endTime: z.string().min(4),
              enabled: z.boolean().optional(),
            }),
          )
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!getSessionUser()) {
      return { skipped: true as const };
    }
    const eventTypes = ensureEventTypesFromCatalog(data.companyId, data.callTypes, data.hostHours);
    const eventType = eventTypes[0]!;
    const hostUserId = eventType.hostUserId ?? resolveBookingHostUserId(data.companyId);
    let availability: BookingAvailability[] = [];
    if (hostUserId) {
      availability = seedDefaultAvailability(
        hostUserId,
        resolveHostTimezone(hostUserId),
        data.hostHours,
      );
    }
    return { skipped: false as const, eventType, eventTypes, availability, hostUserId };
  });

export const ensureBookingDefaultsBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyIds: z.array(z.string().min(1)).max(500),
        callTypes: z
          .array(
            z.object({
              key: z.string().min(1),
              label: z.string().min(1),
              durationMinutes: z.number().int().min(5),
              isActive: z.boolean().optional(),
            }),
          )
          .optional(),
        hostHours: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              startTime: z.string().min(4),
              endTime: z.string().min(4),
              enabled: z.boolean().optional(),
            }),
          )
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const eventTypes: BookingEventType[] = [];
    const availabilityByHost = new Map<string, BookingAvailability[]>();
    for (const companyId of data.companyIds) {
      const types = ensureEventTypesFromCatalog(companyId, data.callTypes, data.hostHours);
      eventTypes.push(...types);
      const hostUserId =
        types[0]?.hostUserId ?? resolveBookingHostUserId(companyId);
      if (hostUserId && !availabilityByHost.has(hostUserId)) {
        availabilityByHost.set(
          hostUserId,
          seedDefaultAvailability(hostUserId, resolveHostTimezone(hostUserId), data.hostHours),
        );
      }
    }
    return {
      eventTypes,
      availability: [...availabilityByHost.values()].flat(),
    };
  });

export const listBookingEventTypes = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ companyId: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    if (data.companyId) {
      return db
        .select()
        .from(t.bookingEventTypes)
        .where(eq(t.bookingEventTypes.companyId, data.companyId))
        .all()
        .map(mapEventType);
    }
    return db.select().from(t.bookingEventTypes).all().map(mapEventType);
  });

export const listBookingAppointments = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().optional(),
        hostUserId: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    let rows = db.select().from(t.bookingAppointments).all();

    if (!isAdminRoleKey(user.role)) {
      rows = rows.filter((r) => r.hostUserId === user.id);
    } else if (data.hostUserId) {
      rows = rows.filter((r) => r.hostUserId === data.hostUserId);
    }
    if (data.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data.status) rows = rows.filter((r) => r.status === data.status);

    return rows.map(mapAppointment).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });

export const listBookingAvailability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ hostUserId: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    if (data.hostUserId) {
      if (!isAdminRoleKey(user.role) && data.hostUserId !== user.id) {
        throw new ApiError(403, "Not allowed");
      }
      return db
        .select()
        .from(t.bookingAvailability)
        .where(eq(t.bookingAvailability.hostUserId, data.hostUserId))
        .all()
        .map(mapAvailability)
        .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    }
    if (isAdminRoleKey(user.role)) {
      return db
        .select()
        .from(t.bookingAvailability)
        .all()
        .map(mapAvailability)
        .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    }
    return db
      .select()
      .from(t.bookingAvailability)
      .where(eq(t.bookingAvailability.hostUserId, user.id))
      .all()
      .map(mapAvailability)
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  });

export const listBookingBlocks = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ hostUserId: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    if (data.hostUserId) {
      if (!isAdminRoleKey(user.role) && data.hostUserId !== user.id) {
        throw new ApiError(403, "Not allowed");
      }
      return db
        .select()
        .from(t.bookingBlocks)
        .where(eq(t.bookingBlocks.hostUserId, data.hostUserId))
        .all()
        .map(mapBlock)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    if (isAdminRoleKey(user.role)) {
      return db
        .select()
        .from(t.bookingBlocks)
        .all()
        .map(mapBlock)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return db
      .select()
      .from(t.bookingBlocks)
      .where(eq(t.bookingBlocks.hostUserId, user.id))
      .all()
      .map(mapBlock)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });

export const listStaffBookingSlots = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        eventTypeId: z.string().min(1),
        from: z.string().min(8),
        to: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.bookingEventTypes)
      .where(eq(t.bookingEventTypes.id, data.eventTypeId))
      .get();
    if (!row) throw new ApiError(404, "Event type not found");
    return loadOpenSlots(mapEventType(row), data.from.slice(0, 10), data.to.slice(0, 10));
  });

/* ---------- Staff mutations ---------- */

export const upsertBookingAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        hostUserId: z.string().optional(),
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().min(4),
        endTime: z.string().min(4),
        timezone: z.string().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const hostUserId = data.hostUserId ?? user.id;
    if (!isAdminRoleKey(user.role) && hostUserId !== user.id) {
      throw new ApiError(403, "Not allowed");
    }
    const db = getDb();
    const now = nowIso();
    const timezone = data.timezone ?? resolveHostTimezone(hostUserId);

    if (data.id) {
      const current = db
        .select()
        .from(t.bookingAvailability)
        .where(eq(t.bookingAvailability.id, data.id))
        .get();
      if (!current || current.hostUserId !== hostUserId) {
        throw new ApiError(404, "Availability not found");
      }
      db.update(t.bookingAvailability)
        .set({
          weekday: data.weekday,
          startTime: data.startTime,
          endTime: data.endTime,
          timezone,
          isActive: data.isActive ?? true,
          updatedAt: now,
        })
        .where(eq(t.bookingAvailability.id, data.id))
        .run();
      return mapAvailability(
        db.select().from(t.bookingAvailability).where(eq(t.bookingAvailability.id, data.id)).get()!,
      );
    }

    const id = newId();
    db.insert(t.bookingAvailability)
      .values({
        id,
        hostUserId,
        weekday: data.weekday,
        startTime: data.startTime,
        endTime: data.endTime,
        timezone,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return mapAvailability(
      db.select().from(t.bookingAvailability).where(eq(t.bookingAvailability.id, id)).get()!,
    );
  });

export const replaceBookingAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        hostUserId: z.string().optional(),
        timezone: z.string().optional(),
        windows: z.array(
          z.object({
            weekday: z.number().int().min(0).max(6),
            startTime: z.string().min(4),
            endTime: z.string().min(4),
            isActive: z.boolean().optional(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const hostUserId = data.hostUserId ?? user.id;
    if (!isAdminRoleKey(user.role) && hostUserId !== user.id) {
      throw new ApiError(403, "Not allowed");
    }
    const db = getDb();
    const now = nowIso();
    const timezone = data.timezone ?? resolveHostTimezone(hostUserId);

    db.delete(t.bookingAvailability)
      .where(eq(t.bookingAvailability.hostUserId, hostUserId))
      .run();

    for (const win of data.windows) {
      db.insert(t.bookingAvailability)
        .values({
          id: newId(),
          hostUserId,
          weekday: win.weekday,
          startTime: win.startTime,
          endTime: win.endTime,
          timezone,
          isActive: win.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return db
      .select()
      .from(t.bookingAvailability)
      .where(eq(t.bookingAvailability.hostUserId, hostUserId))
      .all()
      .map(mapAvailability);
  });

export const deleteBookingAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.bookingAvailability)
      .where(eq(t.bookingAvailability.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Availability not found");
    if (!isAdminRoleKey(user.role) && row.hostUserId !== user.id) {
      throw new ApiError(403, "Not allowed");
    }
    db.delete(t.bookingAvailability).where(eq(t.bookingAvailability.id, data.id)).run();
    return { ok: true };
  });

export const createBookingBlock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        hostUserId: z.string().optional(),
        startsAt: z.string().min(10),
        endsAt: z.string().min(10),
        reason: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const hostUserId = data.hostUserId ?? user.id;
    if (!isAdminRoleKey(user.role) && hostUserId !== user.id) {
      throw new ApiError(403, "Not allowed");
    }
    if (data.endsAt <= data.startsAt) throw new ApiError(400, "End must be after start");
    const db = getDb();
    const now = nowIso();
    const id = newId();
    db.insert(t.bookingBlocks)
      .values({
        id,
        hostUserId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        reason: data.reason?.trim() || null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return mapBlock(db.select().from(t.bookingBlocks).where(eq(t.bookingBlocks.id, id)).get()!);
  });

export const deleteBookingBlock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db.select().from(t.bookingBlocks).where(eq(t.bookingBlocks.id, data.id)).get();
    if (!row) throw new ApiError(404, "Block not found");
    if (!isAdminRoleKey(user.role) && row.hostUserId !== user.id) {
      throw new ApiError(403, "Not allowed");
    }
    db.delete(t.bookingBlocks).where(eq(t.bookingBlocks.id, data.id)).run();
    return { ok: true };
  });

export const updateBookingAppointmentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        status: z.enum(["pending", "confirmed", "declined", "cancelled", "postponed", "completed"]),
        hostNote: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.bookingAppointments)
      .where(eq(t.bookingAppointments.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Appointment not found");
    assertCanManageAppointment(user, row);
    const now = nowIso();
    db.update(t.bookingAppointments)
      .set({
        status: data.status,
        hostNote: data.hostNote?.trim() ?? row.hostNote,
        updatedAt: now,
      })
      .where(eq(t.bookingAppointments.id, data.id))
      .run();
    return mapAppointment(
      db.select().from(t.bookingAppointments).where(eq(t.bookingAppointments.id, data.id)).get()!,
    );
  });

export const rescheduleBookingAppointment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        startsAt: z.string().min(10),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.bookingAppointments)
      .where(eq(t.bookingAppointments.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Appointment not found");
    assertCanManageAppointment(user, row);

    const eventRow = db
      .select()
      .from(t.bookingEventTypes)
      .where(eq(t.bookingEventTypes.id, row.eventTypeId))
      .get();
    if (!eventRow) throw new ApiError(404, "Event type not found");
    const event = mapEventType(eventRow);
    const startsAt = data.startsAt.slice(0, 19);
    const ymd = startsAt.slice(0, 10);

    // Temporarily ignore this appointment when checking busy
    const open = computeOpenSlots({
      fromYmd: ymd,
      toYmd: ymd,
      durationMinutes: event.durationMinutes,
      bufferBeforeMinutes: event.bufferBeforeMinutes,
      bufferAfterMinutes: event.bufferAfterMinutes,
      windows: db
        .select()
        .from(t.bookingAvailability)
        .where(
          and(
            eq(t.bookingAvailability.hostUserId, row.hostUserId),
            eq(t.bookingAvailability.isActive, true),
          ),
        )
        .all()
        .map(mapAvailability),
      busy: collectBusyRanges(row.hostUserId, ymd, ymd).filter(
        (b) => !(b.startsAt === row.startsAt && b.endsAt === row.endsAt),
      ),
    });
    const slot = open.find((s) => s.startsAt.slice(0, 19) === startsAt);
    if (!slot) throw new ApiError(400, "Selected slot is no longer available");

    const now = nowIso();
    db.update(t.bookingAppointments)
      .set({
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: row.status === "pending" ? "pending" : "confirmed",
        updatedAt: now,
      })
      .where(eq(t.bookingAppointments.id, data.id))
      .run();

    return mapAppointment(
      db.select().from(t.bookingAppointments).where(eq(t.bookingAppointments.id, data.id)).get()!,
    );
  });

export const getBookingSummaryForCompany = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    ensureDefaultEventType(data.companyId);
    const db = getDb();
    const now = nowIso();
    const appts = db
      .select()
      .from(t.bookingAppointments)
      .where(eq(t.bookingAppointments.companyId, data.companyId))
      .all()
      .map(mapAppointment);
    const pending = appts.filter((a) => a.status === "pending").length;
    const upcoming = appts.filter(
      (a) => a.status === "confirmed" && a.startsAt >= now.slice(0, 19),
    ).length;
    const eventTypes = db
      .select()
      .from(t.bookingEventTypes)
      .where(
        and(
          eq(t.bookingEventTypes.companyId, data.companyId),
          eq(t.bookingEventTypes.isActive, true),
        ),
      )
      .all()
      .map(mapEventType);
    return { pending, upcoming, eventTypes };
  });
