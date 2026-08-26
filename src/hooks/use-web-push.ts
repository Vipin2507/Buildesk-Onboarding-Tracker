import { useCallback, useEffect, useState } from "react";

import { getWebPushConfig, getWebPushSubscriptionStatus, unsubscribeWebPush } from "@/lib/api";
import {
  isWebPushSupported,
  unsubscribeBrowserPush,
} from "@/lib/web-push-client";
import { registerWebPushSubscription, setWebPushOptedOut } from "@/lib/web-push-register";

type WebPushState = {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  deviceCount: number;
  loading: boolean;
};

export function useWebPush() {
  const [state, setState] = useState<WebPushState>({
    supported: isWebPushSupported(),
    configured: false,
    permission:
      typeof Notification !== "undefined" ? Notification.permission : "unsupported",
    subscribed: false,
    deviceCount: 0,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!isWebPushSupported()) {
      setState((s) => ({
        ...s,
        supported: false,
        loading: false,
        permission: "unsupported",
      }));
      return;
    }

    setState((s) => ({ ...s, loading: true }));
    try {
      const [config, status] = await Promise.all([
        getWebPushConfig(),
        getWebPushSubscriptionStatus(),
      ]);
      setState({
        supported: true,
        configured: config.configured,
        permission: Notification.permission,
        subscribed: status.subscribed,
        deviceCount: status.deviceCount,
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setWebPushOptedOut(false);
    const result = await registerWebPushSubscription({ requestPermission: true });
    if (result === "not-supported") {
      throw new Error("This browser does not support web push notifications");
    }
    if (result === "not-configured") {
      throw new Error("Web push is not configured on the server");
    }
    if (result === "denied") {
      throw new Error("Notification permission was denied");
    }
    if (result === "failed") {
      throw new Error("Could not subscribe this browser for push notifications");
    }
    await refresh();
  }, [refresh]);

  const disable = useCallback(async () => {
    setWebPushOptedOut(true);
    await unsubscribeBrowserPush();
    await unsubscribeWebPush({ data: {} });
    await refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
    enable,
    disable,
  };
}
