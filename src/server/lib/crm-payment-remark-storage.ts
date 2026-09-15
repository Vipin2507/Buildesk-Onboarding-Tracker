import fs from "node:fs";
import path from "node:path";

import { ApiError, nowIso, toPublicUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { getProjectRoot } from "@/server/db/resolve-db-path";
import {
  isPaymentRemarkImageMime,
  PAYMENT_REMARK_MAX_IMAGE_BYTES,
} from "@/types/payment-remark";
import { and, eq, gt } from "drizzle-orm";

const SESSION_COOKIE = "buildesk_session";

function uploadsRoot() {
  return path.join(getProjectRoot(), "data", "uploads", "crm-payment-remarks");
}

function transactionUploadsRoot() {
  return path.join(getProjectRoot(), "data", "uploads", "crm-payment-transactions");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "image";
}

export function decodePaymentRemarkImagePayload(dataBase64: string): Buffer {
  const raw = dataBase64.includes(",") ? dataBase64.split(",").pop()! : dataBase64;
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new ApiError(400, "Empty image payload");
  if (buffer.length > PAYMENT_REMARK_MAX_IMAGE_BYTES) {
    throw new ApiError(
      400,
      `Image exceeds ${Math.round(PAYMENT_REMARK_MAX_IMAGE_BYTES / 1024 / 1024)}MB limit`,
    );
  }
  return buffer;
}

export const decodePaymentTransactionImagePayload = decodePaymentRemarkImagePayload;

function writeImageFile(opts: {
  root: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  urlPrefix: string;
}) {
  if (!isPaymentRemarkImageMime(opts.mimeType)) {
    throw new ApiError(400, "Only JPEG, PNG, WebP, or GIF images are allowed");
  }
  const fullPath = path.join(opts.root, opts.storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, opts.buffer);
  fs.writeFileSync(
    `${fullPath}.meta.json`,
    JSON.stringify({ mimeType: opts.mimeType, fileName: opts.fileName }),
    "utf8",
  );
  return {
    storageKey: opts.storageKey,
    url: `${opts.urlPrefix}${encodeURIComponent(opts.storageKey).replace(/%2F/g, "/")}`,
  };
}

export function savePaymentRemarkImage(opts: {
  accountId: string;
  remarkId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const storageKey = `${opts.accountId}/${opts.remarkId}-${sanitizeFileName(opts.fileName)}`;
  return writeImageFile({
    root: uploadsRoot(),
    storageKey,
    fileName: opts.fileName,
    mimeType: opts.mimeType,
    buffer: opts.buffer,
    urlPrefix: "/api/crm-payment-remark-files/",
  });
}

export function savePaymentTransactionImage(opts: {
  accountId: string;
  transactionId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const storageKey = `${opts.accountId}/${opts.transactionId}-${sanitizeFileName(opts.fileName)}`;
  return writeImageFile({
    root: transactionUploadsRoot(),
    storageKey,
    fileName: opts.fileName,
    mimeType: opts.mimeType,
    buffer: opts.buffer,
    urlPrefix: "/api/crm-payment-transaction-files/",
  });
}

export function deletePaymentRemarkImageFromDisk(storageKey: string) {
  try {
    const fullPath = resolveStoragePath(uploadsRoot(), storageKey);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch {
    /* best-effort */
  }
}

export function deletePaymentTransactionImageFromDisk(storageKey: string) {
  try {
    const fullPath = resolveStoragePath(transactionUploadsRoot(), storageKey);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch {
    /* best-effort */
  }
}

function resolveStoragePath(root: string, storageKey: string) {
  const normalized = path.normalize(storageKey);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new ApiError(400, "Invalid file path");
  }
  const fullPath = path.join(root, normalized);
  if (!fullPath.startsWith(root)) {
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

async function serveStoredImage(opts: {
  request: Request;
  prefix: string;
  root: string;
  resolveMime: (storageKey: string) => { mimeType: string; exists: boolean };
}): Promise<Response> {
  const user = readSessionUser(opts.request);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(opts.request.url);
  if (!url.pathname.startsWith(opts.prefix)) {
    return new Response("Not found", { status: 404 });
  }

  const storageKey = decodeURIComponent(url.pathname.slice(opts.prefix.length));
  const accountId = storageKey.split("/")[0];
  if (!accountId) return new Response("Not found", { status: 404 });

  const db = getDb();
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) return new Response("Not found", { status: 404 });

  const resolved = opts.resolveMime(storageKey);
  if (!resolved.exists) return new Response("Not found", { status: 404 });

  let fullPath: string;
  try {
    fullPath = resolveStoragePath(opts.root, storageKey);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (!fs.existsSync(fullPath)) {
    return new Response("Not found", { status: 404 });
  }

  let mimeType = resolved.mimeType || "application/octet-stream";
  const metaPath = `${fullPath}.meta.json`;
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

export async function handlePaymentRemarkFileRequest(request: Request): Promise<Response> {
  return serveStoredImage({
    request,
    prefix: "/api/crm-payment-remark-files/",
    root: uploadsRoot(),
    resolveMime: (storageKey) => {
      const db = getDb();
      const remark = db
        .select()
        .from(t.paymentRemarks)
        .where(eq(t.paymentRemarks.imageStorageKey, storageKey))
        .get();
      return {
        exists: Boolean(remark),
        mimeType: remark?.imageMimeType || "application/octet-stream",
      };
    },
  });
}

export async function handlePaymentTransactionFileRequest(request: Request): Promise<Response> {
  return serveStoredImage({
    request,
    prefix: "/api/crm-payment-transaction-files/",
    root: transactionUploadsRoot(),
    resolveMime: (storageKey) => {
      const db = getDb();
      const txn = db
        .select()
        .from(t.paymentTransactions)
        .where(eq(t.paymentTransactions.imageStorageKey, storageKey))
        .get();
      return {
        exists: Boolean(txn),
        mimeType: txn?.imageMimeType || "application/octet-stream",
      };
    },
  });
}
