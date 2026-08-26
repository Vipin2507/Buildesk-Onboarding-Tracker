import { useCallback, useEffect, useState } from "react";

import {
  getWebPushConfig,
  getWebPushSubscriptionStatus,
  subscribeWebPush,
  unsubscribeWebPush,
} from "@/lib/api";
import {
  isWebPushSupported,
  pushSubscriptionToJson,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from "@/lib/web-push-client";

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
    if (!isWebPushSupported()) {
      throw new Error("This browser does not support web push notifications");
    }

    const config = await getWebPushConfig();
    if (!config.configured || !config.publicKey) {
      throw new Error("Web push is not configured on the server");
    }

    const permission = await Notification.requestPermission();
    setState((s) => ({ ...s, permission }));
    if (permission !== "granted") {
      throw new Error("Notification permission was denied");
    }

    const subscription = await subscribeBrowserPush(config.publicKey);
    if (!subscription) {
      throw new Error("Could not subscribe this browser for push notifications");
    }

    await subscribeWebPush({
      data: {
        subscription: pushSubscriptionToJson(subscription),
        userAgent: navigator.userAgent,
      },
    });

    await refresh();
  }, [refresh]);

  const disable = useCallback(async () => {
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
