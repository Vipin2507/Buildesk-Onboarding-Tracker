import type { WahaConfig } from "@/types/automation";
import {
  fetchWahaChatsOverview,
  fetchWahaGroups,
  fetchWahaGroupsRefresh,
  fetchWahaSendText,
  fetchWahaSession,
  phoneToWahaChatId,
  normalizeIndiaPhone,
} from "@/lib/automationEndpoints";

export type { WahaSendTextRequest } from "@/lib/automationEndpoints";
export { phoneToWahaChatId, normalizeIndiaPhone };

export type WahaGroupSummary = {
  id: string;
  subject: string;
  participantsCount?: number;
};

export async function sendWahaText(
  config: WahaConfig,
  chatId: string,
  text: string,
) {
  const result = await fetchWahaSendText(config, chatId, text);
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
