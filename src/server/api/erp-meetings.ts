import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { roleHasPermission } from "@/lib/permissions";
import { loadServerRoles } from "@/server/auth/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { logActivity } from "@/server/api/mappers";
import {
  erpMeetingShouldDeleteFromGoogle,
  erpMeetingShouldSync,
  syncGoogleCalendarForErpMeeting,
} from "@/server/lib/erp-meeting-google-sync";
import type { ErpMeeting } from "@/types";

function assertCanManageErpMeetings(user: ReturnType<typeof requireUser>) {
  if (user.role === "Admin") return;
  const roles = loadServerRoles();
  if (roleHasPermission(roles, user.role, "manageErpMeetings")) return;
  throw new ApiError(403, "You do not have permission for this action");
}

function mapMeeting(row: typeof t.erpMeetings.$inferSelect): ErpMeeting {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt ?? undefined,
    status: row.status as ErpMeeting["status"],
    meetingType: row.meetingType as ErpMeeting["meetingType"],
    format: row.format as ErpMeeting["format"],
    hostUserId: row.hostUserId ?? undefined,
    attendeeName: row.attendeeName ?? undefined,
    attendeeEmail: row.attendeeEmail ?? undefined,
    location: row.location ?? undefined,
    meetingLink: row.meetingLink ?? undefined,
    notes: row.notes ?? undefined,
    outcome: row.outcome ?? undefined,
    createdByUserId: row.createdByUserId ?? undefined,
    googleEventId: row.googleEventId ?? undefined,
    meetUrl: row.meetUrl ?? undefined,
    googleSyncStatus: (row.googleSyncStatus as ErpMeeting["googleSyncStatus"]) ?? "none",
    googleSyncError: row.googleSyncError ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertErpCompany(companyId: string) {
  const company = getDb().select().from(t.companies).where(eq(t.companies.id, companyId)).get();
  if (!company) throw new ApiError(404, "Company not found");
}

const meetingInput = z.object({
  id: z.string().optional(),
  companyId: z.string(),
  title: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled", "postponed", "no_show"]).default("scheduled"),
  meetingType: z.enum(["kickoff", "training", "review", "demo", "check_in", "other"]).default("other"),
  format: z.enum(["online", "in_person", "phone"]).default("online"),
  hostUserId: z.string().optional().nullable(),
  attendeeName: z.string().optional().nullable(),
  attendeeEmail: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  meetingLink: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
});

async function applyGoogleSyncAfterChange(
  row: typeof t.erpMeetings.$inferSelect,
  previousStatus: string | undefined,
  actingUser: ReturnType<typeof requireUser>,
) {
  if (erpMeetingShouldDeleteFromGoogle(row)) {
    await syncGoogleCalendarForErpMeeting(row, "delete", actingUser);
    return;
  }
  if (erpMeetingShouldSync(row)) {
    await syncGoogleCalendarForErpMeeting(row, "upsert", actingUser);
    return;
  }
  if (
    previousStatus &&
    erpMeetingShouldDeleteFromGoogle({ status: previousStatus as ErpMeeting["status"] }) === false &&
    row.googleEventId &&
    !erpMeetingShouldSync(row)
  ) {
    await syncGoogleCalendarForErpMeeting(row, "delete", actingUser);
  }
}

export const listErpMeetings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().optional(),
        status: z.string().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    let rows = db.select().from(t.erpMeetings).orderBy(desc(t.erpMeetings.startsAt)).all();
    if (data?.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data?.status) rows = rows.filter((r) => r.status === data.status);
    return rows.map(mapMeeting);
  });

export const getErpMeeting = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const row = getDb().select().from(t.erpMeetings).where(eq(t.erpMeetings.id, data.id)).get();
    if (!row) throw new ApiError(404, "Meeting not found");
    return mapMeeting(row);
  });

export const createErpMeeting = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => meetingInput.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageErpMeetings(user);
    assertErpCompany(data.companyId);
    const db = getDb();
    const id = data.id ?? newId();
    const now = nowIso();
    db.insert(t.erpMeetings)
      .values({
        id,
        companyId: data.companyId,
        title: data.title,
        startsAt: data.startsAt,
        endsAt: data.endsAt ?? null,
        status: data.status,
        meetingType: data.meetingType,
        format: data.format,
        hostUserId: data.hostUserId ?? user.id,
        attendeeName: data.attendeeName ?? null,
        attendeeEmail: data.attendeeEmail ?? null,
        location: data.location ?? null,
        meetingLink: data.meetingLink ?? null,
        notes: data.notes ?? null,
        outcome: data.outcome ?? null,
        createdByUserId: user.id,
        googleSyncStatus: "none",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    logActivity({
      who: user.name,
      what: `Scheduled ERP meeting: ${data.title}`,
      kind: "info",
      companyId: data.companyId,
    });
    let row = db.select().from(t.erpMeetings).where(eq(t.erpMeetings.id, id)).get()!;
    await applyGoogleSyncAfterChange(row, undefined, user);
    row = db.select().from(t.erpMeetings).where(eq(t.erpMeetings.id, id)).get()!;
    return mapMeeting(row);
  });

export const updateErpMeeting = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), patch: meetingInput.partial() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageErpMeetings(user);
    const db = getDb();
    const existing = db.select().from(t.erpMeetings).where(eq(t.erpMeetings.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Meeting not found");
    const p = data.patch;
    if (p.companyId) assertErpCompany(p.companyId);
    const previousStatus = existing.status;
    db.update(t.erpMeetings)
      .set({
        companyId: p.companyId ?? existing.companyId,
        title: p.title ?? existing.title,
        startsAt: p.startsAt ?? existing.startsAt,
        endsAt: p.endsAt !== undefined ? p.endsAt : existing.endsAt,
        status: p.status ?? existing.status,
        meetingType: p.meetingType ?? existing.meetingType,
        format: p.format ?? existing.format,
        hostUserId: p.hostUserId !== undefined ? p.hostUserId : existing.hostUserId,
        attendeeName: p.attendeeName !== undefined ? p.attendeeName : existing.attendeeName,
        attendeeEmail: p.attendeeEmail !== undefined ? p.attendeeEmail : existing.attendeeEmail,
        location: p.location !== undefined ? p.location : existing.location,
        meetingLink: p.meetingLink !== undefined ? p.meetingLink : existing.meetingLink,
        notes: p.notes !== undefined ? p.notes : existing.notes,
        outcome: p.outcome !== undefined ? p.outcome : existing.outcome,
        updatedAt: nowIso(),
      })
      .where(eq(t.erpMeetings.id, data.id))
      .run();
    logActivity({
      who: user.name,
      what: `Updated ERP meeting: ${p.title ?? existing.title}`,
      kind: "info",
      companyId: p.companyId ?? existing.companyId,
    });
    let row = db.select().from(t.erpMeetings).where(eq(t.erpMeetings.id, data.id)).get()!;
    await applyGoogleSyncAfterChange(row, previousStatus, user);
    row = db.select().from(t.erpMeetings).where(eq(t.erpMeetings.id, data.id)).get()!;
    return mapMeeting(row);
  });

export const retryErpMeetingGoogleCalendarSync = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageErpMeetings(user);
    const db = getDb();
    const row = db.select().from(t.erpMeetings).where(eq(t.erpMeetings.id, data.id)).get();
    if (!row) throw new ApiError(404, "Meeting not found");
    if (!erpMeetingShouldSync(row)) {
      throw new ApiError(400, "Only scheduled or postponed online meetings can be synced to Google Calendar");
    }
    await syncGoogleCalendarForErpMeeting(row, "upsert", user);
    return mapMeeting(db.select().from(t.erpMeetings).where(eq(t.erpMeetings.id, data.id)).get()!);
  });
