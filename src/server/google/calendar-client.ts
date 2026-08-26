import { google } from "googleapis";

import { localWallClockIso } from "@/lib/booking-slots";
import {
  getAuthorizedGoogleClient,
  getGoogleCalendarConnection,
  meetRequestId,
} from "@/server/google/calendar-oauth";
import type { BusyRange } from "@/lib/booking-slots";

function wallToGoogleDateTime(wall: string, timeZone: string) {
  // wall: YYYY-MM-DDTHH:mm:ss (no offset) — send as local with explicit timeZone
  const dateTime = wall.length >= 19 ? wall.slice(0, 19) : `${wall.slice(0, 10)}T00:00:00`;
  return { dateTime, timeZone };
}

function googleInstantToWall(iso: string | null | undefined, timeZone: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return localWallClockIso(timeZone, d);
}

export async function fetchGoogleFreeBusyRanges(input: {
  hostUserId: string;
  fromYmd: string;
  toYmd: string;
  timeZone: string;
}): Promise<BusyRange[]> {
  const conn = getGoogleCalendarConnection(input.hostUserId);
  if (!conn?.syncEnabled) return [];

  const auth = await getAuthorizedGoogleClient(input.hostUserId);
  if (!auth) return [];

  const calendar = google.calendar({ version: "v3", auth: auth.client });
  // Widen UTC window so FreeBusy covers the host timezone day bounds.
  const timeMin = new Date(`${input.fromYmd}T00:00:00.000Z`);
  timeMin.setUTCDate(timeMin.getUTCDate() - 1);
  const timeMax = new Date(`${input.toYmd}T23:59:59.000Z`);
  timeMax.setUTCDate(timeMax.getUTCDate() + 1);

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: input.timeZone,
      items: [{ id: auth.connection.calendarId || "primary" }],
    },
  });

  const calId = auth.connection.calendarId || "primary";
  const busy = res.data.calendars?.[calId]?.busy ?? [];
  const out: BusyRange[] = [];
  for (const block of busy) {
    const startsAt = googleInstantToWall(block.start ?? undefined, input.timeZone);
    const endsAt = googleInstantToWall(block.end ?? undefined, input.timeZone);
    if (startsAt && endsAt) out.push({ startsAt, endsAt });
  }
  return out;
}

export type GoogleMeetEventResult = {
  eventId: string;
  meetUrl?: string;
};

export async function createGoogleMeetEvent(input: {
  hostUserId: string;
  appointmentId: string;
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  guestEmail: string;
  guestName?: string;
  guestEmails?: string[];
}): Promise<GoogleMeetEventResult | null> {
  const auth = await getAuthorizedGoogleClient(input.hostUserId);
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth: auth.client });
  const calendarId = auth.connection.calendarId || "primary";
  const attendeeEmails =
    input.guestEmails?.length && input.guestEmails.length > 0
      ? input.guestEmails
      : [input.guestEmail];
  const attendees = attendeeEmails.map((email) => ({
    email,
    displayName: email === input.guestEmail ? input.guestName : undefined,
  }));

  const res = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: wallToGoogleDateTime(input.startsAt, input.timeZone),
      end: wallToGoogleDateTime(input.endsAt, input.timeZone),
      attendees,
      conferenceData: {
        createRequest: {
          requestId: meetRequestId(`booking-${input.appointmentId}`),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const eventId = res.data.id;
  if (!eventId) throw new Error("Google Calendar did not return an event id");

  const meetUrl =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    undefined;

  return { eventId, meetUrl };
}

export async function updateGoogleMeetEvent(input: {
  hostUserId: string;
  eventId: string;
  summary?: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  guestEmail?: string;
  guestName?: string;
  guestEmails?: string[];
}): Promise<GoogleMeetEventResult | null> {
  const auth = await getAuthorizedGoogleClient(input.hostUserId);
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth: auth.client });
  const calendarId = auth.connection.calendarId || "primary";
  const attendeeEmails =
    input.guestEmails?.length && input.guestEmails.length > 0
      ? input.guestEmails
      : input.guestEmail
        ? [input.guestEmail]
        : [];

  const res = await calendar.events.patch({
    calendarId,
    eventId: input.eventId,
    sendUpdates: "all",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: wallToGoogleDateTime(input.startsAt, input.timeZone),
      end: wallToGoogleDateTime(input.endsAt, input.timeZone),
      ...(attendeeEmails.length
        ? {
            attendees: attendeeEmails.map((email) => ({
              email,
              displayName: email === input.guestEmail ? input.guestName : undefined,
            })),
          }
        : {}),
    },
  });

  const meetUrl =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    undefined;

  return { eventId: input.eventId, meetUrl };
}

export async function deleteGoogleMeetEvent(input: {
  hostUserId: string;
  eventId: string;
}): Promise<void> {
  const auth = await getAuthorizedGoogleClient(input.hostUserId);
  if (!auth) return;

  const calendar = google.calendar({ version: "v3", auth: auth.client });
  const calendarId = auth.connection.calendarId || "primary";

  try {
    await calendar.events.delete({
      calendarId,
      eventId: input.eventId,
      sendUpdates: "all",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Already deleted / not found — ignore
    if (/404|notFound|Resource has been deleted/i.test(msg)) return;
    throw err;
  }
}
