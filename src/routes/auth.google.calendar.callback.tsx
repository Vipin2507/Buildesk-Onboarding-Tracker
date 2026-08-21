import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { ApiError, requireUser } from "@/server/auth/session";
import {
  exchangeGoogleCalendarCode,
  verifyGoogleOAuthState,
} from "@/server/google/calendar-oauth";

const completeGoogleCalendarOAuth = createServerFn({ method: "GET" })
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
    const stateUserId = verifyGoogleOAuthState(data.state);
    if (!stateUserId || stateUserId !== user.id) {
      throw new ApiError(403, "Invalid or expired Google OAuth state");
    }
    await exchangeGoogleCalendarCode(data.code, user.id);
    return { ok: true as const };
  });

export const Route = createFileRoute("/auth/google/calendar/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    try {
      await completeGoogleCalendarOAuth({
        data: {
          code: search.code,
          state: search.state,
          error: search.error,
        },
      });
      throw redirect({
        to: "/crm/bookings",
        search: { tab: "calendar", google: "connected" },
        replace: true,
      });
    } catch (e) {
      if (isRedirect(e)) throw e;
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object" &&
              e &&
              "message" in e &&
              typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "Google Calendar connection failed";
      throw redirect({
        to: "/crm/bookings",
        search: { tab: "calendar", google: "error", googleError: message.slice(0, 200) },
        replace: true,
      });
    }
  },
  component: GoogleCalendarCallbackPage,
});

function GoogleCalendarCallbackPage() {
  return <AppLoadingScreen message="Connecting Google Calendar…" />;
}
