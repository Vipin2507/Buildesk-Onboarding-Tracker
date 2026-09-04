import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  CheckCircle2,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { EntityFormModal } from "@/components/entity-form-modal";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  CRM_QUERY_MAX_UPLOAD_BYTES,
  crmQueryAttachmentPreviewLabel,
  crmQueryDefaultAttachmentBody,
  crmQueryMessageTypeForMime,
  formatCrmQueryFileSize,
  isCrmQueryAudioMime,
  isCrmQueryImageMime,
  isCrmQueryVideoMime,
} from "@/lib/crm-query-attachments";
import { compressImageToDataUrl } from "@/lib/compress-image";
import { crmAccountTeamAssigneeUsers } from "@/lib/crm-account-access";
import {
  applyCrmQueryMention,
  filterCrmQueryMentionCandidates,
  getCrmQueryMentionContext,
  splitCrmQueryMessageMentions,
  type CrmQueryMentionCandidate,
} from "@/lib/crm-query-mentions";
import { useCrmQueryLiveSync } from "@/hooks/use-crm-query-live-sync";
import { useSessionFilter } from "@/hooks/use-session-filter";
import { isAdminRoleKey } from "@/lib/permissions";
import { cn, formatDate, formatTime } from "@/lib/utils";
import {
  useAuthStore,
  useCrmAccountQueryStore,
  useCrmAccountStore,
  useUserStore,
} from "@/stores";
import { EMPTY_COMPANY_QUERIES } from "@/stores/useCrmAccountQueryStore";
import {
  CRM_ACCOUNT_QUERY_CATEGORIES,
  CRM_ACCOUNT_QUERY_CATEGORY_LABEL,
  crmAccountQueryCategoryLabel,
  CRM_ACCOUNT_QUERY_STATUS_LABEL,
  type CrmAccountQuery,
  type CrmAccountQueryAttachment,
  type CrmAccountQueryCategory,
  type CrmAccountQueryMessage,
  type CrmAccountQueryTypingUser,
} from "@/types/crm-account-query";

function statusTone(status: CrmAccountQuery["status"]) {
  if (status === "open") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "muted" as const;
}

const COMPOSER_ICON_BTN =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border p-0 transition-colors disabled:pointer-events-none disabled:opacity-50";

function ComposerIconButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(COMPOSER_ICON_BTN, className)} {...props}>
      {children}
    </button>
  );
}

function lastMessagePreview(query: CrmAccountQuery) {
  const last = query.messages[query.messages.length - 1];
  if (!last) return "No messages yet";
  if (last.messageType === "system") return last.body;
  if (last.messageType === "text") return last.body.slice(0, 60);
  return crmQueryAttachmentPreviewLabel(last.messageType, last.attachments?.[0]);
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  onSubmit,
  onPaste,
  className,
  mentionCandidates,
  currentUserId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onSubmit?: () => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  mentionCandidates?: CrmQueryMentionCandidate[];
  currentUserId?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(32, Math.min(el.scrollHeight, 96))}px`;
  }, [value]);

  const mentionContext = useMemo(
    () => (mentionCandidates?.length ? getCrmQueryMentionContext(value, cursor) : null),
    [mentionCandidates, value, cursor],
  );

  const filteredMentions = useMemo(
    () =>
      mentionContext && mentionCandidates
        ? filterCrmQueryMentionCandidates(mentionCandidates, mentionContext.query, currentUserId)
        : [],
    [mentionContext, mentionCandidates, currentUserId],
  );

  const mentionOpen = Boolean(mentionContext && filteredMentions.length);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionContext?.query, filteredMentions.length]);

  function syncCursor() {
    const el = ref.current;
    if (el) setCursor(el.selectionStart ?? value.length);
  }

  function selectMention(user: CrmQueryMentionCandidate) {
    if (!mentionContext) return;
    const { value: next, cursor: nextCursor } = applyCrmQueryMention(
      value,
      mentionContext.start,
      cursor,
      user.name,
    );
    onChange(next);
    setCursor(nextCursor);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="relative">
      {mentionOpen ? (
        <div className="absolute bottom-full left-0 z-20 mb-1 max-h-40 w-full min-w-[12rem] overflow-y-auto rounded-md border bg-popover py-1 shadow-md">
          {filteredMentions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={cn(
                "flex w-full items-center px-2.5 py-1.5 text-left text-xs hover:bg-muted",
                index === mentionIndex && "bg-muted",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMention(user);
              }}
            >
              <span className="font-medium">{user.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(e.target.selectionStart ?? e.target.value.length);
        }}
        onClick={syncCursor}
        onKeyUp={syncCursor}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "min-h-8 max-h-24 w-full resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-1 text-xs leading-5 outline-none focus:ring-0",
          className,
        )}
        onKeyDown={(e) => {
          if (mentionOpen) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setMentionIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const picked = filteredMentions[mentionIndex];
              if (picked) selectMention(picked);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        onPaste={onPaste}
      />
    </div>
  );
}

function MessageBodyWithMentions({ body, isSelf }: { body: string; isSelf: boolean }) {
  const parts = splitCrmQueryMessageMentions(body);
  return (
    <p className="whitespace-pre-wrap break-words leading-snug">
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <span
            key={index}
            className={cn(
              "font-semibold",
              isSelf ? "text-primary-foreground underline decoration-primary-foreground/40" : "text-primary",
            )}
          >
            @{part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function QueryMessageAttachment({
  attachment,
  messageType,
  isSelf,
}: {
  attachment: CrmAccountQueryAttachment;
  messageType: CrmAccountQueryMessage["messageType"];
  isSelf: boolean;
}) {
  if (!attachment.url) return null;

  const mime = attachment.mimeType ?? "";
  const showImage =
    messageType === "image" || isCrmQueryImageMime(mime);
  const showVideo = isCrmQueryVideoMime(mime);
  const showAudio =
    messageType === "voice" || isCrmQueryAudioMime(mime);

  if (showImage && !showVideo) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name || "Attachment"}
          className="max-h-36 rounded-md object-contain"
        />
      </a>
    );
  }

  if (showVideo) {
    return (
      <video
        controls
        className="max-h-48 w-full max-w-xs rounded-md bg-black/10"
        src={attachment.url}
      >
        <track kind="captions" />
      </video>
    );
  }

  if (showAudio) {
    return (
      <audio controls className="w-full max-w-xs" src={attachment.url}>
        <track kind="captions" />
      </audio>
    );
  }

  const sizeLabel = formatCrmQueryFileSize(attachment.sizeBytes);
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className={cn(
        "mt-0.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs underline-offset-2 hover:underline",
        isSelf ? "bg-primary-foreground/15" : "bg-muted",
      )}
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{attachment.name || "Download file"}</span>
      {sizeLabel ? <span className="shrink-0 opacity-70">({sizeLabel})</span> : null}
    </a>
  );
}

function MessageBubble({
  msg,
  isSelf,
}: {
  msg: CrmAccountQueryMessage;
  isSelf: boolean;
}) {
  if (msg.messageType === "system") {
    return (
      <div className="flex justify-center py-0.5">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {msg.body}
          <span className="ml-1.5 opacity-70">{formatTime(msg.createdAt)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex", isSelf ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(100%,18rem)] rounded-xl px-2.5 py-1.5 text-xs shadow-sm",
          isSelf
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border bg-card text-foreground",
        )}
      >
        <div
          className={cn(
            "mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px]",
            isSelf ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          <span className="font-medium">{msg.authorName}</span>
          <span>{formatTime(msg.createdAt)}</span>
        </div>

        {msg.attachments?.[0] ? (
          <QueryMessageAttachment
            attachment={msg.attachments[0]}
            messageType={msg.messageType}
            isSelf={isSelf}
          />
        ) : null}

        {msg.body.trim() ? <MessageBodyWithMentions body={msg.body} isSelf={isSelf} /> : null}
      </div>
    </div>
  );
}

function TypingIndicator({ users }: { users: CrmAccountQueryTypingUser[] }) {
  if (!users.length) return null;

  const names = users.map((u) => u.userName);
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.length} people are typing`;

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex items-center gap-0.5 rounded-full bg-muted px-2 py-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/80"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function QueryThread({
  query,
  currentUserId,
  typingUsers,
  mentionCandidates,
  onSend,
  onUploadAttachment,
  onSetTyping,
  onResolve,
  onReopen,
  onArchive,
  sending,
}: {
  query: CrmAccountQuery;
  currentUserId?: string;
  typingUsers: CrmAccountQueryTypingUser[];
  mentionCandidates: CrmQueryMentionCandidate[];
  onSend: (
    body: string,
    opts?: {
      messageType?: "text" | "image" | "voice" | "file";
      attachments?: CrmAccountQueryAttachment[];
    },
  ) => Promise<void>;
  onUploadAttachment: (
    file: Blob,
    fileName: string,
    mimeType: string,
  ) => Promise<CrmAccountQueryAttachment>;
  onSetTyping: (typing: boolean) => void;
  onResolve: () => void;
  onReopen: () => void;
  onArchive: () => void;
  sending: boolean;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    attachment: CrmAccountQueryAttachment;
    messageType: "image" | "voice" | "file";
    fileName: string;
    mimeType: string;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const sorted = useMemo(
    () => [...query.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [query.messages],
  );

  const composerDisabled = sending || uploadingAttachment || query.status === "archived";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [query.messages.length, typingUsers.length]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onSetTyping(false);
    };
  }, [onSetTyping]);

  useEffect(() => {
    if (composerDisabled || !text.trim()) {
      onSetTyping(false);
      return;
    }
    onSetTyping(true);
    const heartbeat = window.setInterval(() => onSetTyping(true), 2_000);
    return () => {
      window.clearInterval(heartbeat);
      onSetTyping(false);
    };
  }, [composerDisabled, onSetTyping, text]);

  async function handleSendText() {
    const body = text.trim();
    if ((!body && !pendingAttachment) || sending || query.status === "archived") return;
    onSetTyping(false);

    if (pendingAttachment) {
      await onSend(
        body || crmQueryDefaultAttachmentBody(pendingAttachment.fileName, pendingAttachment.mimeType),
        {
          messageType: pendingAttachment.messageType,
          attachments: [pendingAttachment.attachment],
        },
      );
      setPendingAttachment(null);
    } else {
      await onSend(body, { messageType: "text" });
    }
    setText("");
  }

  async function prepareMediaFile(file: File) {
    if (file.size > CRM_QUERY_MAX_UPLOAD_BYTES) {
      throw new Error(`File exceeds ${CRM_QUERY_MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`);
    }

    const mimeType = file.type || "application/octet-stream";
    const messageType = crmQueryMessageTypeForMime(mimeType);
    let blob: Blob = file;
    let uploadMime = mimeType;
    let fileName = file.name?.trim() || `attachment-${Date.now()}`;

    if (messageType === "image") {
      const dataUrl = await compressImageToDataUrl(file, { maxEdge: 960 });
      blob = await fetch(dataUrl).then((r) => r.blob());
      uploadMime = file.type || blob.type || "image/jpeg";
      if (!fileName.includes(".")) fileName = `${fileName}.jpg`;
    }

    const attachment = await onUploadAttachment(blob, fileName, uploadMime);
    return { attachment, messageType, fileName, mimeType: uploadMime };
  }

  async function stageMediaFile(file: File) {
    if (query.status === "archived" || sending || uploadingAttachment) return;

    setUploadingAttachment(true);
    try {
      const prepared = await prepareMediaFile(file);
      setPendingAttachment(prepared);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not attach file");
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || query.status === "archived") return;
    await stageMediaFile(file);
  }

  function handlePasteMedia(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (composerDisabled || sending) return;

    const clipboard = e.clipboardData;
    if (!clipboard) return;

    const plainText = clipboard.getData("text/plain");
    const files: File[] = [];

    for (const item of clipboard.items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }

    if (files.length === 0) return;

    // Let native paste handle copied text; only stage explicit file/image pastes.
    if (plainText.trim().length > 0) return;

    e.preventDefault();
    void stageMediaFile(files[0]!);
  }

  async function startRecording() {
    if (query.status === "archived") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        void (async () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          try {
            const fileName = `voice-${Date.now()}.webm`;
            const attachment = await onUploadAttachment(blob, fileName, blob.type || "audio/webm");
            await onSend(text.trim() || "Voice note", {
              messageType: "voice",
              attachments: [attachment],
            });
            setText("");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not send voice note");
          }
        })();
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access is required for voice notes");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <div className="flex h-[min(420px,calc(100dvh-280px))] min-h-[280px] flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-xs font-semibold">{query.title}</h3>
            <Pill tone={statusTone(query.status)} className="text-[9px]">
              {CRM_ACCOUNT_QUERY_STATUS_LABEL[query.status]}
            </Pill>
            {query.category ? (
              <span className="text-[10px] text-muted-foreground">
                {crmAccountQueryCategoryLabel(query.category)}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[10px] text-muted-foreground">
            {query.createdByName} · {formatDate(query.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {query.status === "open" ? (
            <Button size="sm" variant="outline" className="h-6 gap-1 px-1.5 text-[10px]" onClick={onResolve}>
              <CheckCircle2 className="h-3 w-3" />
              Resolve
            </Button>
          ) : null}
          {query.status === "resolved" ? (
            <Button size="sm" variant="outline" className="h-6 gap-1 px-1.5 text-[10px]" onClick={onReopen}>
              <RotateCcw className="h-3 w-3" />
              Reopen
            </Button>
          ) : null}
          {query.status !== "archived" ? (
            <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px]" onClick={onArchive}>
              <Archive className="h-3 w-3" />
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-muted/10 p-2">
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No messages yet. Start the discussion below.
          </p>
        ) : (
          sorted.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} isSelf={msg.authorUserId === currentUserId} />
          ))
        )}
        <TypingIndicator users={typingUsers} />
        <div ref={bottomRef} />
      </div>

      {query.status === "resolved" ? (
        <div className="shrink-0 border-t bg-success/5 px-2 py-1 text-center text-[10px] text-success">
          Resolved — reply to reopen
        </div>
      ) : null}

      {query.status === "archived" ? (
        <div className="shrink-0 border-t bg-muted/30 px-2 py-1 text-center text-[10px] text-muted-foreground">
          Archived — read only
        </div>
      ) : (
        <div className="shrink-0 border-t p-2">
          {pendingAttachment ? (
            <div className="mb-1.5 flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[10px]">
                {pendingAttachment.fileName}
              </span>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setPendingAttachment(null)}
                title="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}
          {uploadingAttachment ? (
            <p className="mb-1.5 text-[10px] text-muted-foreground">Uploading attachment…</p>
          ) : null}
          <div className="flex items-end gap-1.5 rounded-md border border-input bg-background px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring/40">
            <div className="min-w-0 flex-1">
              <AutoGrowTextarea
                value={text}
                onChange={setText}
                placeholder="Write a reply… Use @ to mention"
                disabled={composerDisabled}
                onSubmit={() => void handleSendText()}
                onPaste={handlePasteMedia}
                mentionCandidates={mentionCandidates}
                currentUserId={currentUserId}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                className="sr-only"
                disabled={composerDisabled}
                onChange={(e) => void handlePickFile(e)}
              />
              <ComposerIconButton
                className="border-input bg-background hover:bg-muted"
                disabled={composerDisabled}
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </ComposerIconButton>
              {!recording ? (
                <ComposerIconButton
                  className="border-input bg-background hover:bg-muted"
                  disabled={composerDisabled}
                  onClick={() => void startRecording()}
                  title="Record voice note"
                >
                  <Mic className="h-3.5 w-3.5" />
                </ComposerIconButton>
              ) : (
                <ComposerIconButton
                  className="border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={stopRecording}
                  title="Stop recording"
                >
                  <Square className="h-3 w-3" />
                </ComposerIconButton>
              )}
              <ComposerIconButton
                className="border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={composerDisabled || (!text.trim() && !pendingAttachment)}
                onClick={() => void handleSendText()}
                title="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </ComposerIconButton>
            </div>
          </div>
          {recording ? (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-destructive">
              <MicOff className="h-3 w-3" />
              Recording… tap stop when done
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CrmAccountQueriesPanel({
  accountId,
  initialQueryId,
}: {
  accountId: string;
  initialQueryId?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const users = useUserStore((s) => s.users);
  const queries =
    useCrmAccountQueryStore((s) => s.queriesByCompany[accountId]) ?? EMPTY_COMPANY_QUERIES;
  const loading = useCrmAccountQueryStore((s) => s.loadingCompanyIds[accountId]);
  const refreshCompanyQueries = useCrmAccountQueryStore((s) => s.refreshCompanyQueries);
  const createQuery = useCrmAccountQueryStore((s) => s.createQuery);
  const addMessage = useCrmAccountQueryStore((s) => s.addMessage);
  const updateStatus = useCrmAccountQueryStore((s) => s.updateStatus);
  const uploadAttachment = useCrmAccountQueryStore((s) => s.uploadAttachment);
  const setQueryTyping = useCrmAccountQueryStore((s) => s.setQueryTyping);

  const [selectedId, setSelectedId] = useState<string | null>(initialQueryId ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createCategory, setCreateCategory] = useState<CrmAccountQueryCategory>("requirement");
  const [createMessage, setCreateMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useSessionFilter<
    "all" | "open" | "resolved" | "archived"
  >(`crm.account.${accountId}.queries.status`, "all");

  useEffect(() => {
    if (initialQueryId) setSelectedId(initialQueryId);
  }, [initialQueryId]);

  useEffect(() => {
    void refreshCompanyQueries(accountId).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load queries");
    });
  }, [accountId, refreshCompanyQueries]);

  const teamMembers = useMemo(
    () => (account ? crmAccountTeamAssigneeUsers(account, users) : []),
    [account, users],
  );

  const mentionCandidates = useMemo(() => {
    const map = new Map<string, CrmQueryMentionCandidate>();
    for (const member of teamMembers) {
      map.set(member.id, { id: member.id, name: member.name });
    }
    for (const u of users) {
      if (u.active === false) continue;
      if (!isAdminRoleKey(u.role)) continue;
      if (u.productScope && u.productScope !== "crm") continue;
      map.set(u.id, { id: u.id, name: u.name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers, users]);

  const filteredQueries = useMemo(() => {
    if (statusFilter === "all") return queries;
    return queries.filter((q) => q.status === statusFilter);
  }, [queries, statusFilter]);

  const selected = selectedId ? queries.find((q) => q.id === selectedId) : filteredQueries[0];

  const { typingUsers } = useCrmQueryLiveSync(selected?.id ?? null, Boolean(selected));

  const handleSetTyping = useCallback(
    (typing: boolean) => {
      if (!selected) return;
      void setQueryTyping(selected.id, typing);
    },
    [selected, setQueryTyping],
  );

  useEffect(() => {
    if (!filteredQueries.length) {
      setSelectedId(null);
      return;
    }
    if (initialQueryId && filteredQueries.some((q) => q.id === initialQueryId)) {
      setSelectedId(initialQueryId);
      return;
    }
    if (!selectedId || !filteredQueries.some((q) => q.id === selectedId)) {
      setSelectedId(filteredQueries[0]!.id);
    }
  }, [filteredQueries, initialQueryId, selectedId]);

  async function handleCreate() {
    if (!createTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      const created = await createQuery({
        companyId: accountId,
        title: createTitle.trim(),
        category: createCategory,
        initialMessage: createMessage.trim() || undefined,
      });
      toast.success("Query created");
      setCreateOpen(false);
      setCreateTitle("");
      setCreateMessage("");
      setCreateCategory("requirement");
      setSelectedId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create query");
    }
  }

  async function handleSend(
    queryId: string,
    body: string,
    opts?: { messageType?: "text" | "image" | "voice" | "file"; attachments?: CrmAccountQueryAttachment[] },
  ) {
    setSending(true);
    try {
      await addMessage({
        queryId,
        body,
        messageType: opts?.messageType,
        attachments: opts?.attachments,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: TICKET_EASE }}
    >
      <DesignTicketSection
        compact
        title="Account queries"
        action={
          <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New query
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {(["all", "open", "resolved", "archived"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                  statusFilter === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {id}
              </button>
            ))}
          </div>
          {teamMembers.length > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {teamMembers.map((m) => m.name).join(", ")} · admins
            </p>
          ) : null}
        </div>

        {loading && queries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading queries…</p>
        ) : filteredQueries.length === 0 ? (
          <EmptyState
            title="No queries yet"
            description="Start an internal discussion when you need input from the account team."
            actionLabel="New query"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <div className="mt-2 grid min-h-0 gap-2 lg:grid-cols-[minmax(180px,220px)_1fr]">
            <div className="max-h-[min(420px,calc(100dvh-280px))] space-y-1 overflow-y-auto rounded-lg border bg-muted/10 p-1">
              {filteredQueries.map((query) => {
                const active = selected?.id === query.id;
                return (
                  <button
                    key={query.id}
                    type="button"
                    onClick={() => setSelectedId(query.id)}
                    className={cn(
                      "w-full rounded-md border px-2 py-1.5 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/5"
                        : "border-transparent bg-card hover:border-border/80",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="line-clamp-1 text-[11px] font-medium">{query.title}</span>
                      <Pill tone={statusTone(query.status)} className="shrink-0 text-[8px]">
                        {CRM_ACCOUNT_QUERY_STATUS_LABEL[query.status]}
                      </Pill>
                    </div>
                    <p className="line-clamp-1 text-[10px] text-muted-foreground">
                      {lastMessagePreview(query)}
                    </p>
                    <p className="text-[9px] tabular-nums text-muted-foreground">
                      {formatDate(query.updatedAt)} · {query.messages.length}
                    </p>
                  </button>
                );
              })}
            </div>

            {selected ? (
              <QueryThread
                key={selected.id}
                query={selected}
                currentUserId={user?.id}
                typingUsers={typingUsers}
                mentionCandidates={mentionCandidates}
                sending={sending}
                onSend={(body, opts) => handleSend(selected.id, body, opts)}
                onUploadAttachment={(file, fileName, mimeType) =>
                  uploadAttachment(selected.id, file, fileName, mimeType)
                }
                onSetTyping={handleSetTyping}
                onResolve={() =>
                  void updateStatus(selected.id, "resolved")
                    .then(() => toast.success("Query resolved"))
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Failed"),
                    )
                }
                onReopen={() =>
                  void updateStatus(selected.id, "open")
                    .then(() => toast.success("Query reopened"))
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Failed"),
                    )
                }
                onArchive={() =>
                  void updateStatus(selected.id, "archived")
                    .then(() => toast.success("Query archived"))
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Failed"),
                    )
                }
              />
            ) : null}
          </div>
        )}
      </DesignTicketSection>

      <EntityFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Start account query"
        submitLabel="Create query"
        onSubmit={handleCreate}
      >
        <label className="mb-3 block text-xs font-medium">
          Subject
          <input
            className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            placeholder="What do you need to discuss?"
          />
        </label>
        <label className="mb-3 block text-xs font-medium">
          Category
          <select
            className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
            value={createCategory}
            onChange={(e) => setCreateCategory(e.target.value as CrmAccountQueryCategory)}
          >
            {CRM_ACCOUNT_QUERY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CRM_ACCOUNT_QUERY_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium">
          Initial message
          <AutoGrowTextarea
            value={createMessage}
            onChange={setCreateMessage}
            placeholder="Describe your question… Use @ to mention someone"
            className="mt-1"
            mentionCandidates={mentionCandidates}
            currentUserId={user?.id}
          />
        </label>
      </EntityFormModal>
    </motion.div>
  );
}
