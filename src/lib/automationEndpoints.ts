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
  reply_to?: string;
};

/** WhatsApp text → WAHA sendText. */
export async function fetchWahaSendText(
  config: WahaConfig,
  chatId: string,
  text: string,
  opts?: { replyTo?: string },
): Promise<IntegrationFetchResult & { request: WahaSendTextRequest }> {
  const request: WahaSendTextRequest = {
    session: config.sessionName,
    chatId,
    text,
    ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}),
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
        replyTo: opts?.replyTo,
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

/** List groups for the WAHA session (`GET /api/{session}/groups`). */
export async function fetchWahaGroups(
  config: WahaConfig,
  opts?: { limit?: number; offset?: number },
): Promise<IntegrationFetchResult> {
  const params = new URLSearchParams({
    exclude: "participants",
    sortBy: "subject",
    sortOrder: "asc",
  });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const groupsPath = `/api/${encodeURIComponent(config.sessionName)}/groups?${params}`;

  if (isDevClient()) {
    const res = await fetch(`/waha${groupsPath}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyWahaGroups } = await import("@/server/api/integrations");
    return proxyWahaGroups({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        sessionName: config.sessionName,
        limit: opts?.limit,
        offset: opts?.offset,
      },
    });
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}${groupsPath}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
  });
  return readResponse(res);
}

/** Force WAHA to re-sync groups from WhatsApp (`POST /api/{session}/groups/refresh`). */
export async function fetchWahaGroupsRefresh(config: WahaConfig): Promise<IntegrationFetchResult> {
  const path = `/api/${encodeURIComponent(config.sessionName)}/groups/refresh`;

  if (isDevClient()) {
    const res = await fetch(`/waha${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyWahaGroupsRefresh } = await import("@/server/api/integrations");
    return proxyWahaGroupsRefresh({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        sessionName: config.sessionName,
      },
    });
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
  });
  return readResponse(res);
}

/** Chats overview — used as a fallback to discover `@g.us` groups. */
export async function fetchWahaChatsOverview(
  config: WahaConfig,
  opts?: { limit?: number; offset?: number },
): Promise<IntegrationFetchResult> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const path = `/api/${encodeURIComponent(config.sessionName)}/chats/overview${qs ? `?${qs}` : ""}`;

  if (isDevClient()) {
    const res = await fetch(`/waha${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyWahaChatsOverview } = await import("@/server/api/integrations");
    return proxyWahaChatsOverview({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        sessionName: config.sessionName,
        limit: opts?.limit,
        offset: opts?.offset,
      },
    });
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
  });
  return readResponse(res);
}

export type WahaMediaKind = "image" | "file" | "voice" | "video";

export type WahaMediaFile = {
  mimetype: string;
  filename: string;
  data: string;
};

function wahaSendMediaPath(kind: WahaMediaKind) {
  switch (kind) {
    case "image":
      return "/api/sendImage";
    case "file":
      return "/api/sendFile";
    case "voice":
      return "/api/sendVoice";
    case "video":
      return "/api/sendVideo";
  }
}

/** Fetch chat messages (`GET /api/{session}/chats/{chatId}/messages`). */
export async function fetchWahaChatMessages(
  config: WahaConfig,
  chatId: string,
  opts?: { limit?: number; offset?: number; downloadMedia?: boolean },
): Promise<IntegrationFetchResult> {
  const params = new URLSearchParams({
    limit: String(opts?.limit ?? 50),
    downloadMedia: opts?.downloadMedia ? "true" : "false",
  });
  if (opts?.offset != null && opts.offset > 0) {
    params.set("offset", String(opts.offset));
  }
  const path = `/api/${encodeURIComponent(config.sessionName)}/chats/${encodeURIComponent(chatId)}/messages?${params}`;

  if (isDevClient()) {
    const res = await fetch(`/waha${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyWahaChatMessages } = await import("@/server/api/integrations");
    return proxyWahaChatMessages({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        sessionName: config.sessionName,
        chatId,
        limit: opts?.limit,
        offset: opts?.offset,
        downloadMedia: opts?.downloadMedia,
      },
    });
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
  });
  return readResponse(res);
}

/** Mark chat as seen (`POST /api/sendSeen`). */
export async function fetchWahaSendSeen(
  config: WahaConfig,
  chatId: string,
): Promise<IntegrationFetchResult> {
  const body = { session: config.sessionName, chatId };

  if (isDevClient()) {
    const res = await fetch("/waha/api/sendSeen", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(body),
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyWahaSendSeen } = await import("@/server/api/integrations");
    return proxyWahaSendSeen({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        session: config.sessionName,
        chatId,
      },
    });
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}/api/sendSeen`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
    },
    body: JSON.stringify(body),
  });
  return readResponse(res);
}

/** Send image / file / voice / video via WAHA. */
export async function fetchWahaSendMedia(
  config: WahaConfig,
  kind: WahaMediaKind,
  chatId: string,
  file: WahaMediaFile,
  opts?: { caption?: string; replyTo?: string; convert?: boolean },
): Promise<IntegrationFetchResult> {
  const path = wahaSendMediaPath(kind);
  const body: Record<string, unknown> = {
    session: config.sessionName,
    chatId,
    file: {
      mimetype: file.mimetype,
      filename: file.filename,
      data: file.data,
    },
  };
  if (opts?.caption) body.caption = opts.caption;
  if (opts?.replyTo) body.reply_to = opts.replyTo;
  if (kind === "voice" || kind === "video") body.convert = opts?.convert ?? true;

  if (isDevClient()) {
    const res = await fetch(`/waha${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(body),
    });
    return readResponse(res);
  }

  if (isHttpsClient()) {
    const { proxyWahaSendMedia } = await import("@/server/api/integrations");
    return proxyWahaSendMedia({
      data: {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        session: config.sessionName,
        kind,
        chatId,
        file,
        caption: opts?.caption,
        replyTo: opts?.replyTo,
        convert: opts?.convert,
      },
    });
  }

  const res = await fetch(`${trimSlash(config.apiUrl)}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
    },
    body: JSON.stringify(body),
  });
  return readResponse(res);
}
