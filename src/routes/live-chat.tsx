import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Send, Ticket } from "lucide-react";

import { ChatThread } from "@/components/chat/chat-thread";
import { PageHeader, PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { useChatStore, useCompanyStore, useCurrentUser } from "@/stores";
import type { ChatSession, ChatSessionStatus } from "@/types/chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live-chat")({
  component: LiveChatPage,
});

const STATUS_LABEL: Record<ChatSessionStatus, string> = {
  "bot-handling": "Bot handling",
  "waiting-for-agent": "Waiting for agent",
  "agent-active": "Agent active",
  closed: "Closed",
};

const STATUS_TONE = {
  "bot-handling": "muted",
  "waiting-for-agent": "warning",
  "agent-active": "success",
  closed: "muted",
} as const;

function LiveChatPage() {
  const currentUser = useCurrentUser();
  const { isAdmin, can } = usePermissions();
  const canAccess = isAdmin || can("manageTickets");

  const sessions = useChatStore((s) => s.sessions);
  const activeId = useChatStore((s) => s.activeInternalSessionId);
  const setActive = useChatStore((s) => s.setActiveInternalSession);
  const sendAgentMessage = useChatStore((s) => s.sendAgentMessage);
  const claimSession = useChatStore((s) => s.claimSession);
  const convertToTicket = useChatStore((s) => s.convertToTicket);
  const closeSession = useChatStore((s) => s.closeSession);
  const markSessionRead = useChatStore((s) => s.markSessionRead);
  const companies = useCompanyStore((s) => s.companies);

  const [draft, setDraft] = useState("");

  const sorted = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.status !== "closed")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions],
  );

  const active = sessions.find((s) => s.id === activeId) ?? sorted[0];
  const activeUnreadCustomer =
    active?.messages.filter((m) => m.senderType === "customer" && !m.isRead).length ?? 0;

  useEffect(() => {
    if (active && activeId !== active.id) setActive(active.id);
  }, [active, activeId, setActive]);

  useEffect(() => {
    if (active?.id && activeUnreadCustomer > 0) {
      markSessionRead(active.id, "agent");
    }
  }, [active?.id, activeUnreadCustomer, markSessionRead]);

  if (!canAccess) {
    return (
      <PageWrap>
        <PageHeader title="Live Chat" subtitle="Support team access required." />
      </PageWrap>
    );
  }

  function sendReply() {
    if (!active || !currentUser || !draft.trim()) return;
    if (active.status === "waiting-for-agent") {
      claimSession(active.id, currentUser.id, currentUser.name);
    }
    sendAgentMessage(active.id, currentUser.id, currentUser.name, draft);
    setDraft("");
  }

  return (
    <PageWrap>
      <PageHeader
        title="Live Chat"
        subtitle="Bot-to-human handover — shared with the client portal widget."
      />

      <div className="grid min-h-[60vh] gap-3 lg:grid-cols-[minmax(240px,300px)_1fr]">
        <div className="card-soft flex max-h-[70vh] flex-col overflow-hidden p-0">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sessions ({sorted.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No active chat sessions.</p>
            ) : (
              sorted.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  companyName={companies.find((c) => c.id === s.companyId)?.name}
                  active={active?.id === s.id}
                  onClick={() => setActive(s.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="card-soft flex max-h-[70vh] flex-col overflow-hidden">
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <div className="font-semibold">{active.visitorName}</div>
                  <div className="text-xs text-muted-foreground">
                    {companies.find((c) => c.id === active.companyId)?.name ?? "Unknown visitor"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={STATUS_TONE[active.status]}>{STATUS_LABEL[active.status]}</Pill>
                  {active.linkedTicketId ? (
                    <Link to="/support/$ticketId" params={{ ticketId: active.linkedTicketId }} className="text-xs text-primary hover:underline">
                      Ticket {active.linkedTicketId}
                    </Link>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => convertToTicket(active.id)}>
                      <Ticket className="h-3.5 w-3.5" /> Convert
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => closeSession(active.id)}>
                    Close
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ChatThread messages={active.messages} />
              </div>
              <div className="flex gap-2 border-t p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply as agent…"
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                />
                <Button onClick={sendReply} className="gap-1 bg-primary">
                  <Send className="h-4 w-4" /> Send
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a session to reply
            </div>
          )}
        </div>
      </div>
    </PageWrap>
  );
}

function SessionRow({
  session,
  companyName,
  active,
  onClick,
}: {
  session: ChatSession;
  companyName?: string;
  active: boolean;
  onClick: () => void;
}) {
  const last = session.messages[session.messages.length - 1];
  const unread = session.messages.some((m) => m.senderType === "customer" && !m.isRead);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
        active && "bg-primary/5",
        unread && "font-medium",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm">{session.visitorName}</span>
        {unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
      </div>
      <div className="truncate text-xs text-muted-foreground">{companyName ?? "Portal visitor"}</div>
      {last ? <div className="line-clamp-1 text-xs text-muted-foreground">{last.text}</div> : null}
      <Pill tone={STATUS_TONE[session.status]} className="mt-1 w-fit">
        {STATUS_LABEL[session.status]}
      </Pill>
    </motion.button>
  );
}
