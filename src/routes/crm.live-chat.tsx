import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History } from "lucide-react";

import { ChatThread } from "@/components/chat/chat-thread";
import {
  DesignTicketPageHeader,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isCrmChatCompany } from "@/lib/crm-tickets";
import { cn, formatDate } from "@/lib/utils";
import { useChatStore, useCrmAccountStore, useCurrentUser } from "@/stores";
import type { ChatSession, ChatSessionStatus } from "@/types/chat";

export const Route = createFileRoute("/crm/live-chat")({
  component: CrmLiveChatPage,
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

type SessionTab = "active" | "history";

function CrmLiveChatPage() {
  const currentUser = useCurrentUser();
  const sessions = useChatStore((s) => s.sessions);
  const activeId = useChatStore((s) => s.activeInternalSessionId);
  const setActive = useChatStore((s) => s.setActiveInternalSession);
  const sendAgentMessage = useChatStore((s) => s.sendAgentMessage);
  const claimSession = useChatStore((s) => s.claimSession);
  const convertToTicket = useChatStore((s) => s.convertToTicket);
  const closeSession = useChatStore((s) => s.closeSession);
  const markSessionRead = useChatStore((s) => s.markSessionRead);
  const accounts = useCrmAccountStore((s) => s.accounts);

  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<SessionTab>("active");

  const crmSessions = useMemo(
    () => sessions.filter((s) => isCrmChatCompany(s.companyId)),
    [sessions],
  );

  const activeSessions = useMemo(
    () => crmSessions.filter((s) => s.status !== "closed"),
    [crmSessions],
  );
  const historySessions = useMemo(
    () => crmSessions.filter((s) => s.status === "closed"),
    [crmSessions],
  );

  const sorted = useMemo(
    () =>
      [...(tab === "active" ? activeSessions : historySessions)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [tab, activeSessions, historySessions],
  );

  const active = crmSessions.find((s) => s.id === activeId) ?? sorted[0];
  const isReadOnly = active?.status === "closed";
  const activeUnreadCustomer =
    active?.messages.filter((m) => m.senderType === "customer" && !m.isRead).length ?? 0;

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id?: string) => (id ? map.get(id) : undefined) ?? "Unlinked visitor";
  }, [accounts]);

  useEffect(() => {
    if (!sorted.length) return;
    const current = crmSessions.find((s) => s.id === activeId);
    const inTab =
      current && (tab === "active" ? current.status !== "closed" : current.status === "closed");
    if (!inTab) setActive(sorted[0].id);
  }, [tab, sorted, activeId, crmSessions, setActive]);

  useEffect(() => {
    if (active?.id && !isReadOnly && activeUnreadCustomer > 0) {
      markSessionRead(active.id, "agent");
    }
  }, [active?.id, activeUnreadCustomer, isReadOnly, markSessionRead]);

  function sendReply() {
    if (!active || !currentUser || !draft.trim() || isReadOnly) return;
    if (active.status === "waiting-for-agent") {
      claimSession(active.id, currentUser.id, currentUser.name);
    }
    sendAgentMessage(active.id, currentUser.id, currentUser.name, draft);
    setDraft("");
  }

  return (
    <PageWrap compact>
      <DesignTicketPageHeader
        compact
        title="Live Chat"
        subtitle="CRM account chats and unlinked visitors — convert to a CRM support ticket when needed."
      />

      <div className="grid min-h-[58vh] gap-2.5 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <div className="card-soft flex max-h-[68vh] flex-col overflow-hidden p-0">
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                tab === "active"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Active ({activeSessions.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                tab === "history"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <History className="h-3 w-3" />
              History ({historySessions.length})
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                {tab === "active" ? "No active CRM chat sessions." : "No closed sessions yet."}
              </p>
            ) : (
              sorted.map((s, i) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  companyName={accountName(s.companyId)}
                  active={active?.id === s.id}
                  onClick={() => setActive(s.id)}
                  delay={i * 0.02}
                />
              ))
            )}
          </div>
        </div>

        <div className="card-soft flex max-h-[68vh] flex-col overflow-hidden">
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{active.visitorName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {accountName(active.companyId)}
                    {isReadOnly ? ` · Closed ${formatDate(active.updatedAt)}` : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone={STATUS_TONE[active.status]}>{STATUS_LABEL[active.status]}</Pill>
                  {!isReadOnly && active.linkedTicketId ? (
                    <Link
                      to="/crm/support/$ticketId"
                      params={{ ticketId: active.linkedTicketId }}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Open ticket
                    </Link>
                  ) : null}
                  {!isReadOnly && !active.linkedTicketId && active.companyId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        const id = convertToTicket(active.id);
                        if (id) {
                          // ticket created — link stays on session
                        }
                      }}
                    >
                      Convert to ticket
                    </Button>
                  ) : null}
                  {!isReadOnly ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => closeSession(active.id)}
                    >
                      Close
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <ChatThread messages={active.messages} />
              </div>

              {!isReadOnly ? (
                <div className="flex gap-2 border-t p-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply as agent…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <Button size="sm" className="h-9 shrink-0" onClick={sendReply}>
                    Send
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              Select a chat session
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
  delay,
}: {
  session: ChatSession;
  companyName?: string;
  active: boolean;
  onClick: () => void;
  delay: number;
}) {
  const unread = session.messages.filter((m) => m.senderType === "customer" && !m.isRead).length;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left transition-colors",
        active ? "bg-primary/10" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold">{session.visitorName}</span>
        {unread > 0 ? (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {unread}
          </span>
        ) : null}
      </div>
      <span className="truncate text-[10px] text-muted-foreground">{companyName}</span>
      <span className="truncate text-[10px] text-muted-foreground">
        {session.messages[session.messages.length - 1]?.text ?? "No messages"}
      </span>
    </motion.button>
  );
}
