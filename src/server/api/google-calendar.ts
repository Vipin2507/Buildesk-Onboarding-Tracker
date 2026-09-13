import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ApiError, requireUser } from "@/server/auth/session";
import {
  buildGoogleCalendarAuthUrl,
  disconnectGoogleCalendar,
  exchangeGoogleCalendarCode,
  getGoogleCalendarStatus,
  isGoogleCalendarConfigured,
  googleCalendarRedirectUri,
  setGoogleCalendarSyncEnabled,
  verifyGoogleOAuthState,
} from "@/server/google/calendar-oauth";

export const getGoogleCalendarConnectionStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = requireUser();
    return getGoogleCalendarStatus(user.id);
  },
);

export const getGoogleCalendarAuthUrl = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ returnTo: z.enum(["crm", "erp"]).optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    if (!isGoogleCalendarConfigured() || !googleCalendarRedirectUri()) {
      throw new ApiError(
        400,
        "Google Calendar is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI (or APP_BASE_URL).",
      );
    }
    return { url: await buildGoogleCalendarAuthUrl(user.id, data?.returnTo ?? "crm") };
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

export const completeGoogleCalendarOAuth = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    if (data.error) {
      throw new ApiError(400, `Google authorization failed: ${data.error}`);
    }
    if (!data.code || !data.state) {
      throw new ApiError(400, "Missing Google OAuth code or state");
    }
    const verified = await verifyGoogleOAuthState(data.state);
    if (!verified || verified.userId !== user.id) {
      throw new ApiError(403, "Invalid or expired Google OAuth state");
    }
    await exchangeGoogleCalendarCode(data.code, user.id);
    return { ok: true as const, returnTo: verified.returnTo };
  });
