import { useEffect } from "react";

import { registerWebPushSubscription } from "@/lib/web-push-register";
import { isCrmUser } from "@/lib/product-scope";
import { useAuthStore } from "@/stores";

const AUTO_ATTEMPT_KEY = "buildesk-web-push-auto-attempted";

/** Prompt for / restore browser push when a CRM user enters the workspace after login. */
export function useAutoWebPushOnLogin() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user || !isCrmUser(user)) return;

    try {
      if (sessionStorage.getItem(AUTO_ATTEMPT_KEY) === user.id) return;
      sessionStorage.setItem(AUTO_ATTEMPT_KEY, user.id);
    } catch {
      /* continue without session guard */
    }

    void registerWebPushSubscription({ requestPermission: true }).catch((err) => {
      console.warn("[web-push] auto-register failed", err);
    });
  }, [user]);
}
