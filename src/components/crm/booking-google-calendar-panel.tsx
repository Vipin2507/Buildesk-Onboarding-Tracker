import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, ExternalLink, Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DesignTicketSection } from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  disconnectGoogleCalendarConnection,
  getGoogleCalendarAuthUrl,
  getGoogleCalendarConnectionStatus,
  setGoogleCalendarBusySync,
} from "@/lib/api";

type Status = {
  configured: boolean;
  connected: boolean;
  googleEmail?: string;
  calendarId?: string;
  syncEnabled: boolean;
  connectedAt?: string;
};

export function BookingGoogleCalendarPanel({
  flash,
  flashError,
}: {
  flash?: "connected" | "error" | null;
  flashError?: string | null;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getGoogleCalendarConnectionStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh().catch((e) =>
      toast.error(e instanceof Error ? e.message : "Failed to load Google Calendar status"),
    );
  }, [refresh]);

  useEffect(() => {
    if (flash === "connected") {
      toast.success("Google Calendar connected");
      void refresh();
    } else if (flash === "error" && flashError) {
      toast.error(flashError);
    }
  }, [flash, flashError, refresh]);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await getGoogleCalendarAuthUrl();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start Google connect");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const next = await disconnectGoogleCalendarConnection();
      setStatus(next);
      toast.success("Google Calendar disconnected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSync(syncEnabled: boolean) {
    setBusy(true);
    try {
      const next = await setGoogleCalendarBusySync({ data: { syncEnabled } });
      setStatus(next);
      toast.success(syncEnabled ? "Busy sync enabled" : "Busy sync paused");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update sync");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <DesignTicketSection compact title="Google Calendar & Meet">
        <p className="mb-2 text-[10px] text-muted-foreground">
          Connect your Google account so approved bookings create a Calendar event with a Meet link,
          and your Google busy times block open slots.
        </p>
      </DesignTicketSection>

      {!status ? (
        <div className="card-soft p-4 text-xs text-muted-foreground">Loading connection…</div>
      ) : !status.configured ? (
        <div className="card-soft space-y-2 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Server setup required</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Set <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code>,{" "}
                <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code>, and{" "}
                <code className="rounded bg-muted px-1">GOOGLE_REDIRECT_URI</code> (or{" "}
                <code className="rounded bg-muted px-1">APP_BASE_URL</code>) in the environment, then
                restart the app.
              </p>
            </div>
          </div>
        </div>
      ) : !status.connected ? (
        <div className="card-soft space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Connect Google Calendar</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                When you approve a booking, Buildesk creates a Google Calendar event with Meet and
                invites the guest. While connected, Google busy times are removed from bookable
                slots.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={busy}
            onClick={() => void connect()}
          >
            <Calendar className="h-3.5 w-3.5" />
            {busy ? "Redirecting…" : "Connect Google Calendar"}
          </Button>
        </div>
      ) : (
        <div className="card-soft space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">Connected</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{status.googleEmail}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Calendar: {status.calendarId || "primary"}
                  {status.connectedAt
                    ? ` · since ${status.connectedAt.slice(0, 10)}`
                    : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy}
                onClick={() => void connect()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reconnect
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => void disconnect()}
              >
                <Link2Off className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
            <div>
              <div className="font-medium">Sync Google busy times</div>
              <div className="text-[10px] text-muted-foreground">
                Hide slots that conflict with events on your Google Calendar
              </div>
            </div>
            <Switch
              size="sm"
              checked={status.syncEnabled}
              disabled={busy}
              onCheckedChange={(v) => void toggleSync(v)}
            />
          </label>

          <p className="text-[10px] text-muted-foreground">
            Approving a booking creates a Meet link and emails the guest. Cancel / decline removes
            the calendar event.
          </p>
        </div>
      )}

      <div className="card-soft p-3 text-[10px] text-muted-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <ExternalLink className="h-3 w-3" />
          How it works
        </div>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Guest books a pending slot in the portal.</li>
          <li>You approve in CRM Bookings → Google creates the event + Meet.</li>
          <li>Guest receives the Meet link in the status email (and on their portal).</li>
        </ol>
      </div>
    </div>
  );
}
