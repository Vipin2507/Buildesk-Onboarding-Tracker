import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { completeGoogleCalendarOAuth } from "@/server/api/google-calendar";

export const Route = createFileRoute("/auth/google/calendar/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    try {
      const result = await completeGoogleCalendarOAuth({
        data: {
          code: search.code,
          state: search.state,
          error: search.error,
        },
      });
      const returnTo = result.returnTo === "erp" ? "erp" : "crm";
      throw redirect({
        to: returnTo === "erp" ? "/meetings" : "/crm/bookings",
        search:
          returnTo === "erp"
            ? { tab: "calendar", google: "connected" }
            : { tab: "calendar", google: "connected" },
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

      let returnTo: "crm" | "erp" = "crm";
      if (search.state) {
        try {
          const raw = Buffer.from(search.state, "base64url").toString("utf8");
          const parts = raw.split(".");
          if (parts.length === 4 && parts[1] === "erp") returnTo = "erp";
        } catch {
          /* use default */
        }
      }

      throw redirect({
        to: returnTo === "erp" ? "/meetings" : "/crm/bookings",
        search:
          returnTo === "erp"
            ? { tab: "calendar", google: "error", googleError: message.slice(0, 200) }
            : { tab: "calendar", google: "error", googleError: message.slice(0, 200) },
        replace: true,
      });
    }
  },
  component: GoogleCalendarCallbackPage,
});

function GoogleCalendarCallbackPage() {
  return <AppLoadingScreen message="Connecting Google Calendar…" />;
}
