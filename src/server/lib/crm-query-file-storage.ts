import fs from "node:fs";
import path from "node:path";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { ApiError, newId, nowIso, toPublicUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { getProjectRoot } from "@/server/db/resolve-db-path";

const SESSION_COOKIE = "buildesk_session";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function uploadsRoot() {
  return path.join(getProjectRoot(), "data", "uploads", "crm-queries");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

function accountAccessFields(row: typeof t.crmAccounts.$inferSelect) {
  return {
    salesManagerName: row.salesManagerName ?? undefined,
    supportManager1: row.supportManager1 ?? undefined,
    supportManager2: row.supportManager2 ?? undefined,
    accountManagerName: row.accountManagerName ?? undefined,
  };
}

export function decodeUploadPayload(dataBase64: string): Buffer {
  const raw = dataBase64.includes(",") ? dataBase64.split(",").pop()! : dataBase64;
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new ApiError(400, "Empty file payload");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, `File exceeds ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`);
  }
  return buffer;
}

export function saveCrmQueryUpload(opts: {
  queryId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const storageKey = `${opts.queryId}/${newId()}-${sanitizeFileName(opts.fileName)}`;
  const fullPath = path.join(uploadsRoot(), storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, opts.buffer);
  const metaPath = `${fullPath}.meta.json`;
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ mimeType: opts.mimeType, fileName: opts.fileName }),
    "utf8",
  );
  return {
    storageKey,
    url: `/api/crm-query-files/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`,
  };
}

function resolveStoragePath(storageKey: string) {
  const normalized = path.normalize(storageKey);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new ApiError(400, "Invalid file path");
  }
  const fullPath = path.join(uploadsRoot(), normalized);
  if (!fullPath.startsWith(uploadsRoot())) {
    throw new ApiError(400, "Invalid file path");
  }
  return fullPath;
}

function readSessionUser(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const sessionId = decodeURIComponent(match[1]);
  const db = getDb();
  const row = db
    .select({ user: t.users })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.sessions.userId, t.users.id))
    .where(and(eq(t.sessions.id, sessionId), gt(t.sessions.expiresAt, nowIso())))
    .get();
  if (!row?.user.active) return null;
  return toPublicUser(row.user);
}

export async function handleCrmQueryFileRequest(request: Request): Promise<Response> {
  const user = readSessionUser(request);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const prefix = "/api/crm-query-files/";
  if (!url.pathname.startsWith(prefix)) {
    return new Response("Not found", { status: 404 });
  }

  const storageKey = decodeURIComponent(url.pathname.slice(prefix.length));
  const queryId = storageKey.split("/")[0];
  if (!queryId) return new Response("Not found", { status: 404 });

  const db = getDb();
  const query = db
    .select()
    .from(t.crmAccountQueries)
    .where(eq(t.crmAccountQueries.id, queryId))
    .get();
  if (!query) return new Response("Not found", { status: 404 });

  const account = db
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, query.companyId))
    .get();
  if (!account || !canViewCrmAccount(accountAccessFields(account), user)) {
    return new Response("Forbidden", { status: 403 });
  }

  let fullPath: string;
  try {
    fullPath = resolveStoragePath(storageKey);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (!fs.existsSync(fullPath)) {
    return new Response("Not found", { status: 404 });
  }

  const metaPath = `${fullPath}.meta.json`;
  let mimeType = "application/octet-stream";
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { mimeType?: string };
      if (meta.mimeType) mimeType = meta.mimeType;
    } catch {
      /* ignore */
    }
  }

  const buffer = fs.readFileSync(fullPath);
  return new Response(buffer, {
    status: 200,
    headers: {
      "content-type": mimeType,
      "cache-control": "private, max-age=3600",
    },
  });
}
