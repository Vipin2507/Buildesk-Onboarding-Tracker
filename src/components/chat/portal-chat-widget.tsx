import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, MessageCircle, Plus, Send, Ticket, X } from "lucide-react";
import { toast } from "sonner";

import { ChatThread } from "@/components/chat/chat-thread";
import { usePortalEmbedMode } from "@/components/portal-embed-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHATBOT_QUICK_REPLIES } from "@/data/chatbotResponses";
import type { CompanyPortalAccess } from "@/types/design-ticket";
import { useChatStore } from "@/stores/useChatStore";
import { cn, formatDate } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function PortalChatWidget({ access }: { access: CompanyPortalAccess }) {
  const embedded = usePortalEmbedMode();
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

  const anchorClass = embedded
    ? "bottom-4 right-4"
    : "bottom-20 right-3 md:bottom-6 md:right-6";

  return (
    <div
      className={cn(
        "fixed z-40 flex flex-col items-end",
        anchorClass,
        embedded && "portal-chat-widget",
      )}
    >
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
            className={cn(
              "flex h-[min(70vh,520px)] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden origin-bottom-right",
              embedded
                ? "rounded-lg border border-border bg-background shadow-md"
                : "rounded-2xl border bg-background shadow-2xl",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b px-3 py-2.5",
                embedded
                  ? "border-border bg-background text-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              <div className="min-w-0">
                <div className={cn(embedded ? "text-[13px] font-semibold" : "font-semibold")}>
                  {showHistory ? "Chat history" : "Live chat"}
                </div>
                <div
                  className={cn(
                    "truncate",
                    embedded ? "text-[11px] text-muted-foreground" : "text-xs opacity-90",
                  )}
                >
                  {access.companyName}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {!showHistory && historySessions.length > 0 ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8",
                      embedded
                        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                        : "text-primary-foreground hover:bg-white/10",
                    )}
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
                    className={cn(
                      "h-8 w-8",
                      embedded
                        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                        : "text-primary-foreground hover:bg-white/10",
                    )}
                    onClick={() => setShowHistory(false)}
                    aria-label="Back to chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8",
                      embedded
                        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                        : "text-primary-foreground hover:bg-white/10",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {showHistory ? (
              <div className="flex-1 overflow-y-auto bg-background p-2">
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
                            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40"
                          >
                            <div className="text-xs font-medium text-foreground">{formatDate(s.updatedAt)}</div>
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
                <div className="flex-1 overflow-y-auto bg-background p-3">
                  {session ? <ChatThread messages={session.messages} embedded={embedded} /> : null}
                  <div ref={bottomRef} />
                </div>

                {isClosed ? (
                  <div className="space-y-2 border-t border-border bg-background p-3">
                    <p className="text-center text-xs text-muted-foreground">
                      This conversation was closed. Your messages are saved.
                    </p>
                    <Button
                      size="sm"
                      className={cn("h-8 w-full gap-1.5", !embedded && "bg-primary")}
                      variant={embedded ? "outline" : "default"}
                      onClick={startNewChat}
                    >
                      <Plus className="h-3.5 w-3.5" /> Start new conversation
                    </Button>
                  </div>
                ) : (
                  <>
                    {session?.status === "bot-handling" ? (
                      <div className="flex flex-wrap gap-1.5 border-t border-border bg-background px-3 py-2">
                        {CHATBOT_QUICK_REPLIES.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => session && sendQuickReply(session.id, q.label)}
                            className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="border-t border-border bg-background p-3">
                      <div className="flex gap-2">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Type a message…"
                          className={cn(embedded && "h-9 text-[13px]")}
                          onKeyDown={(e) => e.key === "Enter" && send()}
                        />
                        <Button
                          size="icon"
                          onClick={send}
                          variant="default"
                          className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      {session ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-8 w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
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
        ) : embedded ? (
          <motion.button
            key="fab"
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={() => setOpen(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-opacity hover:opacity-90"
            aria-label="Open chat"
          >
            <MessageCircle className="h-5 w-5" />
            {unread ? (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
            ) : null}
          </motion.button>
        ) : (
          <motion.button
            key="fab"
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={() => setOpen(true)}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            aria-label="Open chat"
          >
            <MessageCircle className="h-6 w-6" />
            {unread ? (
              <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-background bg-destructive" />
            ) : null}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
