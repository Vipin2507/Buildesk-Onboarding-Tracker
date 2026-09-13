import { eq } from "drizzle-orm";

import { resolveHostTimezone } from "@/lib/booking-host";
import { localWallClockIso } from "@/lib/booking-slots";
import { isAdminRoleKey } from "@/lib/permissions";
import { ERP_MEETING_TYPE_LABELS } from "@/types/erp-meeting";
import { nowIso } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  createGoogleMeetEvent,
  deleteGoogleMeetEvent,
  updateGoogleMeetEvent,
} from "@/server/google/calendar-client";
import { getGoogleCalendarConnection } from "@/server/google/calendar-oauth";

type ActingUser = { id: string; role: string; name: string };
type MeetingRow = typeof t.erpMeetings.$inferSelect;

export function erpMeetingShouldSync(row: Pick<MeetingRow, "format" | "status">) {
  return row.format === "online" && (row.status === "scheduled" || row.status === "postponed");
}

export function erpMeetingShouldDeleteFromGoogle(row: Pick<MeetingRow, "status">) {
  return row.status === "cancelled" || row.status === "no_show";
}

function resolveGoogleCalendarUserId(meeting: MeetingRow, actingUser: ActingUser) {
  const hostId = meeting.hostUserId?.trim();
  if (hostId && getGoogleCalendarConnection(hostId)) return hostId;
  if (getGoogleCalendarConnection(actingUser.id)) {
    if (actingUser.id === hostId || !hostId) return actingUser.id;
    if (isAdminRoleKey(actingUser.role)) return actingUser.id;
  }
  return hostId && getGoogleCalendarConnection(hostId) ? hostId : null;
}

function googleCalendarSyncErrorMessage(
  meeting: MeetingRow,
  actingUser: ActingUser,
  hostName?: string,
): string {
  const hostLabel = hostName?.trim() || "The assigned host";
  if (actingUser.id === meeting.hostUserId) {
    return "Connect Google Calendar under ERP → Meetings → Calendar, then retry sync.";
  }
  if (isAdminRoleKey(actingUser.role)) {
    return `${hostLabel} has not connected Google Calendar. Connect your Google account under ERP → Meetings → Calendar, then retry sync.`;
  }
  return `${hostLabel} must connect Google Calendar under ERP → Meetings → Calendar.`;
}

function toWallRange(startsAt: string, endsAt: string | null | undefined, timeZone: string) {
  const startDate = new Date(startsAt);
  const endDate = endsAt
    ? new Date(endsAt)
    : new Date(startDate.getTime() + 60 * 60 * 1000);
  if (!Number.isFinite(startDate.getTime())) {
    throw new Error("Invalid meeting start time");
  }
  if (!Number.isFinite(endDate.getTime())) {
    throw new Error("Invalid meeting end time");
  }
  return {
    startsAt: localWallClockIso(timeZone, startDate).slice(0, 19),
    endsAt: localWallClockIso(timeZone, endDate).slice(0, 19),
  };
}

export async function syncGoogleCalendarForErpMeeting(
  meeting: MeetingRow,
  action: "upsert" | "delete",
  actingUser: ActingUser,
) {
  const db = getDb();
  const hostUser = meeting.hostUserId
    ? db.select().from(t.users).where(eq(t.users.id, meeting.hostUserId)).get()
    : undefined;
  const calendarUserId = resolveGoogleCalendarUserId(meeting, actingUser);
  const timeZone = resolveHostTimezone(meeting.hostUserId ?? actingUser.id);
  const company = db.select().from(t.companies).where(eq(t.companies.id, meeting.companyId)).get();
  const typeLabel = ERP_MEETING_TYPE_LABELS[meeting.meetingType as keyof typeof ERP_MEETING_TYPE_LABELS] ?? "Meeting";
  const summary = `${meeting.title} · ${company?.name ?? "Company"} · ${typeLabel}`;
  const guestLine = meeting.attendeeEmail
    ? meeting.attendeeName
      ? `Guest: ${meeting.attendeeName} (${meeting.attendeeEmail})`
      : `Guest: ${meeting.attendeeEmail}`
    : meeting.attendeeName
      ? `Guest: ${meeting.attendeeName}`
      : null;
  const description = [
    guestLine,
    meeting.notes ? `Notes: ${meeting.notes}` : null,
    `Buildesk ERP meeting: ${meeting.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    if (action === "delete") {
      if (meeting.googleEventId && calendarUserId) {
        await deleteGoogleMeetEvent({
          hostUserId: calendarUserId,
          eventId: meeting.googleEventId,
        });
      }
      db.update(t.erpMeetings)
        .set({
          googleEventId: null,
          meetUrl: null,
          googleSyncStatus: "none",
          googleSyncError: null,
          updatedAt: nowIso(),
        })
        .where(eq(t.erpMeetings.id, meeting.id))
        .run();
      return;
    }

    if (!erpMeetingShouldSync(meeting)) {
      if (erpMeetingShouldDeleteFromGoogle(meeting) && meeting.googleEventId) {
        await syncGoogleCalendarForErpMeeting(meeting, "delete", actingUser);
      }
      return;
    }

    if (!calendarUserId) {
      const message = googleCalendarSyncErrorMessage(meeting, actingUser, hostUser?.name);
      db.update(t.erpMeetings)
        .set({
          googleSyncStatus: "error",
          googleSyncError: message.slice(0, 500),
          updatedAt: nowIso(),
        })
        .where(eq(t.erpMeetings.id, meeting.id))
        .run();
      return;
    }

    const wall = toWallRange(meeting.startsAt, meeting.endsAt, timeZone);
    const guestEmail = meeting.attendeeEmail?.trim() || undefined;
    const guestEmails = guestEmail ? [guestEmail] : undefined;

    if (meeting.googleEventId) {
      const updated = await updateGoogleMeetEvent({
        hostUserId: calendarUserId,
        eventId: meeting.googleEventId,
        summary,
        description,
        startsAt: wall.startsAt,
        endsAt: wall.endsAt,
        timeZone,
        guestEmail,
        guestName: meeting.attendeeName ?? undefined,
        guestEmails,
      });
      db.update(t.erpMeetings)
        .set({
          meetUrl: updated?.meetUrl ?? meeting.meetUrl,
          meetingLink: updated?.meetUrl ?? meeting.meetingLink,
          googleSyncStatus: "synced",
          googleSyncError: null,
          updatedAt: nowIso(),
        })
        .where(eq(t.erpMeetings.id, meeting.id))
        .run();
      return;
    }

    const created = await createGoogleMeetEvent({
      hostUserId: calendarUserId,
      appointmentId: meeting.id,
      summary,
      description,
      startsAt: wall.startsAt,
      endsAt: wall.endsAt,
      timeZone,
      guestEmail: guestEmail ?? hostUser?.workEmail ?? hostUser?.email,
      guestName: meeting.attendeeName ?? undefined,
      guestEmails,
      includeMeet: true,
    });
    if (!created) {
      db.update(t.erpMeetings)
        .set({
          googleSyncStatus: "error",
          googleSyncError:
            "Google Calendar authorization failed. Reconnect under ERP → Meetings → Calendar.",
          updatedAt: nowIso(),
        })
        .where(eq(t.erpMeetings.id, meeting.id))
        .run();
      return;
    }
    db.update(t.erpMeetings)
      .set({
        googleEventId: created.eventId,
        meetUrl: created.meetUrl ?? null,
        meetingLink: created.meetUrl ?? meeting.meetingLink,
        googleSyncStatus: "synced",
        googleSyncError: null,
        updatedAt: nowIso(),
      })
      .where(eq(t.erpMeetings.id, meeting.id))
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Calendar sync failed";
    console.warn("[erp-meeting] Google Calendar sync error:", message);
    db.update(t.erpMeetings)
      .set({
        googleSyncStatus: "error",
        googleSyncError: message.slice(0, 500),
        updatedAt: nowIso(),
      })
      .where(eq(t.erpMeetings.id, meeting.id))
      .run();
  }
}
