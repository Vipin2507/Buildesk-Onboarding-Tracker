import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { isCrmUser } from "@/lib/product-scope";
import { useAuthStore } from "@/stores";
import { useChatStore } from "@/stores/useChatStore";

/** Shows pop-up alerts when chats need agent attention. */
export function ChatNotificationListener() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessions = useChatStore((s) => s.sessions);
  const activeInternalSessionId = useChatStore((s) => s.activeInternalSessionId);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const session of sessions) {
      if (session.status === "closed") continue;

      const last = session.messages[session.messages.length - 1];
      if (!last) continue;

      const notifyKey = `${session.id}:${last.id}`;
      if (seenRef.current.has(notifyKey)) continue;

      const isActiveView = activeInternalSessionId === session.id;
      const needsAgent =
        session.status === "waiting-for-agent" ||
        (last.senderType === "customer" && !last.isRead && !isActiveView);

      if (!needsAgent) continue;

      seenRef.current.add(notifyKey);

      toast(`Live chat · ${session.visitorName}`, {
        description: last.text.slice(0, 120),
        duration: 6000,
        action: {
          label: "Reply",
          onClick: () => {
            useChatStore.getState().setActiveInternalSession(session.id);
            void navigate({
              to: isCrmUser(user) ? "/crm/live-chat" : "/live-chat",
            });
          },
        },
      });
    }
  }, [sessions, activeInternalSessionId, navigate, user]);

  return null;
}
