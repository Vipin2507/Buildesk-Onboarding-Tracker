import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, FileText, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

import { TICKET_EASE, ticketTextareaClass } from "@/components/design-ticket/design-ticket-shared";
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
const REPLY_MIN_H = 48;
const REPLY_MAX_H = 200;

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
          "block overflow-hidden rounded-md border",
          isTeam ? "border-primary-foreground/25" : "border-border",
        )}
        title={`Open ${file.name}`}
      >
        <img src={file.url} alt={file.name} className="max-h-40 max-w-full object-contain" />
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-[10px]",
            isTeam ? "bg-primary-foreground/15" : "bg-muted",
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
          isTeam ? "bg-primary-foreground/15" : "bg-muted",
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
        isTeam ? "bg-primary-foreground/15" : "bg-muted",
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
          "max-w-[min(100%,20rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3",
          isTeam
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-card text-foreground",
        )}
      >
        <div
          className={cn(
            "mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs",
            isTeam ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          <span className="font-semibold">{msg.authorName}</span>
          <span>{formatDate(msg.createdAt)}</span>
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
      className="flex justify-center px-2 py-1"
    >
      <span className="rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground sm:text-xs">
        {msg.message}
        <span className="ml-1 opacity-70 sm:ml-2">{formatDate(msg.createdAt)}</span>
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
    const files = snapshotFiles(e.target.files);
    e.target.value = "";
    if (!files.length) return;
    setPicking(true);
    try {
      const { attachments, errors } = await filesToDesignTicketAttachments(files);
      if (errors.length) toast.error(errors.join("; "));
      if (attachments.length) setFiles((prev) => [...prev, ...attachments]);
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnimatePresence>
        {showResolvedBanner && ticket.status === "resolved" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: TICKET_EASE }}
            className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-center text-sm font-medium text-success"
          >
            This ticket is now Resolved — thank you for working with the Buildesk team.
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-3 sm:space-y-4 sm:p-4 min-h-[240px] max-h-[min(52dvh,520px)] sm:min-h-[320px]">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet.{" "}
            {mode === "client" ? "Our team will reply here soon." : "Waiting for client or team replies."}
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
        <motion.div
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: TICKET_EASE }}
          className="mt-3 space-y-2 sm:mt-4"
        >
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-1 text-xs"
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 hover:bg-muted"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted">
              <Paperclip className={cn("h-4 w-4 text-muted-foreground", picking && "animate-pulse")} />
              <input
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => void onPickFiles(e)}
              />
            </label>
            {mode === "internal" ? (
              <div className="relative shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-12 shrink-0 gap-1.5 px-3 text-xs"
                  onClick={() => setTemplateOpen((v) => !v)}
                  aria-label="Use template"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Use template
                </Button>
                {templateOpen ? (
                  <div className="absolute bottom-14 left-0 z-20 w-[min(340px,calc(100vw-2rem))] max-h-72 overflow-y-auto rounded-lg border bg-card p-1 shadow-md">
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
                          className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
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
              className={cn(
                ticketTextareaClass,
                "min-h-12 flex-1 leading-5 overflow-hidden",
              )}
              style={{ height: REPLY_MIN_H }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
            <Button
              type="button"
              className="h-12 shrink-0 gap-1.5 px-4"
              onClick={handleSend}
              disabled={!text.trim() || picking}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
