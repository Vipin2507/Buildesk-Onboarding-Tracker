import { useEffect } from "react";

import { getPortalChatSession } from "@/lib/api";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { useChatStore } from "@/stores/useChatStore";

const POLL_MS = 3_000;

/** Polls chat session state for the client portal widget. */
export function PortalChatBootstrap({ access }: { access: CompanyPortalAccess }) {
  const mergeSession = useChatStore((s) => s.mergeSession);
  const setActivePortalSession = useChatStore((s) => s.setActivePortalSession);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const session = await getPortalChatSession({
          data: { slug: access.slug, visitorName: access.contactName },
        });
        if (cancelled || !session) return;
        mergeSession(session);
        setActivePortalSession(session.id);
      } catch (e) {
        console.warn("[portal chat bootstrap]", e);
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [access.slug, access.contactName, mergeSession, setActivePortalSession]);

  return null;
}
