import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, MessageCircle, Plus, Send, Ticket, X } from "lucide-react";
import { toast } from "sonner";

import { ChatThread } from "@/components/chat/chat-thread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHATBOT_QUICK_REPLIES } from "@/data/chatbotResponses";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { useChatStore } from "@/stores/useChatStore";
import { cn, formatDate } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function PortalChatWidget({ access }: { access: CompanyPortalAccess }) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const startSession = useChatStore((s) => s.startSession);
  const sendCustomerMessage = useChatStore((s) => s.sendCustomerMessage);
  const sendQuickReply = useChatStore((s) => s.sendQuickReply);
  const convertToTicket = useChatStore((s) => s.convertToTicket);
  const setActivePortalSession = useChatStore((s) => s.setActivePortalSession);
  const markSessionRead = useChatStore((s) => s.markSessionRead);
  const activePortalSessionId = useChatStore((s) => s.activePortalSessionId);
  const sessions = useChatStore((s) => s.sessions);

  const portalSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.portalSlug === access.slug && s.visitorName === access.contactName)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions, access.slug, access.contactName],
  );

  const openSession = useMemo(
    () => portalSessions.find((s) => s.status !== "closed"),
    [portalSessions],
  );

  const session = useMemo(() => {
    if (activePortalSessionId) {
      return portalSessions.find((s) => s.id === activePortalSessionId) ?? openSession;
    }
    return openSession;
  }, [portalSessions, activePortalSessionId, openSession]);

  const historySessions = useMemo(
    () => portalSessions.filter((s) => s.status === "closed"),
    [portalSessions],
  );

  const isClosed = session?.status === "closed";
  const unread =
    openSession?.messages.some((m) => m.senderType !== "customer" && !m.isRead) ?? false;

  const sessionId = session?.id;
  const unreadAgentCount =
    session?.messages.filter((m) => m.senderType !== "customer" && !m.isRead).length ?? 0;

  useEffect(() => {
    if (open && !session && !showHistory) {
      const s = startSession({
        visitorName: access.contactName,
        companyId: access.companyId,
        portalSlug: access.slug,
      });
      setActivePortalSession(s.id);
    }
  }, [
    open,
    session,
    showHistory,
    startSession,
    access.companyId,
    access.contactName,
    access.slug,
    setActivePortalSession,
  ]);

  useEffect(() => {
    if (open && sessionId && !isClosed && unreadAgentCount > 0) {
      markSessionRead(sessionId, "customer");
    }
  }, [open, sessionId, isClosed, unreadAgentCount, markSessionRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length, open, showHistory]);

  function send() {
    if (!session || !draft.trim() || isClosed) return;
    sendCustomerMessage(session.id, draft);
    setDraft("");
  }

  function startNewChat() {
    const s = startSession({
      visitorName: access.contactName,
      companyId: access.companyId,
      portalSlug: access.slug,
    });
    setActivePortalSession(s.id);
    setShowHistory(false);
    toast.success("New conversation started");
  }

  function openHistorySession(id: string) {
    setActivePortalSession(id);
    setShowHistory(false);
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="fixed bottom-20 right-3 z-40 flex h-[min(70vh,520px)] w-[min(calc(100vw-1.5rem),380px)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl md:bottom-6 md:right-6"
          >
            <div className="flex items-center justify-between border-b bg-primary px-3 py-2.5 text-primary-foreground">
              <div className="min-w-0">
                <div className="font-semibold">{showHistory ? "Chat history" : "Live chat"}</div>
                <div className="truncate text-xs opacity-90">{access.companyName}</div>
              </div>
              <div className="flex items-center gap-0.5">
                {!showHistory && historySessions.length > 0 ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary-foreground hover:bg-white/10"
                    onClick={() => setShowHistory(true)}
                    aria-label="View chat history"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                ) : null}
                {showHistory ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary-foreground hover:bg-white/10"
                    onClick={() => setShowHistory(false)}
                    aria-label="Back to chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary-foreground hover:bg-white/10"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-2">
                {historySessions.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground">No past conversations.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {historySessions.map((s) => {
                      const last = s.messages[s.messages.length - 1];
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => openHistorySession(s.id)}
                            className="w-full rounded-lg border bg-card/60 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="text-xs font-medium">{formatDate(s.updatedAt)}</div>
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                              {last?.text ?? "No messages"}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {s.messages.length} messages
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3">
                  {session ? <ChatThread messages={session.messages} /> : null}
                  <div ref={bottomRef} />
                </div>

                {isClosed ? (
                  <div className="space-y-2 border-t p-3">
                    <p className="text-center text-xs text-muted-foreground">
                      This conversation was closed. Your messages are saved.
                    </p>
                    <Button size="sm" className="h-8 w-full gap-1.5 bg-primary" onClick={startNewChat}>
                      <Plus className="h-3.5 w-3.5" /> Start new conversation
                    </Button>
                  </div>
                ) : (
                  <>
                    {session?.status === "bot-handling" ? (
                      <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
                        {CHATBOT_QUICK_REPLIES.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => session && sendQuickReply(session.id, q.label)}
                            className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] hover:bg-muted"
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="border-t p-3">
                      <div className="flex gap-2">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Type a message…"
                          onKeyDown={(e) => e.key === "Enter" && send()}
                        />
                        <Button size="icon" onClick={send} className="shrink-0 bg-primary">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      {session ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-8 w-full gap-1.5 text-xs"
                          onClick={() => convertToTicket(session.id)}
                        >
                          <Ticket className="h-3.5 w-3.5" /> Convert to ticket
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-20 right-3 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:bottom-6 md:right-6",
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
        {unread && !open ? (
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-background bg-destructive" />
        ) : null}
      </motion.button>
    </>
  );
}
