import {
  getWebPushConfig,
  getWebPushSubscriptionStatus,
  subscribeWebPush,
} from "@/lib/api";
import {
  isWebPushSupported,
  pushSubscriptionToJson,
  registerServiceWorker,
  subscribeBrowserPush,
} from "@/lib/web-push-client";

const WEB_PUSH_OPT_OUT_KEY = "buildesk-web-push-opt-out";

export function isWebPushOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(WEB_PUSH_OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setWebPushOptedOut(optedOut: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (optedOut) localStorage.setItem(WEB_PUSH_OPT_OUT_KEY, "1");
    else localStorage.removeItem(WEB_PUSH_OPT_OUT_KEY);
  } catch {
    /* ignore */
  }
}

export type WebPushRegisterResult =
  | "subscribed"
  | "already-subscribed"
  | "not-supported"
  | "not-configured"
  | "denied"
  | "opted-out"
  | "failed";

/** Register this browser for push — optionally prompts for permission when still default. */
export async function registerWebPushSubscription(options?: {
  requestPermission?: boolean;
}): Promise<WebPushRegisterResult> {
  if (!isWebPushSupported()) return "not-supported";
  if (isWebPushOptedOut()) return "opted-out";

  const config = await getWebPushConfig();
  if (!config.configured || !config.publicKey) return "not-configured";

  let permission = Notification.permission;
  if (permission === "denied") return "denied";

  if (permission === "default") {
    if (options?.requestPermission === false) return "denied";
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return "denied";

  await registerServiceWorker();

  const registration = await navigator.serviceWorker.getRegistration("/");
  const existing = await registration?.pushManager.getSubscription();
  const status = await getWebPushSubscriptionStatus();

  if (status.subscribed && existing) {
    await subscribeWebPush({
      data: {
        subscription: pushSubscriptionToJson(existing),
        userAgent: navigator.userAgent,
      },
    });
    return "already-subscribed";
  }

  const subscription = await subscribeBrowserPush(config.publicKey);
  if (!subscription) return "failed";

  await subscribeWebPush({
    data: {
      subscription: pushSubscriptionToJson(subscription),
      userAgent: navigator.userAgent,
    },
  });

  return "subscribed";
}
