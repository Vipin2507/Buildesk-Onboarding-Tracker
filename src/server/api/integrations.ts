import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function buildN8nUrl(base: string, segment: string) {
  return `${trimSlash(base)}/${segment.replace(/^\/+/, "")}`;
}

async function readProxyResponse(res: Response) {
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

export const proxyN8nWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        segment: z.string().min(1),
        body: z.record(z.unknown()),
        n8nWebhookBase: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const res = await fetch(buildN8nUrl(data.n8nWebhookBase, data.segment), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data.body),
    });
    return readProxyResponse(res);
  });

export const proxyN8nHealth = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        segment: z.string().min(1),
        n8nWebhookBase: z.string().min(1),
        method: z.enum(["GET", "POST"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const init: RequestInit = {
      method: data.method,
      headers: { Accept: "application/json" },
    };
    if (data.method === "POST") {
      init.headers = { ...init.headers, "Content-Type": "application/json" };
      init.body = JSON.stringify({ ping: true, source: "buildesk-compass" });
    }
    const res = await fetch(buildN8nUrl(data.n8nWebhookBase, data.segment), init);
    return readProxyResponse(res);
  });

export const proxyWahaSendText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        session: z.string().min(1),
        chatId: z.string().min(1),
        text: z.string(),
        replyTo: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const res = await fetch(`${trimSlash(data.apiUrl)}/api/sendText`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": data.apiKey,
      },
      body: JSON.stringify({
        session: data.session,
        chatId: data.chatId,
        text: data.text,
        ...(data.replyTo ? { reply_to: data.replyTo } : {}),
      }),
    });
    return readProxyResponse(res);
  });

export const proxyWahaSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        sessionName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const res = await fetch(
      `${trimSlash(data.apiUrl)}/api/sessions/${encodeURIComponent(data.sessionName)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": data.apiKey,
        },
      },
    );
    return readProxyResponse(res);
  });

/** List WhatsApp groups for a WAHA session (`GET /api/{session}/groups`). */
export const proxyWahaGroups = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        sessionName: z.string().min(1),
        limit: z.number().int().positive().max(500).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const params = new URLSearchParams({
      exclude: "participants",
      sortBy: "subject",
      sortOrder: "asc",
    });
    if (data.limit != null) params.set("limit", String(data.limit));
    if (data.offset != null) params.set("offset", String(data.offset));
    const res = await fetch(
      `${trimSlash(data.apiUrl)}/api/${encodeURIComponent(data.sessionName)}/groups?${params}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": data.apiKey,
        },
      },
    );
    return readProxyResponse(res);
  });

export const proxyWahaGroupsRefresh = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        sessionName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const res = await fetch(
      `${trimSlash(data.apiUrl)}/api/${encodeURIComponent(data.sessionName)}/groups/refresh`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Api-Key": data.apiKey,
        },
      },
    );
    return readProxyResponse(res);
  });

export const proxyWahaChatsOverview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        sessionName: z.string().min(1),
        limit: z.number().int().positive().max(500).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const params = new URLSearchParams();
    if (data.limit != null) params.set("limit", String(data.limit));
    if (data.offset != null) params.set("offset", String(data.offset));
    const qs = params.toString();
    const res = await fetch(
      `${trimSlash(data.apiUrl)}/api/${encodeURIComponent(data.sessionName)}/chats/overview${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": data.apiKey,
        },
      },
    );
    return readProxyResponse(res);
  });

export const proxyWahaChatMessages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        sessionName: z.string().min(1),
        chatId: z.string().min(1),
        limit: z.number().int().positive().max(200).optional(),
        offset: z.number().int().min(0).max(5000).optional(),
        downloadMedia: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const params = new URLSearchParams({
      limit: String(data.limit ?? 50),
      downloadMedia: data.downloadMedia ? "true" : "false",
    });
    if (data.offset != null && data.offset > 0) {
      params.set("offset", String(data.offset));
    }
    const res = await fetch(
      `${trimSlash(data.apiUrl)}/api/${encodeURIComponent(data.sessionName)}/chats/${encodeURIComponent(data.chatId)}/messages?${params}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": data.apiKey,
        },
      },
    );
    return readProxyResponse(res);
  });

export const proxyWahaChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        sessionName: z.string().min(1),
        chatId: z.string().min(1),
        messageId: z.string().min(1),
        downloadMedia: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const params = new URLSearchParams({
      downloadMedia: data.downloadMedia === false ? "false" : "true",
    });
    const res = await fetch(
      `${trimSlash(data.apiUrl)}/api/${encodeURIComponent(data.sessionName)}/chats/${encodeURIComponent(data.chatId)}/messages/${encodeURIComponent(data.messageId)}?${params}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": data.apiKey,
        },
      },
    );
    return readProxyResponse(res);
  });

export const proxyWahaSendSeen = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        session: z.string().min(1),
        chatId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const res = await fetch(`${trimSlash(data.apiUrl)}/api/sendSeen`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": data.apiKey,
      },
      body: JSON.stringify({
        session: data.session,
        chatId: data.chatId,
      }),
    });
    return readProxyResponse(res);
  });

export const proxyWahaSendMedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        session: z.string().min(1),
        kind: z.enum(["image", "file", "voice", "video"]),
        chatId: z.string().min(1),
        file: z.object({
          mimetype: z.string().min(1),
          filename: z.string().min(1),
          data: z.string().min(1),
        }),
        caption: z.string().optional(),
        replyTo: z.string().optional(),
        convert: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const path =
      data.kind === "image"
        ? "/api/sendImage"
        : data.kind === "file"
          ? "/api/sendFile"
          : data.kind === "voice"
            ? "/api/sendVoice"
            : "/api/sendVideo";
    const body: Record<string, unknown> = {
      session: data.session,
      chatId: data.chatId,
      file: data.file,
    };
    if (data.caption) body.caption = data.caption;
    if (data.replyTo) body.reply_to = data.replyTo;
    if (data.kind === "voice" || data.kind === "video") {
      body.convert = data.convert ?? true;
    }
    const res = await fetch(`${trimSlash(data.apiUrl)}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": data.apiKey,
      },
      body: JSON.stringify(body),
    });
    return readProxyResponse(res);
  });

/**
 * Fetch a WAHA media URL server-side (browser can't send X-Api-Key on <img src>).
 * Returns base64 bytes + mimetype for data-URL display.
 */
export const proxyWahaMediaFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        apiUrl: z.string().min(1),
        apiKey: z.string().min(1),
        mediaUrl: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    let url = data.mediaUrl.trim();
    if (url.startsWith("/")) {
      url = `${trimSlash(data.apiUrl)}${url}`;
    }
    // Only allow fetching from the configured WAHA host (SSRF guard).
    let allowedHost: string;
    try {
      allowedHost = new URL(trimSlash(data.apiUrl)).host;
    } catch {
      return { ok: false, status: 400, error: "Invalid WAHA API URL", base64: null, mimetype: null };
    }
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return { ok: false, status: 400, error: "Invalid media URL", base64: null, mimetype: null };
    }
    if (target.host !== allowedHost) {
      return { ok: false, status: 400, error: "Media URL host mismatch", base64: null, mimetype: null };
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "*/*",
        "X-Api-Key": data.apiKey,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 200) || `HTTP ${res.status}`,
        base64: null,
        mimetype: null,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Cap ~2.5MB base64 payload to keep ServerFn responses manageable.
    if (buf.byteLength > 2_500_000) {
      return {
        ok: false,
        status: 413,
        error: "Media too large to inline",
        base64: null,
        mimetype: null,
      };
    }
    const mimetype =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    return {
      ok: true,
      status: res.status,
      base64: buf.toString("base64"),
      mimetype,
    };
  });
