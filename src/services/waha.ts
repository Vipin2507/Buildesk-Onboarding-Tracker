import type { WahaConfig } from "@/types/automation";

export type WahaSendTextRequest = {
  session: string;
  chatId: string;
  text: string;
};

export type WahaSendResult = {
  ok: boolean;
  status: number;
  body: string;
  request: WahaSendTextRequest;
};

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/** Convert phone to WAHA chatId (digits only + @c.us). */
export function phoneToWahaChatId(phone: string | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits}@c.us`;
}

export function buildWahaSendUrl(apiUrl: string) {
  return `${trimSlash(apiUrl)}/api/sendText`;
}

export function buildWahaSessionUrl(apiUrl: string, sessionName: string) {
  return `${trimSlash(apiUrl)}/api/sessions/${encodeURIComponent(sessionName)}`;
}

function wahaHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Api-Key": apiKey,
  };
}

export async function sendWahaText(
  config: WahaConfig,
  chatId: string,
  text: string,
): Promise<WahaSendResult> {
  const request: WahaSendTextRequest = {
    session: config.sessionName,
    chatId,
    text,
  };

  const res = await fetch(buildWahaSendUrl(config.apiUrl), {
    method: "POST",
    headers: wahaHeaders(config.apiKey),
    body: JSON.stringify(request),
  });

  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body, request };
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
    const res = await fetch(buildWahaSessionUrl(config.apiUrl, config.sessionName), {
      method: "GET",
      headers: wahaHeaders(config.apiKey),
    });
    const text = await res.text().catch(() => "");
    const latencyMs = Math.round(performance.now() - started);

    if (!res.ok) {
      return {
        status: "unhealthy",
        checkedAt,
        latencyMs,
        message: `HTTP ${res.status}`,
        rawResponse: text.slice(0, 400),
      };
    }

    let sessionStatus = "";
    try {
      const json = JSON.parse(text) as { status?: string; name?: string };
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
