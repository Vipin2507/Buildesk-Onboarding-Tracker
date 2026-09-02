import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  CheckCircle2,
  ImagePlus,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  Square,
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
import { compressImageToDataUrl } from "@/lib/compress-image";
import { crmAccountTeamAssigneeUsers } from "@/lib/crm-account-access";
import { cn, formatDate, formatTime } from "@/lib/utils";
import {
  useAuthStore,
  useCrmAccountQueryStore,
  useCrmAccountStore,
  useUserStore,
} from "@/stores";
import {
  CRM_ACCOUNT_QUERY_CATEGORY_LABEL,
  CRM_ACCOUNT_QUERY_STATUS_LABEL,
  type CrmAccountQuery,
  type CrmAccountQueryAttachment,
  type CrmAccountQueryCategory,
  type CrmAccountQueryMessage,
} from "@/types/crm-account-query";

function statusTone(status: CrmAccountQuery["status"]) {
  if (status === "open") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "muted" as const;
}

function lastMessagePreview(query: CrmAccountQuery) {
  const last = query.messages[query.messages.length - 1];
  if (!last) return "No messages yet";
  if (last.messageType === "system") return last.body;
  if (last.messageType === "image") return "Image";
  if (last.messageType === "voice") return "Voice note";
  return last.body.slice(0, 60);
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  onSubmit,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onSubmit?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "min-h-8 max-h-24 w-full resize-none overflow-y-auto rounded-md border border-input bg-background px-2.5 py-1.5 text-xs leading-5 outline-none focus:ring-2 focus:ring-ring/40",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit?.();
        }
      }}
    />
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

        {msg.messageType === "image" && msg.attachments?.[0]?.url ? (
          <a href={msg.attachments[0].url} target="_blank" rel="noreferrer">
            <img
              src={msg.attachments[0].url}
              alt={msg.attachments[0].name || "Attachment"}
              className="max-h-36 rounded-md object-contain"
            />
          </a>
        ) : null}

        {msg.messageType === "voice" && msg.attachments?.[0]?.url ? (
          <audio controls className="w-full max-w-xs" src={msg.attachments[0].url}>
            <track kind="captions" />
          </audio>
        ) : null}

        {msg.body.trim() ? (
          <p className="whitespace-pre-wrap break-words leading-snug">{msg.body}</p>
        ) : null}

        {msg.messageType === "text" && msg.attachments?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.attachments.map((file) => (
              <span
                key={file.name}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs",
                  isSelf ? "bg-primary-foreground/15" : "bg-muted",
                )}
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                {file.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QueryThread({
  query,
  currentUserId,
  onSend,
  onResolve,
  onReopen,
  onArchive,
  sending,
}: {
  query: CrmAccountQuery;
  currentUserId?: string;
  onSend: (
    body: string,
    opts?: { messageType?: "text" | "image" | "voice"; attachments?: CrmAccountQueryAttachment[] },
  ) => Promise<void>;
  onResolve: () => void;
  onReopen: () => void;
  onArchive: () => void;
  sending: boolean;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const sorted = useMemo(
    () => [...query.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [query.messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [query.messages.length]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleSendText() {
    if (!text.trim() || sending || query.status === "archived") return;
    await onSend(text.trim(), { messageType: "text" });
    setText("");
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || query.status === "archived") return;
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxEdge: 960 });
      await onSend(text.trim() || "Shared an image", {
        messageType: "image",
        attachments: [{ name: file.name, url: dataUrl, mimeType: file.type }],
      });
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not attach image");
    }
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
          const reader = new FileReader();
          reader.onload = () => {
            void onSend(text.trim() || "Voice note", {
              messageType: "voice",
              attachments: [
                {
                  name: `voice-${Date.now()}.webm`,
                  url: String(reader.result),
                  mimeType: blob.type,
                  sizeBytes: blob.size,
                },
              ],
            }).then(() => setText(""));
          };
          reader.readAsDataURL(blob);
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

  const composerDisabled = sending || query.status === "archived";

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
                {CRM_ACCOUNT_QUERY_CATEGORY_LABEL[query.category]}
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
          <div className="flex items-end gap-1.5">
            <div className="min-w-0 flex-1">
              <AutoGrowTextarea
                value={text}
                onChange={setText}
                placeholder="Write a reply…"
                disabled={composerDisabled}
                onSubmit={() => void handleSendText()}
              />
            </div>
            <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-muted">
              <ImagePlus className="h-3.5 w-3.5" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={composerDisabled}
                onChange={(e) => void handlePickImage(e)}
              />
            </label>
            {!recording ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                disabled={composerDisabled}
                onClick={() => void startRecording()}
              >
                <Mic className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-8 w-8 shrink-0"
                onClick={stopRecording}
              >
                <Square className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={composerDisabled || !text.trim()}
              onClick={() => void handleSendText()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
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

export function CrmAccountQueriesPanel({ accountId }: { accountId: string }) {
  const user = useAuthStore((s) => s.user);
  const account = useCrmAccountStore((s) => s.getById(accountId));
  const users = useUserStore((s) => s.users);
  const queries = useCrmAccountQueryStore((s) => s.getByCompanyId(accountId));
  const loading = useCrmAccountQueryStore((s) => s.loadingCompanyIds[accountId]);
  const refreshCompanyQueries = useCrmAccountQueryStore((s) => s.refreshCompanyQueries);
  const createQuery = useCrmAccountQueryStore((s) => s.createQuery);
  const addMessage = useCrmAccountQueryStore((s) => s.addMessage);
  const updateStatus = useCrmAccountQueryStore((s) => s.updateStatus);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createCategory, setCreateCategory] = useState<CrmAccountQueryCategory>("general");
  const [createMessage, setCreateMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved" | "archived">("all");

  useEffect(() => {
    void refreshCompanyQueries(accountId).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load queries");
    });
  }, [accountId, refreshCompanyQueries]);

  const teamMembers = useMemo(
    () => (account ? crmAccountTeamAssigneeUsers(account, users) : []),
    [account, users],
  );

  const filteredQueries = useMemo(() => {
    if (statusFilter === "all") return queries;
    return queries.filter((q) => q.status === statusFilter);
  }, [queries, statusFilter]);

  const selected = selectedId ? queries.find((q) => q.id === selectedId) : filteredQueries[0];

  useEffect(() => {
    if (!filteredQueries.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredQueries.some((q) => q.id === selectedId)) {
      setSelectedId(filteredQueries[0].id);
    }
  }, [filteredQueries, selectedId]);

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
      setCreateCategory("general");
      setSelectedId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create query");
    }
  }

  async function handleSend(
    queryId: string,
    body: string,
    opts?: { messageType?: "text" | "image" | "voice"; attachments?: CrmAccountQueryAttachment[] },
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
                sending={sending}
                onSend={(body, opts) => handleSend(selected.id, body, opts)}
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
            {Object.entries(CRM_ACCOUNT_QUERY_CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium">
          Initial message
          <AutoGrowTextarea
            value={createMessage}
            onChange={setCreateMessage}
            placeholder="Describe your question for the account team…"
            className="mt-1"
          />
        </label>
      </EntityFormModal>
    </motion.div>
  );
}
