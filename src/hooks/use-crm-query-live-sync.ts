import { useEffect, useState } from "react";

import { syncCrmAccountQuery } from "@/lib/api";
import { useCrmAccountQueryStore } from "@/stores";
import type { CrmAccountQueryTypingUser } from "@/types/crm-account-query";

const POLL_MS = 2_500;

/** Polls for new messages and typing indicators while a query thread is open. */
export function useCrmQueryLiveSync(queryId: string | null, enabled: boolean) {
  const mergeQuery = useCrmAccountQueryStore((s) => s.mergeQuery);
  const [typingUsers, setTypingUsers] = useState<CrmAccountQueryTypingUser[]>([]);

  useEffect(() => {
    if (!queryId || !enabled) {
      setTypingUsers([]);
      return;
    }

    const activeQueryId = queryId;
    let cancelled = false;

    async function poll() {
      try {
        const current = useCrmAccountQueryStore.getState().getById(activeQueryId);
        const result = await syncCrmAccountQuery({
          data: {
            queryId: activeQueryId,
            updatedAt: current?.updatedAt,
            messageCount: current?.messages.length,
          },
        });
        if (cancelled) return;
        if (result.query) mergeQuery(result.query);
        setTypingUsers(result.typing);
      } catch {
        if (!cancelled) setTypingUsers([]);
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      setTypingUsers([]);
    };
  }, [enabled, mergeQuery, queryId]);

  return { typingUsers };
}
