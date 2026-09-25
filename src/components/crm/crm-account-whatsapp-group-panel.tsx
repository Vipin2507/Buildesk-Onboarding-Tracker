import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  FileIcon,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  Reply,
  Search,
  Send,
  Video,
  Mic,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listCrmWhatsappGroupMessages,
  upsertCrmWhatsappGroupMessages,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  fileToWahaMedia,
  listWahaChatMessages,
  listWahaGroups,
  markWahaChatSeen,
  parseWahaMessagesPayload,
  sendWahaMedia,
  sendWahaText,
  type WahaChatMessage,
  type WahaGroupSummary,
  type WahaMediaKind,
} from "@/services/waha";
import { useCrmAccountStore } from "@/stores/useCrmAccountStore";
import { useCrmAutomationStore } from "@/stores/useCrmAutomationStore";

const POLL_MS = 2500;

function storedToUiMessage(row: {
  wahaMessageId: string;
  timestamp: number;
  fromMe: boolean;
  from: string;
  participantName?: string;
  body: string;
  hasMedia: boolean;
  mediaType?: string;
  mimetype?: string;
  mediaUrl?: string;
  filename?: string;
  ack?: number;
  replyTo?: string;
}): WahaChatMessage {
  return {
    id: row.wahaMessageId,
    timestamp: row.timestamp,
    fromMe: row.fromMe,
    from: row.from,
    participantName: row.participantName,
    body: row.body,
    hasMedia: row.hasMedia,
    mediaType: row.mediaType as WahaChatMessage["mediaType"],
    mimetype: row.mimetype,
    mediaUrl: row.mediaUrl,
    filename: row.filename,
    ack: row.ack,
    replyTo: row.replyTo,
  };
}

function uiToStoredPayload(msg: WahaChatMessage) {
  return {
    wahaMessageId: msg.id,
    timestamp: msg.timestamp,
    fromMe: msg.fromMe,
    from: msg.from,
    participantName: msg.participantName ?? null,
    body: msg.body,
    hasMedia: msg.hasMedia,
    // Skip base64 mediaData — too large for SQLite; keep URL when WAHA provides one.
    mediaType: msg.mediaType ?? null,
    mimetype: msg.mimetype ?? null,
    mediaUrl: msg.mediaUrl ?? null,
    filename: msg.filename ?? null,
    ack: msg.ack ?? null,
    replyTo: msg.replyTo ?? null,
  };
}

function mergeMessages(existing: WahaChatMessage[], incoming: WahaChatMessage[]) {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const msg of incoming) {
    const prev = byId.get(msg.id);
    if (!prev) {
      byId.set(msg.id, msg);
      continue;
    }
    byId.set(msg.id, {
      ...prev,
      ...msg,
      // Prefer non-empty media URL / body from either side
      body: msg.body || prev.body,
      mediaUrl: msg.mediaUrl || prev.mediaUrl,
      mediaData: msg.mediaData || prev.mediaData,
      mediaType: msg.mediaType && msg.mediaType !== "unknown" ? msg.mediaType : prev.mediaType,
      mimetype: msg.mimetype || prev.mimetype,
      filename: msg.filename || prev.filename,
      participantName: msg.participantName || prev.participantName,
    });
  }
  return [...byId.values()].sort(
    (a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id),
  );
}

function formatMsgTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(ts: number) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function dayKey(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function AckIcon({ ack }: { ack?: number }) {
  if (ack == null || ack < 0) return null;
  if (ack >= 3) return <CheckCheck className="h-3 w-3 text-sky-500" />;
  if (ack >= 2) return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

function mediaSrc(
  msg: WahaChatMessage,
  localPreviews?: Map<string, string>,
): string | null {
  if (msg.mediaUrl) return msg.mediaUrl;
  if (msg.mediaData && msg.mimetype) {
    return `data:${msg.mimetype};base64,${msg.mediaData}`;
  }
  return localPreviews?.get(msg.id) ?? null;
}

function mediaPlaceholderLabel(msg: WahaChatMessage) {
  switch (msg.mediaType) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "voice":
    case "audio":
      return "Audio";
    case "document":
      return msg.filename || "Document";
    case "sticker":
      return "Sticker";
    default:
      return msg.filename || "Media";
  }
}

function resolveAttachKind(file: File, preferred: WahaMediaKind): WahaMediaKind {
  if (preferred !== "file") return preferred;
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

function mediaTypeFromKind(kind: WahaMediaKind): WahaChatMessage["mediaType"] {
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "voice") return "voice";
  return "document";
}

function parseSentMessage(body: string): WahaChatMessage | null {
  try {
    const msgs = parseWahaMessagesPayload(body);
    return msgs[0] ?? null;
  } catch {
    return null;
  }
}

function normalizeGroupId(raw: string) {
  const id = raw.trim();
  if (!id) return "";
  if (id.includes("@g.us")) return id;
  if (/^\d+$/.test(id)) return `${id}@g.us`;
  return id;
}

export function CrmAccountWhatsappGroupPanel({ accountId }: { accountId: string }) {
  const account = useCrmAccountStore((s) => s.accounts.find((a) => a.id === accountId));
  const accounts = useCrmAccountStore((s) => s.accounts);
  const updateAccount = useCrmAccountStore((s) => s.updateAccount);
  const waha = useCrmAutomationStore((s) => s.waha);

  const [editing, setEditing] = useState(!account?.whatsappGroupId);
  const [groupIdInput, setGroupIdInput] = useState(account?.whatsappGroupId ?? "");
  const [groupNameInput, setGroupNameInput] = useState(account?.whatsappGroupName ?? "");
  const [pickerGroups, setPickerGroups] = useState<WahaGroupSummary[] | null>(null);
  const [loadingPicker, setLoadingPicker] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  const [messages, setMessages] = useState<WahaChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<WahaChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{
    file: File;
    kind: WahaMediaKind;
    previewUrl: string;
  } | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastSeenIds = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachKindRef = useRef<WahaMediaKind>("file");
  /** Session-only previews so sent media still shows after WAHA sync without downloadMedia. */
  const localMediaPreviewRef = useRef<Map<string, string>>(new Map());

  const groupId = account?.whatsappGroupId?.trim() || "";
  const groupName = account?.whatsappGroupName?.trim() || groupId;

  const replyPreview = useMemo(() => {
    if (!replyTo) return null;
    return messages.find((m) => m.id === replyTo.id) ?? replyTo;
  }, [replyTo, messages]);

  const takenGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of accounts) {
      const id = a.whatsappGroupId?.trim();
      if (!id) continue;
      ids.add(normalizeGroupId(id));
    }
    return ids;
  }, [accounts]);

  const availablePickerGroups = useMemo(() => {
    if (!pickerGroups) return null;
    return pickerGroups.filter((g) => !takenGroupIds.has(normalizeGroupId(g.id)));
  }, [pickerGroups, takenGroupIds]);

  const filteredPickerGroups = useMemo(() => {
    if (!availablePickerGroups) return null;
    const q = groupSearch.trim().toLowerCase();
    if (!q) return availablePickerGroups;
    return availablePickerGroups.filter(
      (g) => g.subject.toLowerCase().includes(q) || g.id.toLowerCase().includes(q),
    );
  }, [availablePickerGroups, groupSearch]);

  const loadMessages = useCallback(
    async (opts?: { silent?: boolean; recentOnly?: boolean }) => {
      if (!groupId || !waha.apiUrl || !waha.apiKey || !waha.sessionName) {
        if (!opts?.silent && groupId) {
          setPollError("WAHA is not configured — set API URL, key, and session in Automation.");
        }
        return;
      }
      if (!opts?.silent) setLoadingMsgs(true);
      try {
        // 1) Hydrate from SQLite once (skip on silent polls that only want WAHA delta).
        if (!opts?.recentOnly) {
          try {
            const stored = await listCrmWhatsappGroupMessages({
              data: { accountId, groupId },
            });
            if (stored.length > 0) {
              const ui = stored.map(storedToUiMessage);
              setMessages(ui);
              setHasMoreHistory(true);
              for (const m of ui) lastSeenIds.current.add(m.id);
            }
          } catch {
            /* table may not exist yet — continue with WAHA */
          }
        }

        // 2) Fetch from WAHA — full history on first sync, recent-only on poll.
        const result = await listWahaChatMessages(waha, groupId, {
          limit: opts?.recentOnly ? 40 : 100,
          downloadMedia: false,
        });
        if (!result.ok) {
          // Keep DB messages if WAHA fails mid-session.
          if (!opts?.silent) setPollError(result.error ?? "Failed to load messages");
          return;
        }
        setPollError(null);

        if (result.messages.length > 0) {
          setMessages((prev) => mergeMessages(prev, result.messages));
          setHasMoreHistory(!opts?.recentOnly ? result.messages.length >= 100 : true);
          void upsertCrmWhatsappGroupMessages({
            data: {
              accountId,
              groupId,
              messages: result.messages.map(uiToStoredPayload),
            },
          }).catch(() => null);
        }

        const inboundNew = result.messages.filter((m) => !m.fromMe && !lastSeenIds.current.has(m.id));
        for (const m of result.messages) lastSeenIds.current.add(m.id);
        if (inboundNew.length > 0 || document.visibilityState === "visible") {
          void markWahaChatSeen(waha, groupId).catch(() => null);
        }
      } catch (err) {
        if (!opts?.silent) {
          setPollError(err instanceof Error ? err.message : "Failed to load messages");
        }
      } finally {
        if (!opts?.silent) setLoadingMsgs(false);
      }
    },
    [accountId, groupId, waha],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!groupId || !waha.apiUrl || !waha.apiKey || !waha.sessionName || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const result = await listWahaChatMessages(waha, groupId, {
        limit: 100,
        offset: messages.length,
        downloadMedia: false,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to load older messages");
        return;
      }
      if (result.messages.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      setMessages((prev) => mergeMessages(prev, result.messages));
      setHasMoreHistory(result.messages.length >= 100);
      void upsertCrmWhatsappGroupMessages({
        data: {
          accountId,
          groupId,
          messages: result.messages.map(uiToStoredPayload),
        },
      }).catch(() => null);
    } finally {
      setLoadingOlder(false);
    }
  }, [accountId, groupId, waha, messages.length, loadingOlder]);

  useEffect(() => {
    setEditing(!account?.whatsappGroupId);
    setGroupIdInput(account?.whatsappGroupId ?? "");
    setGroupNameInput(account?.whatsappGroupName ?? "");
  }, [account?.whatsappGroupId, account?.whatsappGroupName]);

  useEffect(() => {
    lastSeenIds.current = new Set();
    setMessages([]);
    setPollError(null);
    setHasMoreHistory(true);
    setPendingMedia((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, [groupId]);

  const pendingPreviewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    pendingPreviewUrlRef.current = pendingMedia?.previewUrl ?? null;
  }, [pendingMedia]);
  useEffect(() => {
    return () => {
      if (pendingPreviewUrlRef.current) URL.revokeObjectURL(pendingPreviewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!groupId || editing) return;
    void loadMessages();
    // Polls only pull recent WAHA messages and upsert new ones into SQLite.
    const id = window.setInterval(
      () => void loadMessages({ silent: true, recentOnly: true }),
      POLL_MS,
    );
    return () => window.clearInterval(id);
  }, [groupId, editing, loadMessages]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function saveBinding() {
    const id = normalizeGroupId(groupIdInput);
    if (!id || !id.includes("@g.us")) {
      toast.error("Enter a valid WhatsApp group ID ending in @g.us");
      return;
    }
    const name = groupNameInput.trim() || id;
    updateAccount(accountId, { whatsappGroupId: id, whatsappGroupName: name });
    setEditing(false);
    toast.success("WhatsApp group linked");
  }

  function clearBinding() {
    updateAccount(accountId, { whatsappGroupId: undefined, whatsappGroupName: undefined });
    setMessages([]);
    setGroupIdInput("");
    setGroupNameInput("");
    setEditing(true);
    toast.message("WhatsApp group unlinked");
  }

  async function loadPicker() {
    setLoadingPicker(true);
    setGroupSearch("");
    try {
      const result = await listWahaGroups(waha);
      if (!result.ok) {
        toast.error(result.error ?? "Could not load groups");
        setPickerGroups([]);
        return;
      }
      setPickerGroups(result.groups);
    } finally {
      setLoadingPicker(false);
    }
  }

  async function sendText() {
    const text = draft.trim();
    if (!text || !groupId) return;
    if (!waha.isEnabled) {
      toast.error("Enable WAHA in Automation settings first");
      return;
    }
    setSending(true);
    try {
      const result = await sendWahaText(waha, groupId, text, {
        replyTo: replyTo?.id,
      });
      if (!result.ok) {
        toast.error(`Send failed (HTTP ${result.status})`);
        return;
      }
      setDraft("");
      setReplyTo(null);
      stickToBottom.current = true;
      await loadMessages({ silent: true, recentOnly: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function pickAttach(kind: WahaMediaKind) {
    attachKindRef.current = kind;
    setAttachOpen(false);
    const input = fileInputRef.current;
    if (!input) return;
    if (kind === "image") input.accept = "image/*";
    else if (kind === "video") input.accept = "video/*";
    else if (kind === "voice") input.accept = "audio/*";
    else input.accept = "*/*";
    input.value = "";
    input.click();
  }

  function clearPendingMedia() {
    setPendingMedia((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  function onFilePicked(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const kind = resolveAttachKind(file, attachKindRef.current);
    setPendingMedia((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
      };
    });
    setAttachOpen(false);
  }

  async function confirmSendMedia() {
    if (!pendingMedia || !groupId) return;
    if (!waha.isEnabled) {
      toast.error("Enable WAHA in Automation settings first");
      return;
    }
    const { file, kind, previewUrl } = pendingMedia;
    setSending(true);
    try {
      const media = await fileToWahaMedia(file);
      const caption = draft.trim() || undefined;
      const result = await sendWahaMedia(waha, kind, groupId, media, {
        caption,
        replyTo: replyTo?.id,
      });
      if (!result.ok) {
        toast.error(`Send failed (HTTP ${result.status}): ${result.body.slice(0, 120)}`);
        return;
      }

      const parsed = parseSentMessage(result.body);
      const mediaType = mediaTypeFromKind(kind);
      const optimisticId = parsed?.id || `local-media-${Date.now()}`;
      localMediaPreviewRef.current.set(optimisticId, previewUrl);

      const optimistic: WahaChatMessage = {
        id: optimisticId,
        timestamp: parsed?.timestamp || Math.floor(Date.now() / 1000),
        fromMe: true,
        from: parsed?.from || "",
        body: caption || "",
        hasMedia: true,
        mediaType: parsed?.mediaType && parsed.mediaType !== "unknown" ? parsed.mediaType : mediaType,
        mimetype: file.type || media.mimetype,
        mediaUrl: previewUrl,
        filename: file.name,
        ack: parsed?.ack ?? 1,
        replyTo: replyTo?.id,
      };

      setMessages((prev) => mergeMessages(prev, [optimistic]));
      void upsertCrmWhatsappGroupMessages({
        data: {
          accountId,
          groupId,
          messages: [uiToStoredPayload(optimistic)],
        },
      }).catch(() => null);

      // Keep previewUrl alive via localMediaPreviewRef; clear pending without revoking.
      setPendingMedia(null);
      setDraft("");
      setReplyTo(null);
      stickToBottom.current = true;
      toast.success("Media sent");
      await loadMessages({ silent: true, recentOnly: true });

      // If WAHA returned no id, adopt the real message id from the poll and drop the temp bubble.
      if (optimisticId.startsWith("local-media-")) {
        setMessages((prev) => {
          const temp = prev.find((m) => m.id === optimisticId);
          if (!temp) return prev;
          const real = prev
            .filter(
              (m) =>
                m.fromMe &&
                m.hasMedia &&
                !m.id.startsWith("local-media-") &&
                Math.abs(m.timestamp - temp.timestamp) <= 60,
            )
            .sort((a, b) => b.timestamp - a.timestamp)[0];
          if (!real) return prev;
          const preview = localMediaPreviewRef.current.get(optimisticId) || temp.mediaUrl;
          if (preview) {
            localMediaPreviewRef.current.set(real.id, preview);
            localMediaPreviewRef.current.delete(optimisticId);
          }
          return prev
            .filter((m) => m.id !== optimisticId)
            .map((m) =>
              m.id === real.id
                ? {
                    ...m,
                    mediaUrl: m.mediaUrl || preview || undefined,
                    mediaType:
                      m.mediaType && m.mediaType !== "unknown" ? m.mediaType : temp.mediaType,
                    mimetype: m.mimetype || temp.mimetype,
                    filename: m.filename || temp.filename,
                    body: m.body || temp.body,
                  }
                : m,
            );
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send media");
    } finally {
      setSending(false);
    }
  }

  async function sendComposer() {
    if (pendingMedia) {
      await confirmSendMedia();
      return;
    }
    await sendText();
  }

  if (!account) {
    return <p className="text-sm text-muted-foreground">Account not found.</p>;
  }

  if (editing || !groupId) {
    return (
      <div className="card-soft space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">Link WhatsApp group</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Paste the group <code className="rounded bg-muted px-1">@g.us</code> ID (from Automation → WAHA →
            Connected groups), or pick from the session list.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">Group ID</label>
          <Input
            value={groupIdInput}
            onChange={(e) => setGroupIdInput(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="120363…@g.us"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">Display name (optional)</label>
          <Input
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
            className="h-8 text-xs"
            placeholder="Customer support group"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" className="h-7 text-xs" onClick={saveBinding}>
            Save group
          </Button>
          {account.whatsappGroupId ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={loadingPicker}
            onClick={() => void loadPicker()}
          >
            {loadingPicker ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Fetch connected groups
          </Button>
        </div>
        {filteredPickerGroups != null ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
                placeholder="Search groups by name or ID…"
                aria-label="Search connected groups"
              />
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1.5">
              {filteredPickerGroups.length === 0 ? (
                <li className="px-2 py-3 text-center text-[10px] text-muted-foreground">
                  {groupSearch.trim()
                    ? `No available groups match “${groupSearch.trim()}”`
                    : availablePickerGroups?.length === 0 && (pickerGroups?.length ?? 0) > 0
                      ? "All connected groups are already linked to accounts"
                      : "No groups found"}
                </li>
              ) : (
                filteredPickerGroups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        setGroupIdInput(g.id);
                        setGroupNameInput(g.subject);
                      }}
                    >
                      <span className="truncate font-medium">{g.subject}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {g.id}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-lg border shadow-sm"
      style={{ background: "#efeae2" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5 text-white"
        style={{ background: "#075e54" }}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{groupName}</div>
          <div className="truncate font-mono text-[10px] opacity-80">{groupId}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loadingMsgs ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" /> : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-white hover:bg-white/10 hover:text-white"
            disabled={loadingMsgs}
            onClick={() => void loadMessages()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-white hover:bg-white/10 hover:text-white"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3" />
            Change
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
            onClick={clearBinding}
          >
            Unlink
          </Button>
        </div>
      </div>

      {!waha.isEnabled ? (
        <div className="bg-amber-50 px-3 py-1.5 text-[10px] text-amber-800">
          WAHA is disabled in Automation settings — enable it to send and receive.
        </div>
      ) : null}
      {pollError ? (
        <div className="bg-destructive/10 px-3 py-1.5 text-[10px] text-destructive">{pollError}</div>
      ) : null}

      {/* Thread */}
      <div
        ref={threadRef}
        onScroll={onThreadScroll}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='%23efeae2'/%3E%3Cpath d='M30 5l2 6 6 1-4.5 4.2 1.2 6.3L30 19.5 25.3 22.5l1.2-6.3L22 12l6-1z' fill='%23d4cdc4' fill-opacity='.35'/%3E%3C/svg%3E\")",
        }}
      >
        {messages.length === 0 && !loadingMsgs ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {pollError
              ? "Could not load chat history — check the error above."
              : "No messages yet. If this group has history, tap Refresh or Load older."}
          </p>
        ) : null}
        {messages.length > 0 && hasMoreHistory ? (
          <div className="mb-2 flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-[11px]"
              disabled={loadingOlder}
              onClick={() => void loadOlderMessages()}
            >
              {loadingOlder ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Load older messages
            </Button>
          </div>
        ) : null}
        {messages.map((msg, idx) => {
          const prev = messages[idx - 1];
          const showDay = !prev || dayKey(prev.timestamp) !== dayKey(msg.timestamp);
          const quoted = msg.replyTo ? messages.find((m) => m.id === msg.replyTo) : undefined;
          const src = mediaSrc(msg, localMediaPreviewRef.current);
          const showMedia = Boolean(msg.hasMedia || src);
          const effectiveType =
            msg.mediaType && msg.mediaType !== "unknown"
              ? msg.mediaType
              : msg.mimetype?.startsWith("image/")
                ? "image"
                : msg.mimetype?.startsWith("video/")
                  ? "video"
                  : msg.mimetype?.startsWith("audio/")
                    ? "audio"
                    : showMedia
                      ? "document"
                      : undefined;
          return (
            <div key={msg.id}>
              {showDay ? (
                <div className="my-2 flex justify-center">
                  <span className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                    {formatDayLabel(msg.timestamp)}
                  </span>
                </div>
              ) : null}
              <div className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "group relative max-w-[78%] rounded-lg px-2.5 py-1.5 text-xs shadow-sm",
                    msg.fromMe ? "rounded-tr-none bg-[#dcf8c6]" : "rounded-tl-none bg-white",
                  )}
                >
                  {!msg.fromMe && (msg.participantName || msg.from) ? (
                    <div className="mb-0.5 text-[10px] font-semibold text-teal-700">
                      {msg.participantName || msg.from.replace(/@.*/, "")}
                    </div>
                  ) : null}
                  {quoted || msg.replyTo ? (
                    <div className="mb-1 rounded border-l-2 border-teal-600 bg-black/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {quoted?.body?.slice(0, 120) || "Replied message"}
                    </div>
                  ) : null}
                  {showMedia && effectiveType === "image" ? (
                    src ? (
                      <img src={src} alt="" className="mb-1 max-h-48 max-w-full rounded-md object-cover" />
                    ) : (
                      <div className="mb-1 flex min-h-[72px] min-w-[140px] items-center justify-center gap-1.5 rounded-md bg-black/10 px-3 py-4 text-[11px] text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                        Photo
                      </div>
                    )
                  ) : null}
                  {showMedia && effectiveType === "video" ? (
                    src ? (
                      <video src={src} controls className="mb-1 max-h-48 max-w-full rounded-md" />
                    ) : (
                      <div className="mb-1 flex min-h-[72px] min-w-[140px] items-center justify-center gap-1.5 rounded-md bg-black/10 px-3 py-4 text-[11px] text-muted-foreground">
                        <Video className="h-4 w-4" />
                        Video
                      </div>
                    )
                  ) : null}
                  {showMedia && (effectiveType === "audio" || effectiveType === "voice") ? (
                    src ? (
                      <audio src={src} controls className="mb-1 max-w-full" />
                    ) : (
                      <div className="mb-1 flex items-center gap-1.5 rounded-md bg-black/10 px-2 py-1.5 text-[11px] text-muted-foreground">
                        <Mic className="h-3.5 w-3.5" />
                        Audio
                      </div>
                    )
                  ) : null}
                  {showMedia && (effectiveType === "document" || effectiveType === "sticker" || effectiveType === "unknown") ? (
                    src ? (
                      <a
                        href={src}
                        download={msg.filename}
                        className="mb-1 flex items-center gap-1.5 rounded bg-black/5 px-2 py-1.5 text-[11px] underline"
                      >
                        <FileIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{mediaPlaceholderLabel(msg)}</span>
                      </a>
                    ) : (
                      <div className="mb-1 flex items-center gap-1.5 rounded bg-black/5 px-2 py-1.5 text-[11px]">
                        <FileIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{mediaPlaceholderLabel(msg)}</span>
                      </div>
                    )
                  ) : null}
                  {msg.body ? <div className="whitespace-pre-wrap break-words">{msg.body}</div> : null}
                  <div className="mt-0.5 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="opacity-0 transition group-hover:opacity-100"
                      title="Reply"
                      onClick={() => setReplyTo(msg)}
                    >
                      <Reply className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <span className="text-[9px] text-muted-foreground">{formatMsgTime(msg.timestamp)}</span>
                    {msg.fromMe ? <AckIcon ack={msg.ack} /> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply banner */}
      {replyPreview ? (
        <div className="flex items-center gap-2 border-t bg-white/90 px-3 py-1.5 text-[11px]">
          <Reply className="h-3.5 w-3.5 shrink-0 text-teal-700" />
          <div className="min-w-0 flex-1 truncate text-muted-foreground">
            Replying to: {replyPreview.body?.slice(0, 80) || "media"}
          </div>
          <button type="button" onClick={() => setReplyTo(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Pending media preview */}
      {pendingMedia ? (
        <div className="flex items-start gap-2 border-t bg-white px-3 py-2">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            {pendingMedia.kind === "image" ? (
              <img src={pendingMedia.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : pendingMedia.kind === "video" ? (
              <video src={pendingMedia.previewUrl} className="h-full w-full object-cover" muted />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center">
                {pendingMedia.kind === "voice" ? (
                  <Mic className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{pendingMedia.file.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {(pendingMedia.file.size / 1024).toFixed(0)} KB · Add a caption below, then send
            </div>
          </div>
          <button type="button" className="shrink-0 rounded-full p-1 hover:bg-muted" onClick={clearPendingMedia}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Composer */}
      <div className="flex items-end gap-1.5 border-t bg-[#f0f2f5] px-2 py-2">
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            type="button"
            className="h-9 w-9 shrink-0 rounded-full p-0"
            disabled={sending}
            onClick={() => setAttachOpen((v) => !v)}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          {attachOpen ? (
            <div className="absolute bottom-10 left-0 z-10 min-w-[140px] rounded-md border bg-white p-1 shadow-md">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                onClick={() => pickAttach("image")}
              >
                <ImageIcon className="h-3.5 w-3.5" /> Photo
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                onClick={() => pickAttach("video")}
              >
                <Video className="h-3.5 w-3.5" /> Video
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                onClick={() => pickAttach("voice")}
              >
                <Mic className="h-3.5 w-3.5" /> Audio
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                onClick={() => pickAttach("file")}
              >
                <FileIcon className="h-3.5 w-3.5" /> Document
              </button>
            </div>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => onFilePicked(e.target.files)}
        />
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendComposer();
            }
          }}
          rows={1}
          placeholder={pendingMedia ? "Add a caption…" : "Type a message"}
          className="max-h-28 min-h-[36px] flex-1 resize-none rounded-2xl border-0 bg-white px-3 py-2 text-xs shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-teal-600"
          disabled={sending}
        />
        <Button
          size="sm"
          type="button"
          className="h-9 w-9 shrink-0 rounded-full p-0"
          style={{ background: "#075e54" }}
          disabled={sending || (!pendingMedia && !draft.trim())}
          onClick={() => void sendComposer()}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
