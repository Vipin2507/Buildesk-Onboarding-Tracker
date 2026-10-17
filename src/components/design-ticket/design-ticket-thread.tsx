import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, FileText, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import {
  filesToDesignTicketAttachments,
  isImageAttachment,
  snapshotFiles,
} from "@/lib/design-ticket-attachments";
import { applyCrmTicketReplyTemplate } from "@/lib/crm-ticket-reply-templates";
import {
  listActiveCrmTicketReplyTemplates,
  useCrmMasterStore,
} from "@/stores/useCrmMasterStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import type { DesignTicket, DesignTicketAttachment, DesignTicketMessage } from "@/types/design-ticket";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Reply composer — grows with content, caps before taking over the thread. */
const REPLY_MIN_H = 40;
const REPLY_MAX_H = 180;

type ReplyProps = {
  placeholder?: string;
  onSend: (message: string, attachments: DesignTicketAttachment[]) => void;
  disabled?: boolean;
};

type ThreadProps = {
  ticket: DesignTicket;
  mode: "internal" | "client";
  reply?: ReplyProps;
  contactName?: string;
  showResolvedBanner?: boolean;
};

function AttachmentChip({
  file,
  isTeam,
}: {
  file: DesignTicketAttachment;
  isTeam: boolean;
}) {
  const canOpen = Boolean(file.url);
  const isImage = isImageAttachment(file);

  if (canOpen && isImage) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "block overflow-hidden rounded-lg",
          isTeam ? "bg-primary-foreground/15" : "bg-background/80",
        )}
        title={`Open ${file.name}`}
      >
        <img src={file.url} alt={file.name} className="max-h-36 max-w-full object-contain" />
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-[10px]",
            isTeam ? "text-primary-foreground/90" : "text-muted-foreground",
          )}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{file.name}</span>
        </div>
      </a>
    );
  }

  if (canOpen) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        download={file.name}
        className={cn(
          "inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs underline-offset-2 hover:underline",
          isTeam ? "bg-primary-foreground/15" : "bg-background/70",
        )}
      >
        <Paperclip className="h-3 w-3 shrink-0" />
        <span className="truncate">{file.name}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
      </a>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs",
        isTeam ? "bg-primary-foreground/15" : "bg-background/70",
      )}
      title="File was attached as name only — content was not stored"
    >
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="truncate">{file.name}</span>
      <span className="shrink-0 opacity-60">(unavailable)</span>
    </span>
  );
}

function MessageBubble({
  msg,
  isTeam,
  animateIn,
}: {
  msg: DesignTicketMessage;
  isTeam: boolean;
  animateIn: boolean;
}) {
  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: TICKET_EASE }}
      layout="position"
      className={cn("flex", isTeam ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "w-fit max-w-[min(92%,26rem)] rounded-2xl px-3 py-2 text-sm sm:max-w-[min(78%,28rem)]",
          isTeam
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-background text-foreground shadow-sm ring-1 ring-border/60",
        )}
      >
        <div
          className={cn(
            "mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[11px]",
            isTeam ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          <span className="font-medium">{msg.authorName}</span>
          <span className="tabular-nums opacity-80">{formatDate(msg.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
        {msg.attachments?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.attachments.map((file, i) => (
              <AttachmentChip key={`${file.name}-${i}`} file={file} isTeam={isTeam} />
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function SystemEntry({ msg, animateIn }: { msg: DesignTicketMessage; animateIn: boolean }) {
  return (
    <motion.div
      initial={animateIn ? { opacity: 0, scale: 0.98 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: TICKET_EASE }}
      layout="position"
      className="flex justify-center py-0.5"
    >
      <span className="max-w-[90%] text-center text-[11px] text-muted-foreground">
        {msg.message}
        <span className="ml-1.5 tabular-nums opacity-70">{formatDate(msg.createdAt)}</span>
      </span>
    </motion.div>
  );
}

export function DesignTicketThread({
  ticket,
  mode,
  reply,
  contactName,
  showResolvedBanner = true,
}: ThreadProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<DesignTicketAttachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialMessageCount = useRef<number | null>(null);
  const sorted = [...ticket.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ticketReplyTemplates = useCrmMasterStore((s) => s.ticketReplyTemplates);
  const companyName = useCompanyStore(
    (s) => s.companies.find((c) => c.id === ticket.companyId)?.name,
  );
  const activeTemplates = useMemo(
    () => listActiveCrmTicketReplyTemplates(),
    [ticketReplyTemplates],
  );
  const templateCtx = useMemo(
    () => ({
      ticket,
      companyName,
      clientName:
        ticket.createdBy.type === "client"
          ? ticket.createdBy.name
          : contactName,
    }),
    [ticket, companyName, contactName],
  );

  if (initialMessageCount.current === null) {
    initialMessageCount.current = sorted.length;
  }

  const resizeReplyTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const contentH = el.scrollHeight;
    const next = Math.max(REPLY_MIN_H, Math.min(contentH, REPLY_MAX_H));
    el.style.height = `${next}px`;
    el.style.overflowY = contentH > REPLY_MAX_H ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages.length, ticket.status]);

  useEffect(() => {
    resizeReplyTextarea();
  }, [text, resizeReplyTextarea]);

  function handleSend() {
    if (!reply || !text.trim()) return;
    reply.onSend(text.trim(), files);
    setText("");
    setFiles([]);
    setTemplateOpen(false);
  }

  function applyTemplate(templateId: string) {
    const tpl = activeTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    const filled = applyCrmTicketReplyTemplate(tpl.body, templateCtx);
    setText(filled);
    setTemplateOpen(false);
    toast.success(`Template “${tpl.name}” applied`);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      resizeReplyTextarea();
    });
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = snapshotFiles(e.target.files);
    e.target.value = "";
    if (!picked.length) return;
    setPicking(true);
    try {
      const { attachments, errors } = await filesToDesignTicketAttachments(picked);
      if (errors.length) toast.error(errors.join("; "));
      if (attachments.length) setFiles((prev) => [...prev, ...attachments]);
    } finally {
      setPicking(false);
    }
  }

  const messageCount = sorted.filter((m) => m.kind !== "system").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnimatePresence>
        {showResolvedBanner && ticket.status === "resolved" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: TICKET_EASE }}
            className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-center text-xs font-medium text-success"
          >
            This ticket is now Resolved — thank you for working with the Buildesk team.
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-muted/35">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversation
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {messageCount} {messageCount === 1 ? "message" : "messages"}
          </span>
        </div>

        <div className="min-h-[200px] max-h-[min(48dvh,480px)] flex-1 space-y-2.5 overflow-y-auto px-3 pb-3 sm:min-h-[260px]">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet.{" "}
              {mode === "client"
                ? "Our team will reply here soon."
                : "Waiting for client or team replies."}
            </p>
          ) : (
            sorted.map((msg, index) => {
              const animateIn = index >= (initialMessageCount.current ?? sorted.length);
              return msg.kind === "system" ? (
                <SystemEntry key={msg.id} msg={msg} animateIn={animateIn} />
              ) : (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isTeam={msg.authorType === "team"}
                  animateIn={animateIn}
                />
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {reply && !reply.disabled ? (
          <div className="shrink-0 space-y-2 border-t border-border/50 bg-background/70 px-2.5 py-2 backdrop-blur-sm">
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 px-0.5">
                {files.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-muted px-2.5 py-1 text-[11px]"
                  >
                    <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-0.5 hover:bg-background"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-1 rounded-xl border border-border/70 bg-card p-1 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
              <label
                className={cn(
                  "mb-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  picking && "opacity-60",
                )}
                title="Attach files"
              >
                <Paperclip className={cn("h-4 w-4", picking && "animate-pulse")} />
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => void onPickFiles(e)}
                />
              </label>

              {mode === "internal" ? (
                <div className="relative mb-0.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setTemplateOpen((v) => !v)}
                    aria-label="Use template"
                    aria-expanded={templateOpen}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Template
                  </Button>
                  {templateOpen ? (
                    <div className="absolute bottom-11 left-0 z-20 w-[min(340px,calc(100vw-2rem))] max-h-72 overflow-y-auto rounded-xl border bg-card p-1 shadow-lg">
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Templates
                        </span>
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Close templates"
                          onClick={() => setTemplateOpen(false)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {activeTemplates.length === 0 ? (
                        <p className="px-2 py-3 text-center text-[10px] text-muted-foreground">
                          No active templates. Add them in CRM Master → Ticket replies.
                        </p>
                      ) : (
                        activeTemplates.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                            onClick={() => applyTemplate(t.id)}
                          >
                            <span className="text-xs font-medium">{t.name}</span>
                            <span className="text-[10px] text-muted-foreground">{t.category}</span>
                            <span className="line-clamp-2 whitespace-pre-wrap text-[10px] text-muted-foreground">
                              {applyCrmTicketReplyTemplate(t.body, templateCtx)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setTemplateOpen(false);
                }}
                rows={1}
                placeholder={reply.placeholder ?? `Reply as ${contactName ?? "team"}…`}
                className="min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground"
                style={{ height: REPLY_MIN_H }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                }}
              />

              <Button
                type="button"
                size="sm"
                className="mb-0.5 h-9 shrink-0 gap-1.5 px-3"
                onClick={handleSend}
                disabled={!text.trim() || picking}
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
            <p className="px-1 text-[10px] text-muted-foreground">
              ⌘/Ctrl + Enter to send
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
