import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, Send, Ticket } from "lucide-react";

import { ChatThread } from "@/components/chat/chat-thread";
import { PageHeader, PageWrap, AnimatedSection } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { useChatStore, useCompanyStore, useCurrentUser } from "@/stores";
import type { ChatSession, ChatSessionStatus } from "@/types/chat";
import { cn, formatDate } from "@/lib/utils";

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

type SessionTab = "active" | "history";

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
  const [tab, setTab] = useState<SessionTab>("active");

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status !== "closed"),
    [sessions],
  );
  const historySessions = useMemo(
    () => sessions.filter((s) => s.status === "closed"),
    [sessions],
  );

  const sorted = useMemo(
    () =>
      [...(tab === "active" ? activeSessions : historySessions)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [tab, activeSessions, historySessions],
  );

  const active = sessions.find((s) => s.id === activeId) ?? sorted[0];
  const isReadOnly = active?.status === "closed";
  const activeUnreadCustomer =
    active?.messages.filter((m) => m.senderType === "customer" && !m.isRead).length ?? 0;

  useEffect(() => {
    if (!sorted.length) return;
    const current = sessions.find((s) => s.id === activeId);
    const inTab =
      current && (tab === "active" ? current.status !== "closed" : current.status === "closed");
    if (!inTab) setActive(sorted[0].id);
  }, [tab, sorted, activeId, sessions, setActive]);

  useEffect(() => {
    if (active?.id && !isReadOnly && activeUnreadCustomer > 0) {
      markSessionRead(active.id, "agent");
    }
  }, [active?.id, activeUnreadCustomer, isReadOnly, markSessionRead]);

  if (!canAccess) {
    return (
      <PageWrap>
        <PageHeader title="Live Chat" subtitle="Support team access required." />
      </PageWrap>
    );
  }

  function sendReply() {
    if (!active || !currentUser || !draft.trim() || isReadOnly) return;
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
        subtitle="Sessions are saved — browse history after closing a conversation."
      />

      <AnimatedSection delay={0.04}>
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
                  {tab === "active" ? "No active chat sessions." : "No closed sessions yet."}
                </p>
              ) : (
                sorted.map((s, i) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    companyName={companies.find((c) => c.id === s.companyId)?.name}
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
                      {companies.find((c) => c.id === active.companyId)?.name ?? "Portal visitor"}
                      {isReadOnly ? ` · Closed ${formatDate(active.updatedAt)}` : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill tone={STATUS_TONE[active.status]}>{STATUS_LABEL[active.status]}</Pill>
                    {!isReadOnly && active.linkedTicketId ? (
                      <Link
                        to="/support/$ticketId"
                        params={{ ticketId: active.linkedTicketId }}
                        className="text-xs text-primary hover:underline"
                      >
                        Ticket {active.linkedTicketId}
                      </Link>
                    ) : null}
                    {!isReadOnly && !active.linkedTicketId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => convertToTicket(active.id)}
                      >
                        <Ticket className="h-3 w-3" /> Convert
                      </Button>
                    ) : null}
                    {!isReadOnly ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => closeSession(active.id)}
                      >
                        Close
                      </Button>
                    ) : null}
                    {isReadOnly && active.linkedTicketId ? (
                      <Link
                        to="/support/$ticketId"
                        params={{ ticketId: active.linkedTicketId }}
                        className="text-xs text-primary hover:underline"
                      >
                        Ticket {active.linkedTicketId}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <ChatThread messages={active.messages} />
                </div>
                {isReadOnly ? (
                  <div className="border-t bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
                    This session is closed — view-only transcript ({active.messages.length} messages)
                  </div>
                ) : (
                  <div className="flex gap-2 border-t p-2.5">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Reply as agent…"
                      className="h-9"
                      onKeyDown={(e) => e.key === "Enter" && sendReply()}
                    />
                    <Button size="sm" onClick={sendReply} className="h-9 gap-1 bg-primary">
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                Select a session to view
              </div>
            )}
          </div>
        </div>
      </AnimatedSection>
    </PageWrap>
  );
}

function SessionRow({
  session,
  companyName,
  active,
  onClick,
  delay = 0,
}: {
  session: ChatSession;
  companyName?: string;
  active: boolean;
  onClick: () => void;
  delay?: number;
}) {
  const last = session.messages[session.messages.length - 1];
  const unread =
    session.status !== "closed" &&
    session.messages.some((m) => m.senderType === "customer" && !m.isRead);
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left transition-colors hover:bg-muted/50",
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
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Pill tone={STATUS_TONE[session.status]} className="w-fit">
          {STATUS_LABEL[session.status]}
        </Pill>
        <span className="text-[10px] text-muted-foreground">
          {session.messages.length} msgs · {formatDate(session.updatedAt)}
        </span>
      </div>
    </motion.button>
  );
}
