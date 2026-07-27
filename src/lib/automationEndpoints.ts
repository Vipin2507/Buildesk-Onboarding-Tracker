import type { WahaConfig } from "@/types/automation";

export type IntegrationFetchResult = {
  ok: boolean;
  status: number;
  text: string;
};

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/** Normalize to India mobile when possible (91 + 10 digits). */
export function normalizeIndiaPhone(phone: string | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length >= 8) return digits;
  return null;
}

export function phoneToWahaChatId(phone: string | undefined): string | null {
  const normalized = normalizeIndiaPhone(phone);
  if (!normalized) return null;
  return `${normalized}@c.us`;
}

export function buildN8nWebhookUrl(base: string, segment: string) {
  return `${trimSlash(base)}/${segment.replace(/^\/+/, "")}`;
}

function isDevClient() {
  return typeof import.meta !== "undefined" && import.meta.env.DEV;
}

function isHttpsClient() {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

async function readResponse(res: Response): Promise<IntegrationFetchResult> {
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

/** Email / SMS → n8n webhook segment (buildesk-email, buildesk-health, …). */
export async function fetchN8nWebhook(
  segment: string,
  body: Record<string, unknown>,
  n8nWebhookBase: string,
): Promise<IntegrationFetchResult> {
  if (isDevClient()) {
    const res = await fetch(`/n8n/webhook/${segment.replace(/^\/+/, "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyN8nWebhook } = await import("@/server/api/integrations");
    return proxyN8nWebhook({ data: { segment, body, n8nWebhookBase } });
  }

  const res = await fetch(buildN8nWebhookUrl(n8nWebhookBase, segment), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return readResponse(res);
}

/** n8n health ping (GET or POST). */
export async function fetchN8nHealth(
  n8nWebhookBase: string,
  segment: string,
  method: "GET" | "POST",
): Promise<IntegrationFetchResult> {
  const body = method === "POST" ? JSON.stringify({ ping: true, source: "buildesk-compass" }) : undefined;

  if (isDevClient()) {
    const url = `/n8n/webhook/${segment.replace(/^\/+/, "")}`;
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body,
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyN8nHealth } = await import("@/server/api/integrations");
    return proxyN8nHealth({ data: { segment, n8nWebhookBase, method } });
  }

  const url = buildN8nWebhookUrl(n8nWebhookBase, segment);
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
  return readResponse(res);
}

export type WahaSendTextRequest = {
  session: string;
  chatId: string;
  text: string;
};

/** WhatsApp text → WAHA sendText. */
export async function fetchWahaSendText(
  config: WahaConfig,
  chatId: string,
  text: string,
): Promise<IntegrationFetchResult & { request: WahaSendTextRequest }> {
  const request: WahaSendTextRequest = {
    session: config.sessionName,
    chatId,
    text,
  };

  if (isDevClient()) {
    const res = await fetch("/waha/api/sendText", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(request),
    });
    return { ...(await readResponse(res)), request };
  }

  if (isHttpsClient()) {
    const { proxyWahaSendText } = await import("@/server/api/integrations");
    const result = await proxyWahaSendText({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        session: config.sessionName,
        chatId,
        text,
      },
    });
    return { ...result, request };
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}/api/sendText`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
    },
    body: JSON.stringify(request),
  });
  return { ...(await readResponse(res)), request };
}

/** WAHA session health check. */
export async function fetchWahaSession(config: WahaConfig): Promise<IntegrationFetchResult> {
  const sessionPath = `/api/sessions/${encodeURIComponent(config.sessionName)}`;

  if (isDevClient()) {
    const res = await fetch(`/waha${sessionPath}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyWahaSession } = await import("@/server/api/integrations");
    return proxyWahaSession({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        sessionName: config.sessionName,
      },
    });
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}${sessionPath}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
  });
  return readResponse(res);
}
