import type { WahaConfig } from "@/types/automation";
import {
  fetchWahaChatMessage,
  fetchWahaChatMessages,
  fetchWahaChatsOverview,
  fetchWahaGroups,
  fetchWahaGroupsRefresh,
  fetchWahaSendMedia,
  fetchWahaSendSeen,
  fetchWahaSendText,
  fetchWahaSession,
  phoneToWahaChatId,
  normalizeIndiaPhone,
  type WahaMediaFile,
  type WahaMediaKind,
} from "@/lib/automationEndpoints";

export type { WahaSendTextRequest, WahaMediaFile, WahaMediaKind } from "@/lib/automationEndpoints";
export { phoneToWahaChatId, normalizeIndiaPhone };

export type WahaGroupSummary = {
  id: string;
  subject: string;
  participantsCount?: number;
};

export type WahaChatMessage = {
  id: string;
  timestamp: number;
  fromMe: boolean;
  from: string;
  participantName?: string;
  body: string;
  hasMedia: boolean;
  mediaType?: "image" | "video" | "audio" | "voice" | "document" | "sticker" | "unknown";
  mimetype?: string;
  mediaUrl?: string;
  mediaData?: string;
  filename?: string;
  ack?: number;
  replyTo?: string;
  /** Snippet of the quoted message (survives when the parent isn't in the loaded window). */
  replyPreview?: string;
};

export async function sendWahaText(
  config: WahaConfig,
  chatId: string,
  text: string,
  opts?: { replyTo?: string },
) {
  const result = await fetchWahaSendText(config, chatId, text, opts);
  return {
    ok: result.ok,
    status: result.status,
    body: result.text,
    request: result.request,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** WEBJS often returns `id: { _serialized: "…@g.us" }`; NOWEB uses plain strings. */
function coerceWahaId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const rec = asRecord(value);
  if (!rec) return "";
  if (typeof rec._serialized === "string") return rec._serialized.trim();
  if (typeof rec.id === "string") return rec.id.trim();
  if (typeof rec.user === "string" && typeof rec.server === "string") {
    return `${rec.user}@${rec.server}`.trim();
  }
  return "";
}

function pickGroupId(row: Record<string, unknown>, fallbackKey?: string): string {
  return (
    coerceWahaId(row.id) ||
    coerceWahaId(row.groupId) ||
    coerceWahaId(row.jid) ||
    coerceWahaId(row.chatId) ||
    (fallbackKey?.includes("@") ? fallbackKey.trim() : "")
  );
}

function pickGroupSubject(row: Record<string, unknown>): string {
  const raw =
    (typeof row.subject === "string" && row.subject) ||
    (typeof row.name === "string" && row.name) ||
    (typeof row.Name === "string" && row.Name) ||
    (typeof row.title === "string" && row.title) ||
    "";
  return raw.trim() || "Unnamed group";
}

function pickParticipantsCount(row: Record<string, unknown>): number | undefined {
  if (typeof row.participantsCount === "number") return row.participantsCount;
  if (typeof row.size === "number") return row.size;
  if (Array.isArray(row.participants)) return row.participants.length;
  const nested = asRecord(row.groupMetadata);
  if (nested && Array.isArray(nested.participants)) return nested.participants.length;
  return undefined;
}

function pushGroup(
  groups: WahaGroupSummary[],
  seen: Set<string>,
  row: Record<string, unknown>,
  fallbackKey?: string,
) {
  const id = pickGroupId(row, fallbackKey);
  if (!id || seen.has(id)) return;
  // Prefer real WhatsApp group JIDs; still keep unknown ids from engines that omit suffix.
  if (id.includes("@") && !id.includes("@g.us")) return;
  seen.add(id);
  groups.push({
    id,
    subject: pickGroupSubject(row),
    participantsCount: pickParticipantsCount(row),
  });
}

function collectGroupRows(parsed: unknown): Array<{ row: Record<string, unknown>; key?: string }> {
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => asRecord(item))
      .filter((r): r is Record<string, unknown> => !!r)
      .map((row) => ({ row }));
  }

  const root = asRecord(parsed);
  if (!root) return [];

  for (const key of ["groups", "data", "chats", "result"] as const) {
    const nested = root[key];
    if (Array.isArray(nested)) {
      return nested
        .map((item) => asRecord(item))
        .filter((r): r is Record<string, unknown> => !!r)
        .map((row) => ({ row }));
    }
    const nestedObj = asRecord(nested);
    if (nestedObj) {
      return Object.entries(nestedObj).map(([mapKey, value]) => {
        const row = asRecord(value) ?? { id: mapKey };
        return { row, key: mapKey };
      });
    }
  }

  // Baileys / some WAHA builds return a map keyed by group JID.
  const entries = Object.entries(root);
  if (entries.some(([k]) => k.includes("@g.us") || k.includes("@c.us"))) {
    return entries.map(([mapKey, value]) => {
      const row = asRecord(value) ?? { id: mapKey };
      return { row, key: mapKey };
    });
  }

  return [];
}

/** Normalize WAHA group / chat list payloads across engines into a stable UI shape. */
export function parseWahaGroupsPayload(text: string): WahaGroupSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("WAHA returned invalid JSON for groups");
  }

  const groups: WahaGroupSummary[] = [];
  const seen = new Set<string>();
  for (const { row, key } of collectGroupRows(parsed)) {
    pushGroup(groups, seen, row, key);
  }

  return groups.sort((a, b) => a.subject.localeCompare(b.subject));
}

/** Keep only `@g.us` chats from chats/overview payloads. */
export function parseWahaGroupChatsPayload(text: string): WahaGroupSummary[] {
  return parseWahaGroupsPayload(text).filter((g) => g.id.includes("@g.us"));
}

export async function listWahaGroups(config: WahaConfig): Promise<{
  ok: boolean;
  status: number;
  groups: WahaGroupSummary[];
  error?: string;
  raw?: string;
  source?: "groups" | "groups-refresh" | "chats-overview";
}> {
  try {
    const first = await fetchWahaGroups(config, { limit: 200, offset: 0 });
    if (!first.ok) {
      return {
        ok: false,
        status: first.status,
        groups: [],
        error: `HTTP ${first.status}: ${first.text.slice(0, 240)}`,
        raw: first.text.slice(0, 400),
      };
    }

    let groups = parseWahaGroupsPayload(first.text);
    if (groups.length > 0) {
      return { ok: true, status: first.status, groups, source: "groups" };
    }

    // Empty list is common right after joining a group — force WAHA to re-sync once.
    await fetchWahaGroupsRefresh(config).catch(() => null);
    const refreshed = await fetchWahaGroups(config, { limit: 200, offset: 0 });
    if (refreshed.ok) {
      groups = parseWahaGroupsPayload(refreshed.text);
      if (groups.length > 0) {
        return {
          ok: true,
          status: refreshed.status,
          groups,
          source: "groups-refresh",
        };
      }
    }

    // Fallback: chats overview often lists groups even when /groups is empty (NOWEB store lag).
    const chats = await fetchWahaChatsOverview(config, { limit: 200, offset: 0 });
    if (chats.ok) {
      groups = parseWahaGroupChatsPayload(chats.text);
      if (groups.length > 0) {
        return {
          ok: true,
          status: chats.status,
          groups,
          source: "chats-overview",
        };
      }
    }

    return {
      ok: true,
      status: first.status,
      groups: [],
      raw: (refreshed.ok ? refreshed.text : first.text).slice(0, 400),
      source: "groups",
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      groups: [],
      error: err instanceof Error ? err.message : "Failed to load WAHA groups",
    };
  }
}

export async function checkWahaSession(config: WahaConfig): Promise<{
  status: "healthy" | "unhealthy" | "unknown";
  checkedAt: string;
  latencyMs: number;
  message: string;
  rawResponse?: string;
}> {
  const started = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const result = await fetchWahaSession(config);
    const latencyMs = Math.round(performance.now() - started);
    const text = result.text;

    if (!result.ok) {
      return {
        status: "unhealthy",
        checkedAt,
        latencyMs,
        message: `HTTP ${result.status}`,
        rawResponse: text.slice(0, 400),
      };
    }

    let sessionStatus = "";
    try {
      const json = JSON.parse(text) as { status?: string };
      sessionStatus = json.status ?? "";
    } catch {
      sessionStatus = "";
    }

    const working = sessionStatus === "WORKING" || sessionStatus === "STARTED";
    return {
      status: working ? "healthy" : sessionStatus ? "unhealthy" : "healthy",
      checkedAt,
      latencyMs,
      message: sessionStatus ? `Session: ${sessionStatus}` : "WAHA reachable",
      rawResponse: text.slice(0, 400),
    };
  } catch (err) {
    return {
      status: "unhealthy",
      checkedAt,
      latencyMs: Math.round(performance.now() - started),
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

function detectMediaType(
  mimetype: string | undefined,
  hasMedia: boolean,
): WahaChatMessage["mediaType"] | undefined {
  if (!hasMedia && !mimetype) return undefined;
  const mt = (mimetype ?? "").toLowerCase();
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/ogg") || mt.includes("opus")) return "voice";
  if (mt.startsWith("audio/")) return "audio";
  if (mt.includes("webp")) return "sticker";
  // Don't default stubs to "document" — that paints a fake Document chip before hydrate.
  if (mt) return "document";
  return "unknown";
}

/** Prefer nested Baileys kinds / concrete types over generic stubs. */
function betterMediaTypePick(
  a?: WahaChatMessage["mediaType"],
  b?: WahaChatMessage["mediaType"],
): WahaChatMessage["mediaType"] | undefined {
  const score = (t?: WahaChatMessage["mediaType"]) => {
    if (!t || t === "unknown") return 0;
    if (t === "document") return 1;
    if (t === "sticker") return 2;
    return 3;
  };
  return score(a) >= score(b) ? a ?? b : b;
}

function detectMediaTypeFromRow(
  row: Record<string, unknown>,
  message: Record<string, unknown> | null,
  mimetype: string | undefined,
  hasMedia: boolean,
): WahaChatMessage["mediaType"] | undefined {
  const rawType =
    (typeof row.type === "string" && row.type) ||
    (typeof row.messageType === "string" && row.messageType) ||
    (asRecord(row.media) && typeof asRecord(row.media)!.type === "string"
      ? String(asRecord(row.media)!.type)
      : "");
  const t = rawType.toLowerCase();
  if (t === "image" || t === "photo") return "image";
  if (t === "video") return "video";
  if (t === "audio" || t === "ptt" || t === "voice") return t === "ptt" || t === "voice" ? "voice" : "audio";
  if (t === "document" || t === "doc") return "document";
  if (t === "sticker") return "sticker";

  if (message) {
    if (asRecord(message.imageMessage)) return "image";
    if (asRecord(message.videoMessage)) return "video";
    if (asRecord(message.audioMessage)) {
      const audio = asRecord(message.audioMessage)!;
      return audio.ptt === true ? "voice" : "audio";
    }
    if (asRecord(message.stickerMessage)) return "sticker";
    if (asRecord(message.documentMessage)) return "document";
  }

  return detectMediaType(mimetype, hasMedia);
}

/** Prefer configured WAHA origin so media.host mismatches (localhost vs LAN IP) still fetch. */
export function rewriteWahaMediaUrlToApiOrigin(mediaUrl: string, apiUrl: string): string {
  const trimmed = mediaUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  try {
    const api = new URL(apiUrl.replace(/\/+$/, ""));
    if (trimmed.startsWith("/")) {
      return `${api.origin}${trimmed}`;
    }
    const media = new URL(trimmed);
    return `${api.origin}${media.pathname}${media.search}`;
  } catch {
    return trimmed;
  }
}

/** Pull caption/body text out of a Baileys/WEBJS quoted-message payload. */
function extractQuotedText(quoted: Record<string, unknown> | null): string {
  if (!quoted) return "";
  if (typeof quoted.conversation === "string" && quoted.conversation.trim()) {
    return quoted.conversation.trim();
  }
  if (typeof quoted.body === "string" && quoted.body.trim() && !quoted.body.startsWith("/9j")) {
    return quoted.body.trim();
  }
  if (typeof quoted.caption === "string" && quoted.caption.trim()) {
    return quoted.caption.trim();
  }
  const ext = asRecord(quoted.extendedTextMessage);
  if (ext && typeof ext.text === "string" && ext.text.trim()) return ext.text.trim();

  const image = asRecord(quoted.imageMessage);
  if (image) {
    if (typeof image.caption === "string" && image.caption.trim()) return image.caption.trim();
    return "Photo";
  }
  const video = asRecord(quoted.videoMessage);
  if (video) {
    if (typeof video.caption === "string" && video.caption.trim()) return video.caption.trim();
    return "Video";
  }
  const doc = asRecord(quoted.documentMessage);
  if (doc) {
    if (typeof doc.caption === "string" && doc.caption.trim()) return doc.caption.trim();
    if (typeof doc.fileName === "string" && doc.fileName.trim()) return doc.fileName.trim();
    return "Document";
  }
  const audio = asRecord(quoted.audioMessage);
  if (audio) return "Audio";
  const sticker = asRecord(quoted.stickerMessage);
  if (sticker) return "Sticker";
  return "";
}

function extractReplyMeta(row: Record<string, unknown>): {
  replyTo?: string;
  replyPreview?: string;
} {
  let replyTo: string | undefined;
  let replyPreview: string | undefined;

  const replyRaw = row.replyTo ?? row.reply_to;
  if (typeof replyRaw === "string" && replyRaw.trim()) replyTo = replyRaw.trim();
  else {
    const coerced = coerceWahaId(replyRaw);
    if (coerced) replyTo = coerced;
  }

  if (typeof row.replyPreview === "string" && row.replyPreview.trim()) {
    replyPreview = row.replyPreview.trim();
  } else if (typeof row.reply_preview === "string" && row.reply_preview.trim()) {
    replyPreview = row.reply_preview.trim();
  }

  // WEBJS: quotedMsg / _data.quotedMsg
  const data = asRecord(row._data);
  const quotedMsg =
    asRecord(row.quotedMsg) ||
    asRecord(row.quoted_msg) ||
    (data ? asRecord(data.quotedMsg) || asRecord(data.quoted_msg) : null);
  if (quotedMsg) {
    const qid =
      coerceWahaId(quotedMsg.id) ||
      coerceWahaId(quotedMsg.messageId) ||
      (typeof quotedMsg.id === "object" ? coerceWahaId(quotedMsg.id) : "");
    if (qid && !replyTo) replyTo = qid;
    if (!replyPreview) {
      const text = extractQuotedText(quotedMsg);
      if (text) replyPreview = text;
    }
  }

  // Baileys / NOWEB: message.*.contextInfo
  const message = asRecord(row.message) || (data ? asRecord(data.message) : null);
  if (message) {
    for (const value of Object.values(message)) {
      const part = asRecord(value);
      const ctx = part ? asRecord(part.contextInfo) : null;
      if (!ctx) continue;
      const stanzaId =
        (typeof ctx.stanzaId === "string" && ctx.stanzaId.trim()) ||
        coerceWahaId(ctx.stanzaId) ||
        (typeof ctx.participant === "string" ? "" : "");
      if (stanzaId && !replyTo) replyTo = stanzaId;
      const quoted = asRecord(ctx.quotedMessage);
      if (quoted && !replyPreview) {
        const text = extractQuotedText(quoted);
        if (text) replyPreview = text;
      }
    }
  }

  return {
    replyTo: replyTo || undefined,
    replyPreview: replyPreview ? replyPreview.slice(0, 240) : undefined,
  };
}

function captionFromMessage(message: Record<string, unknown> | null): string {
  if (!message) return "";
  for (const key of ["imageMessage", "videoMessage", "documentMessage"]) {
    const part = asRecord(message[key]);
    if (part && typeof part.caption === "string" && part.caption.trim()) {
      return part.caption.trim();
    }
  }
  return "";
}

function parseOneMessage(row: Record<string, unknown>): WahaChatMessage | null {
  const key = asRecord(row.key);
  const id =
    coerceWahaId(row.id) ||
    (typeof row.messageId === "string" ? row.messageId : "") ||
    (key && typeof key.id === "string" ? key.id : "") ||
    "";
  if (!id) return null;

  const media = asRecord(row.media);
  const data = asRecord(row._data);
  const message = asRecord(row.message) || (data ? asRecord(data.message) : null);

  let mimetype =
    (typeof row.mimetype === "string" && row.mimetype) ||
    (media && typeof media.mimetype === "string" && media.mimetype) ||
    undefined;
  let mediaUrl =
    (typeof row.mediaUrl === "string" && row.mediaUrl) ||
    (media && typeof media.url === "string" && media.url) ||
    undefined;
  // Some WAHA builds return media.path / media.filename only.
  if (!mediaUrl && media && typeof media.path === "string" && media.path) {
    mediaUrl = media.path;
  }

  let mediaData: string | undefined;
  const rawMediaData =
    (typeof row.body === "string" && row.hasMedia && row.body.startsWith("/9j") ? row.body : undefined) ||
    (media && typeof media.data === "string" ? media.data : undefined) ||
    (typeof row.mediaData === "string" ? row.mediaData : undefined);
  if (rawMediaData) {
    if (rawMediaData.startsWith("data:") && rawMediaData.includes(";base64,")) {
      // Already a data-URL — prefer as mediaUrl for display.
      if (!mediaUrl || !mediaUrl.startsWith("data:")) mediaUrl = rawMediaData;
      const comma = rawMediaData.indexOf(",");
      mediaData = rawMediaData.slice(comma + 1);
      if (!mimetype) {
        const mimeMatch = /^data:([^;,]+)/.exec(rawMediaData);
        if (mimeMatch?.[1]) mimetype = mimeMatch[1];
      }
    } else {
      mediaData = rawMediaData;
    }
  }

  // MIME / media presence from nested Baileys payloads when list stubs omit them.
  let nestedMediaKind: WahaChatMessage["mediaType"] | undefined;
  if (message) {
    if (asRecord(message.imageMessage)) nestedMediaKind = "image";
    else if (asRecord(message.videoMessage)) nestedMediaKind = "video";
    else if (asRecord(message.audioMessage)) {
      nestedMediaKind = asRecord(message.audioMessage)!.ptt === true ? "voice" : "audio";
    } else if (asRecord(message.stickerMessage)) nestedMediaKind = "sticker";
    else if (asRecord(message.documentMessage)) nestedMediaKind = "document";

    if (!mimetype) {
      for (const key of ["imageMessage", "videoMessage", "documentMessage", "audioMessage", "stickerMessage"]) {
        const part = asRecord(message[key]);
        if (part && typeof part.mimetype === "string" && part.mimetype) {
          mimetype = part.mimetype;
          break;
        }
      }
    }
  }

  const hasMedia =
    Boolean(row.hasMedia) ||
    Boolean(mediaUrl) ||
    Boolean(mediaData) ||
    Boolean(mimetype) ||
    Boolean(nestedMediaKind);

  const conversation =
    (message && typeof message.conversation === "string" && message.conversation) ||
    (message &&
      asRecord(message.extendedTextMessage) &&
      typeof asRecord(message.extendedTextMessage)!.text === "string" &&
      (asRecord(message.extendedTextMessage)!.text as string)) ||
    "";

  const body =
    typeof row.body === "string" && !row.body.startsWith("/9j")
      ? row.body
      : typeof row.caption === "string"
        ? row.caption
        : captionFromMessage(message) || conversation;

  const from =
    coerceWahaId(row.from) ||
    coerceWahaId(row.participant) ||
    (key ? coerceWahaId(key.participant) || coerceWahaId(key.remoteJid) : "") ||
    "";
  const participantName =
    (typeof row.notifyName === "string" && row.notifyName) ||
    (typeof row.senderName === "string" && row.senderName) ||
    (typeof row.pushName === "string" && row.pushName) ||
    (data && typeof data.pushName === "string" && data.pushName) ||
    undefined;

  const { replyTo, replyPreview } = extractReplyMeta(row);

  let timestamp = 0;
  const rawTs = row.timestamp ?? row.messageTimestamp;
  if (typeof rawTs === "number") {
    timestamp = rawTs > 1e12 ? Math.floor(rawTs / 1000) : rawTs;
  } else if (typeof rawTs === "string") {
    const n = Number(rawTs);
    if (!Number.isNaN(n)) timestamp = n > 1e12 ? Math.floor(n / 1000) : n;
  }

  const fromMe =
    typeof row.fromMe === "boolean"
      ? row.fromMe
      : key && typeof key.fromMe === "boolean"
        ? key.fromMe
        : false;

  const filename =
    (typeof row.filename === "string" && row.filename) ||
    (media && typeof media.filename === "string" ? media.filename : undefined) ||
    (() => {
      const doc = message ? asRecord(message.documentMessage) : null;
      return doc && typeof doc.fileName === "string" ? doc.fileName : undefined;
    })();

  return {
    id,
    timestamp,
    fromMe,
    from,
    participantName: participantName || undefined,
    body,
    hasMedia,
    mediaType: betterMediaTypePick(
      nestedMediaKind,
      detectMediaTypeFromRow(row, message, mimetype, hasMedia),
    ),
    mimetype,
    mediaUrl,
    mediaData,
    filename,
    ack: typeof row.ack === "number" ? row.ack : undefined,
    replyTo,
    replyPreview,
  };
}

export function parseWahaMessagesPayload(text: string): WahaChatMessage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("WAHA returned invalid JSON for messages");
  }

  const root = asRecord(parsed);
  const rows: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root?.messages)
      ? (root!.messages as unknown[])
      : Array.isArray(root?.data)
        ? (root!.data as unknown[])
        : // Single message object (common on send* responses)
          root && (coerceWahaId(root.id) || coerceWahaId(root.key) || typeof root.messageId === "string")
          ? [parsed]
          : [];

  const messages: WahaChatMessage[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const msg = parseOneMessage(rec);
    if (!msg || seen.has(msg.id)) continue;
    seen.add(msg.id);
    messages.push(msg);
  }

  return messages.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}

export async function listWahaChatMessages(
  config: WahaConfig,
  chatId: string,
  opts?: { limit?: number; offset?: number; downloadMedia?: boolean },
): Promise<{
  ok: boolean;
  status: number;
  messages: WahaChatMessage[];
  error?: string;
}> {
  // Group history often times out when downloadMedia=true (WAHA/GOWS). Prefer text history first.
  const attempts: Array<{ limit: number; downloadMedia: boolean }> = [
    { limit: opts?.limit ?? 100, downloadMedia: opts?.downloadMedia ?? false },
  ];
  if (opts?.downloadMedia !== true) {
    attempts.push({ limit: 40, downloadMedia: false });
    attempts.push({ limit: 15, downloadMedia: false });
  }

  let lastError = "Failed to load messages";
  let lastStatus = 0;

  for (const attempt of attempts) {
    try {
      const result = await fetchWahaChatMessages(config, chatId, {
        limit: attempt.limit,
        offset: opts?.offset,
        downloadMedia: attempt.downloadMedia,
      });
      lastStatus = result.status;
      if (!result.ok) {
        lastError = `HTTP ${result.status}: ${result.text.slice(0, 240)}`;
        continue;
      }
      return {
        ok: true,
        status: result.status,
        messages: parseWahaMessagesPayload(result.text),
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Failed to load messages";
    }
  }

  return {
    ok: false,
    status: lastStatus,
    messages: [],
    error: lastError,
  };
}

export async function markWahaChatSeen(config: WahaConfig, chatId: string) {
  const result = await fetchWahaSendSeen(config, chatId);
  return { ok: result.ok, status: result.status, body: result.text };
}

/** Fetch a single message (optionally with media bytes) for chat previews after reload. */
export async function getWahaChatMessage(
  config: WahaConfig,
  chatId: string,
  messageId: string,
  opts?: { downloadMedia?: boolean },
): Promise<{
  ok: boolean;
  status: number;
  message: WahaChatMessage | null;
  error?: string;
}> {
  try {
    const result = await fetchWahaChatMessage(config, chatId, messageId, {
      downloadMedia: opts?.downloadMedia !== false,
    });
    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        message: null,
        error: result.text.slice(0, 200) || `HTTP ${result.status}`,
      };
    }
    const parsed = parseWahaMessagesPayload(result.text);
    return {
      ok: true,
      status: result.status,
      message: parsed[0] ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: null,
      error: err instanceof Error ? err.message : "Failed to load message",
    };
  }
}

/**
 * Resolve inbound WAHA media into a browser-displayable data-URL.
 * WAHA file URLs require X-Api-Key — never use them as bare <img src>.
 */
export async function resolveWahaMediaDataUrl(
  config: WahaConfig,
  msg: WahaChatMessage,
): Promise<{ dataUrl: string | null; mimetype?: string; error?: string }> {
  if (msg.mediaUrl?.startsWith("data:")) {
    return { dataUrl: msg.mediaUrl, mimetype: msg.mimetype };
  }
  if (msg.mediaData && msg.mimetype) {
    return {
      dataUrl: `data:${msg.mimetype};base64,${msg.mediaData}`,
      mimetype: msg.mimetype,
    };
  }

  const remote =
    msg.mediaUrl &&
    (msg.mediaUrl.startsWith("http://") ||
      msg.mediaUrl.startsWith("https://") ||
      msg.mediaUrl.startsWith("/"))
      ? rewriteWahaMediaUrlToApiOrigin(msg.mediaUrl, config.apiUrl)
      : undefined;
  if (!remote) {
    return { dataUrl: null, error: "No media URL or bytes" };
  }

  const { fetchWahaMediaFile } = await import("@/lib/automationEndpoints");
  const fetched = await fetchWahaMediaFile(config, remote);
  if (!fetched.ok || !fetched.base64) {
    return { dataUrl: null, error: fetched.error || `HTTP ${fetched.status}` };
  }
  const fetchedMime = fetched.mimetype || undefined;
  const mimetype =
    (fetchedMime && fetchedMime !== "application/octet-stream" ? fetchedMime : undefined) ||
    msg.mimetype ||
    fetchedMime ||
    (msg.mediaType === "video" ? "video/mp4" : undefined) ||
    (msg.mediaType === "image" ? "image/jpeg" : undefined) ||
    (msg.mediaType === "audio" || msg.mediaType === "voice" ? "audio/ogg" : undefined) ||
    "application/octet-stream";
  return {
    dataUrl: `data:${mimetype};base64,${fetched.base64}`,
    mimetype,
  };
}

export async function sendWahaMedia(
  config: WahaConfig,
  kind: WahaMediaKind,
  chatId: string,
  file: WahaMediaFile,
  opts?: { caption?: string; replyTo?: string },
) {
  const result = await fetchWahaSendMedia(config, kind, chatId, file, opts);
  return { ok: result.ok, status: result.status, body: result.text };
}

/** Read a browser File into WAHA base64 payload (strips data-URL prefix). */
export async function fileToWahaMedia(file: File): Promise<WahaMediaFile> {
  const MAX = 12 * 1024 * 1024;
  if (file.size > MAX) {
    throw new Error("File is larger than 12 MB");
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    mimetype: file.type || "application/octet-stream",
    filename: file.name || "file",
    data: btoa(binary),
  };
}
