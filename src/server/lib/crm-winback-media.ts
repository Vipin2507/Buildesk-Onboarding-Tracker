import fs from "node:fs";
import path from "node:path";

import { ApiError } from "@/server/auth/session";
import { getProjectRoot } from "@/server/db/resolve-db-path";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function uploadsRoot() {
  return path.join(getProjectRoot(), "data", "uploads", "crm-winback");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export function decodeWinbackMediaBase64(dataBase64: string): Buffer {
  const raw = dataBase64.includes(",") ? dataBase64.split(",").pop()! : dataBase64;
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new ApiError(400, "Empty media payload");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, "Media exceeds 25 MB limit");
  }
  return buffer;
}

export function saveWinbackMedia(opts: {
  campaignId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const storageKey = `${opts.campaignId}/${sanitizeFileName(opts.fileName)}`;
  const fullPath = path.join(uploadsRoot(), storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, opts.buffer);
  return { storageKey, byteLength: opts.buffer.length };
}

export function readWinbackMedia(storageKey: string): {
  buffer: Buffer;
  fullPath: string;
} {
  const normalized = path.normalize(storageKey);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid media path");
  }
  const fullPath = path.join(uploadsRoot(), normalized);
  if (!fullPath.startsWith(uploadsRoot())) {
    throw new Error("Invalid media path");
  }
  if (!fs.existsSync(fullPath)) {
    throw new Error("Media file missing");
  }
  return { buffer: fs.readFileSync(fullPath), fullPath };
}

export function inferWinbackMediaKind(
  mimeType: string,
): "image" | "video" | "voice" | "file" {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";
  return "file";
}
