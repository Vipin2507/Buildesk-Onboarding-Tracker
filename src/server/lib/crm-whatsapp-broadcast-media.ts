import fs from "node:fs";
import path from "node:path";

import { ApiError } from "@/server/auth/session";
import { getProjectRoot } from "@/server/db/resolve-db-path";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function uploadsRoot() {
  return path.join(getProjectRoot(), "data", "uploads", "crm-wa-broadcasts");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export function decodeBroadcastMediaBase64(dataBase64: string): Buffer {
  const raw = dataBase64.includes(",") ? dataBase64.split(",").pop()! : dataBase64;
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new ApiError(400, "Empty media payload");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, "Media exceeds 12 MB limit");
  }
  return buffer;
}

export function saveBroadcastMedia(opts: {
  broadcastId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const storageKey = `${opts.broadcastId}/${sanitizeFileName(opts.fileName)}`;
  const fullPath = path.join(uploadsRoot(), storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, opts.buffer);
  return { storageKey, byteLength: opts.buffer.length };
}

export function readBroadcastMedia(storageKey: string): {
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

export function deleteBroadcastMedia(storageKey: string | null | undefined) {
  if (!storageKey) return;
  try {
    const { fullPath } = readBroadcastMedia(storageKey);
    fs.unlinkSync(fullPath);
    const dir = path.dirname(fullPath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    /* ignore */
  }
}

export function inferBroadcastMediaKind(
  mimeType: string,
): "image" | "video" | "voice" | "file" {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";
  return "file";
}
