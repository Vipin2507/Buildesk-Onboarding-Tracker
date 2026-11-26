import fs from "node:fs";
import path from "node:path";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, nowIso, toPublicUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { getProjectRoot } from "@/server/db/resolve-db-path";
import { CRM_ACCOUNT_DOCUMENT_MAX_BYTES } from "@/types/crm-account-document";
import { and, eq, gt } from "drizzle-orm";

const SESSION_COOKIE = "buildesk_session";

function uploadsRoot() {
  return path.join(getProjectRoot(), "data", "uploads", "crm-account-documents");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export function decodeCrmAccountDocumentPayload(dataBase64: string): Buffer {
  const raw = dataBase64.includes(",") ? dataBase64.split(",").pop()! : dataBase64;
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new ApiError(400, "Empty file payload");
  if (buffer.length > CRM_ACCOUNT_DOCUMENT_MAX_BYTES) {
    throw new ApiError(
      400,
      `File exceeds ${Math.round(CRM_ACCOUNT_DOCUMENT_MAX_BYTES / 1024 / 1024)}MB`,
    );
  }
  return buffer;
}

export function saveCrmAccountDocumentFile(opts: {
  accountId: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const storageKey = `${opts.accountId}/${opts.documentId}-${sanitizeFileName(opts.fileName)}`;
  const fullPath = path.join(uploadsRoot(), storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, opts.buffer);
  fs.writeFileSync(
    `${fullPath}.meta.json`,
    JSON.stringify({ mimeType: opts.mimeType, fileName: opts.fileName }),
    "utf8",
  );
  return {
    storageKey,
    url: `/api/crm-account-documents/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`,
  };
}

export function deleteCrmAccountDocumentFromDisk(storageKey: string) {
  try {
    const fullPath = resolveStoragePath(storageKey);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch {
    /* best-effort cleanup */
  }
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

export async function handleCrmAccountDocumentRequest(request: Request): Promise<Response> {
  const user = readSessionUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const prefix = "/api/crm-account-documents/";
  if (!url.pathname.startsWith(prefix)) return new Response("Not found", { status: 404 });

  const storageKey = decodeURIComponent(url.pathname.slice(prefix.length));
  const accountId = storageKey.split("/")[0];
  if (!accountId) return new Response("Not found", { status: 404 });

  const db = getDb();
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return new Response("Not found", { status: 404 });
  if (
    !isAdminRoleKey(user.role) &&
    !canViewCrmAccount(
      {
        salesManagerName: account.salesManagerName ?? undefined,
        supportManager1: account.supportManager1 ?? undefined,
        supportManager2: account.supportManager2 ?? undefined,
      },
      user,
    )
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const fileRow = db
    .select()
    .from(t.crmAccountDocuments)
    .where(eq(t.crmAccountDocuments.storageKey, storageKey))
    .get();
  if (!fileRow) return new Response("Not found", { status: 404 });

  let fullPath: string;
  try {
    fullPath = resolveStoragePath(storageKey);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!fs.existsSync(fullPath)) return new Response("Not found", { status: 404 });

  const mimeType = fileRow.mimeType || "application/octet-stream";
  const inline = mimeType.startsWith("image/") || mimeType.includes("pdf");
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileRow.fileName)}`;
  const buffer = fs.readFileSync(fullPath);
  return new Response(buffer, {
    status: 200,
    headers: {
      "content-type": mimeType,
      "content-disposition": disposition,
      "cache-control": "private, max-age=3600",
    },
  });
}
