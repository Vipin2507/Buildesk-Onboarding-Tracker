import { BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWebPush } from "@/hooks/use-web-push";

export function WebPushDevicePanel() {
  const {
    supported,
    configured,
    permission,
    subscribed,
    deviceCount,
    loading,
    enable,
    disable,
  } = useWebPush();

  async function onEnable() {
    try {
      await enable();
      toast.success("Browser notifications enabled for this device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enable notifications");
    }
  }

  async function onDisable() {
    try {
      await disable();
      toast.success("Browser notifications disabled on this device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disable notifications");
    }
  }

  if (!supported) {
    return (
      <p className="text-[11px] text-muted-foreground">
        This browser does not support web push notifications.
      </p>
    );
  }

  if (!configured) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Web push is not configured on the server yet. Ask an administrator to set VAPID keys in the
        environment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border px-3 py-2 text-xs">
        <div className="font-medium">This browser</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          Permission:{" "}
          <span className="font-medium text-foreground">
            {permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked" : "Not asked"}
          </span>
          {subscribed ? (
            <>
              {" "}
              · {deviceCount} registered device{deviceCount === 1 ? "" : "s"}
            </>
          ) : null}
        </div>
        {permission === "denied" ? (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Notifications are blocked in your browser settings. Unblock them for this site, then try
            again.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {!subscribed ? (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={loading || permission === "denied"}
            onClick={() => void onEnable()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
            Enable on this browser
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={loading}
            onClick={() => void onDisable()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellOff className="h-3.5 w-3.5" />}
            Disable on this browser
          </Button>
        )}
      </div>
    </div>
  );
}
