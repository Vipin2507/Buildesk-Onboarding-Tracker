import { useEffect } from "react";

import { listChatSessions } from "@/lib/api";
import { useChatStore } from "@/stores/useChatStore";

const POLL_MS = 3_000;

/** Keeps live chat sessions in sync for the internal support team. */
export function ChatBootstrap() {
  const syncSessionsFromServer = useChatStore((s) => s.syncSessionsFromServer);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const sessions = await listChatSessions();
        if (!cancelled) syncSessionsFromServer(sessions);
      } catch (e) {
        console.warn("[chat bootstrap]", e);
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [syncSessionsFromServer]);

  return null;
}
