import fs from "node:fs";
import path from "node:path";

import { and, eq, gt } from "drizzle-orm";

import { ApiError, nowIso, toPublicUser } from "@/server/auth/session";
import { getDb, getSqlite, resolveDbPath } from "@/server/db/client";
import * as t from "@/server/db/schema";

const SESSION_COOKIE = "buildesk_session";

/** Keep this many dated backups (auto + manual). Oldest files pruned after each create. */
export const DB_BACKUP_RETENTION = 30;

const BACKUP_NAME_RE = /^buildesk-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(?:-manual)?\.db$/;

export type DbBackupInfo = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  kind: "auto" | "manual";
  downloadUrl: string;
};

export function resolveBackupsDir() {
  return path.join(path.dirname(resolveDbPath()), "backups");
}

function ensureBackupsDir() {
  const dir = resolveBackupsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stampForFilename(date = new Date()) {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
}

function assertSafeBackupFilename(filename: string) {
  const base = path.basename(filename);
  if (base !== filename || !BACKUP_NAME_RE.test(base)) {
    throw new ApiError(400, "Invalid backup filename");
  }
  return base;
}

function resolveBackupPath(filename: string) {
  const safe = assertSafeBackupFilename(filename);
  const dir = ensureBackupsDir();
  const fullPath = path.join(dir, safe);
  if (!fullPath.startsWith(dir + path.sep) && fullPath !== dir) {
    throw new ApiError(400, "Invalid backup path");
  }
  return fullPath;
}

function mapBackupFile(filename: string, fullPath: string): DbBackupInfo {
  const stat = fs.statSync(fullPath);
  const kind = filename.includes("-manual.db") ? "manual" : "auto";
  return {
    filename,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
    kind,
    downloadUrl: `/api/db-backups/${encodeURIComponent(filename)}`,
  };
}

export function listDbBackupFiles(): DbBackupInfo[] {
  const dir = ensureBackupsDir();
  const files = fs
    .readdirSync(dir)
    .filter((name) => BACKUP_NAME_RE.test(name))
    .map((filename) => {
      try {
        return mapBackupFile(filename, path.join(dir, filename));
      } catch {
        return null;
      }
    })
    .filter((row): row is DbBackupInfo => Boolean(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return files;
}

function pruneOldBackups(keep = DB_BACKUP_RETENTION) {
  const files = listDbBackupFiles();
  for (const file of files.slice(keep)) {
    try {
      fs.unlinkSync(resolveBackupPath(file.filename));
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Consistent snapshot of the live SQLite DB (safe with WAL).
 * Uses better-sqlite3 backup API when available, otherwise VACUUM INTO.
 */
export async function createDbBackupFile(opts?: {
  kind?: "auto" | "manual";
}): Promise<DbBackupInfo> {
  const kind = opts?.kind ?? "manual";
  const dir = ensureBackupsDir();
  const stamp = stampForFilename();
  const filename =
    kind === "manual" ? `buildesk-${stamp}-manual.db` : `buildesk-${stamp}.db`;
  const dest = path.join(dir, filename);

  if (fs.existsSync(dest)) {
    throw new ApiError(409, "A backup with this timestamp already exists — try again in a second");
  }

  const livePath = resolveDbPath();
  if (!fs.existsSync(livePath)) {
    throw new ApiError(404, "Live database file not found");
  }

  const sqlite = getSqlite();
  try {
    const backupFn = (sqlite as unknown as { backup?: (dest: string) => Promise<void> | void })
      .backup;
    if (typeof backupFn === "function") {
      await Promise.resolve(backupFn.call(sqlite, dest));
    } else {
      // Escape single quotes for SQL path
      const escaped = dest.replace(/'/g, "''");
      sqlite.exec(`VACUUM INTO '${escaped}'`);
    }
  } catch (err) {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    throw new ApiError(
      500,
      err instanceof Error ? `Backup failed: ${err.message}` : "Backup failed",
    );
  }

  if (!fs.existsSync(dest) || fs.statSync(dest).size <= 0) {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    throw new ApiError(500, "Backup file was not created");
  }

  pruneOldBackups();
  return mapBackupFile(filename, dest);
}

export function deleteDbBackupFile(filename: string) {
  const fullPath = resolveBackupPath(filename);
  if (!fs.existsSync(fullPath)) throw new ApiError(404, "Backup not found");
  fs.unlinkSync(fullPath);
  return { ok: true as const };
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

/** Admin-only binary download of a dated database backup. */
export async function handleDbBackupRequest(request: Request): Promise<Response> {
  const user = readSessionUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "Admin") return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const prefix = "/api/db-backups/";
  if (!url.pathname.startsWith(prefix)) {
    return new Response("Not found", { status: 404 });
  }

  const filename = decodeURIComponent(url.pathname.slice(prefix.length));
  let fullPath: string;
  try {
    fullPath = resolveBackupPath(filename);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (!fs.existsSync(fullPath)) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = fs.readFileSync(fullPath);
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`;
  return new Response(buffer, {
    status: 200,
    headers: {
      "content-type": "application/x-sqlite3",
      "content-disposition": disposition,
      "cache-control": "private, no-store",
      "content-length": String(buffer.length),
    },
  });
}
