import type { WahaConfig } from "@/types/automation";
import {
  fetchWahaGroups,
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

function pickGroupId(row: Record<string, unknown>): string {
  const raw =
    (typeof row.id === "string" && row.id) ||
    (typeof row.groupId === "string" && row.groupId) ||
    (typeof row.jid === "string" && row.jid) ||
    "";
  return raw.trim();
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

/** Normalize WAHA group list payloads across engines into a stable UI shape. */
export function parseWahaGroupsPayload(text: string): WahaGroupSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("WAHA returned invalid JSON for groups");
  }

  const rows: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(asRecord(parsed)?.groups)
      ? (asRecord(parsed)!.groups as unknown[])
      : Array.isArray(asRecord(parsed)?.data)
        ? (asRecord(parsed)!.data as unknown[])
        : [];

  const groups: WahaGroupSummary[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec) continue;
    const id = pickGroupId(rec);
    if (!id) continue;
    groups.push({
      id,
      subject: pickGroupSubject(rec),
      participantsCount: pickParticipantsCount(rec),
    });
  }

  return groups.sort((a, b) => a.subject.localeCompare(b.subject));
}

export async function listWahaGroups(config: WahaConfig): Promise<{
  ok: boolean;
  status: number;
  groups: WahaGroupSummary[];
  error?: string;
  raw?: string;
}> {
  try {
    const result = await fetchWahaGroups(config, { limit: 200, offset: 0 });
    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        groups: [],
        error: `HTTP ${result.status}: ${result.text.slice(0, 240)}`,
        raw: result.text.slice(0, 400),
      };
    }
    const groups = parseWahaGroupsPayload(result.text);
    return { ok: true, status: result.status, groups };
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
