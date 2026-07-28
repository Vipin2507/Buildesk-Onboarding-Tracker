import { useEffect } from "react";

import { listPortalChatSessions } from "@/lib/api";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { useChatStore } from "@/stores/useChatStore";

const POLL_MS = 3_000;

/** Polls chat session state for the client portal widget. */
export function PortalChatBootstrap({ access }: { access: CompanyPortalAccess }) {
  const syncSessionsFromServer = useChatStore((s) => s.syncSessionsFromServer);
  const setActivePortalSession = useChatStore((s) => s.setActivePortalSession);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const sessions = await listPortalChatSessions({
          data: { slug: access.slug, visitorName: access.contactName },
        });
        if (cancelled) return;
        syncSessionsFromServer(sessions);
        const open = sessions.find((s) => s.status !== "closed");
        if (open) setActivePortalSession(open.id);
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
  }, [access.slug, access.contactName, syncSessionsFromServer, setActivePortalSession]);

  return null;
}
