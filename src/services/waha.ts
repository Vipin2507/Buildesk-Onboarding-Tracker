import type { WahaConfig } from "@/types/automation";
import {
  fetchWahaSendText,
  fetchWahaSession,
  phoneToWahaChatId,
  normalizeIndiaPhone,
} from "@/lib/automationEndpoints";

export type { WahaSendTextRequest } from "@/lib/automationEndpoints";
export { phoneToWahaChatId, normalizeIndiaPhone };

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
