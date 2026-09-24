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
