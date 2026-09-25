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
  if (hasMedia || mt) return "document";
  return undefined;
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
  const mimetype =
    (typeof row.mimetype === "string" && row.mimetype) ||
    (media && typeof media.mimetype === "string" && media.mimetype) ||
    undefined;
  const mediaUrl =
    (typeof row.mediaUrl === "string" && row.mediaUrl) ||
    (media && typeof media.url === "string" && media.url) ||
    undefined;
  const mediaData =
    (typeof row.body === "string" && row.hasMedia && row.body.startsWith("/9j") ? row.body : undefined) ||
    (media && typeof media.data === "string" ? media.data : undefined);
  const hasMedia = Boolean(row.hasMedia) || Boolean(mediaUrl) || Boolean(mediaData) || Boolean(mimetype);

  const message = asRecord(row.message);
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
        : conversation;

  const from =
    coerceWahaId(row.from) ||
    coerceWahaId(row.participant) ||
    (key ? coerceWahaId(key.participant) || coerceWahaId(key.remoteJid) : "") ||
    "";
  const participantName =
    (typeof row.notifyName === "string" && row.notifyName) ||
    (typeof row.senderName === "string" && row.senderName) ||
    (typeof row.pushName === "string" && row.pushName) ||
    (typeof row._data === "object" &&
      asRecord(row._data) &&
      typeof asRecord(row._data)!.pushName === "string" &&
      (asRecord(row._data)!.pushName as string)) ||
    undefined;

  const replyRaw = row.replyTo ?? row.reply_to;
  const replyTo =
    typeof replyRaw === "string"
      ? replyRaw
      : coerceWahaId(replyRaw) || undefined;

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

  return {
    id,
    timestamp,
    fromMe,
    from,
    participantName: participantName || undefined,
    body,
    hasMedia,
    mediaType: detectMediaType(mimetype, hasMedia),
    mimetype,
    mediaUrl,
    mediaData,
    filename:
      (typeof row.filename === "string" && row.filename) ||
      (media && typeof media.filename === "string" ? media.filename : undefined) ||
      undefined,
    ack: typeof row.ack === "number" ? row.ack : undefined,
    replyTo,
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
