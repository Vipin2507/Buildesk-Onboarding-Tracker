import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ApiError, requireUser } from "@/server/auth/session";
import {
  buildGoogleCalendarAuthUrl,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  isGoogleCalendarConfigured,
  googleCalendarRedirectUri,
  setGoogleCalendarSyncEnabled,
} from "@/server/google/calendar-oauth";

export const getGoogleCalendarConnectionStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = requireUser();
    return getGoogleCalendarStatus(user.id);
  },
);

export const getGoogleCalendarAuthUrl = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireUser();
  if (!isGoogleCalendarConfigured() || !googleCalendarRedirectUri()) {
    throw new ApiError(
      400,
      "Google Calendar is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI (or APP_BASE_URL).",
    );
  }
  return { url: buildGoogleCalendarAuthUrl(user.id) };
});

export const disconnectGoogleCalendarConnection = createServerFn({ method: "POST" }).handler(
  async () => {
    const user = requireUser();
    disconnectGoogleCalendar(user.id);
    return getGoogleCalendarStatus(user.id);
  },
);

export const setGoogleCalendarBusySync = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ syncEnabled: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    try {
      return setGoogleCalendarSyncEnabled(user.id, data.syncEnabled);
    } catch (e) {
      throw new ApiError(400, e instanceof Error ? e.message : "Not connected");
    }
  });
