import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import Database from "better-sqlite3";
import { and, eq, gt } from "drizzle-orm";

import { ApiError, nowIso, toPublicUser } from "@/server/auth/session";
import { closeSqliteConnection, getDb, getSqlite, resolveDbPath } from "@/server/db/client";
import * as t from "@/server/db/schema";

const SESSION_COOKIE = "buildesk_session";

/** Keep this many dated backups (auto + manual). Oldest files pruned after each create. */
export const DB_BACKUP_RETENTION = 30;

const BACKUP_NAME_RE = /^buildesk-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(?:-manual)?\.db$/;
const SQLITE_HEADER = "SQLite format 3";
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024; // 512 MB

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

function assertValidBuildeskSqliteFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new ApiError(400, "Database file not found");
  }
  const size = fs.statSync(filePath).size;
  if (size < 100) {
    throw new ApiError(400, "File is too small to be a SQLite database");
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, "Database file is too large (max 512 MB)");
  }

  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    if (header.toString("utf8", 0, 15) !== SQLITE_HEADER) {
      throw new ApiError(400, "File is not a valid SQLite database");
    }
  } finally {
    fs.closeSync(fd);
  }

  let probe: Database.Database | null = null;
  try {
    probe = new Database(filePath, { readonly: true, fileMustExist: true });
    const row = probe
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('users', 'companies', 'crm_accounts')
         LIMIT 1`,
      )
      .get() as { name?: string } | undefined;
    if (!row?.name) {
      throw new ApiError(400, "Not a Buildesk database (missing core tables)");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      400,
      err instanceof Error ? `Invalid SQLite file: ${err.message}` : "Invalid SQLite file",
    );
  } finally {
    try {
      probe?.close();
    } catch {
      /* ignore */
    }
  }
}

function removeLiveWalSidecars(livePath: string) {
  for (const suffix of ["-wal", "-shm"]) {
    const side = `${livePath}${suffix}`;
    try {
      if (fs.existsSync(side)) fs.unlinkSync(side);
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Replace the live database with `sourcePath` (validated SQLite).
 * Creates a safety backup of the current DB first. Returns that backup info.
 */
export async function replaceLiveDatabaseFromFile(
  sourcePath: string,
  opts?: { skipSafetyBackup?: boolean },
): Promise<{ safetyBackup: DbBackupInfo | null; liveDbPath: string }> {
  assertValidBuildeskSqliteFile(sourcePath);

  let safetyBackup: DbBackupInfo | null = null;
  if (!opts?.skipSafetyBackup) {
    try {
      safetyBackup = await createDbBackupFile({ kind: "manual" });
    } catch (err) {
      // If live DB is missing/corrupt, still allow replace without safety backup.
      console.warn(
        "[db-restore] safety backup failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const livePath = resolveDbPath();
  fs.mkdirSync(path.dirname(livePath), { recursive: true });

  closeSqliteConnection();
  try {
    fs.copyFileSync(sourcePath, livePath);
    removeLiveWalSidecars(livePath);
  } catch (err) {
    // Try to reopen whatever is on disk so the process stays usable.
    try {
      getSqlite();
    } catch {
      /* ignore */
    }
    throw new ApiError(
      500,
      err instanceof Error
        ? `Failed to replace database: ${err.message}`
        : "Failed to replace database",
    );
  }

  // Re-open against the new file
  getSqlite();
  return { safetyBackup, liveDbPath: livePath };
}

/** Restore live DB from a dated backup in data/backups. */
export async function restoreDbFromBackupFilename(filename: string) {
  const fullPath = resolveBackupPath(filename);
  if (!fs.existsSync(fullPath)) throw new ApiError(404, "Backup not found");
  return replaceLiveDatabaseFromFile(fullPath);
}

/** Write an uploaded buffer to a temp file, validate, then replace live DB. */
export async function restoreDbFromUploadedBuffer(buffer: Buffer, originalName?: string) {
  if (buffer.byteLength <= 0) throw new ApiError(400, "Empty upload");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, "Database file is too large (max 512 MB)");
  }
  const ext = path.extname(originalName ?? "").toLowerCase();
  if (ext && ext !== ".db" && ext !== ".sqlite" && ext !== ".sqlite3") {
    throw new ApiError(400, "Upload a .db / .sqlite file");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "buildesk-db-upload-"));
  const tmpPath = path.join(tmpDir, "upload.db");
  try {
    fs.writeFileSync(tmpPath, buffer);
    return await replaceLiveDatabaseFromFile(tmpPath);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
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

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}

/** Admin-only download / restore / upload-replace for database backups. */
export async function handleDbBackupRequest(request: Request): Promise<Response> {
  const user = readSessionUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "Admin") return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const prefix = "/api/db-backups/";
  if (!url.pathname.startsWith(prefix)) {
    return new Response("Not found", { status: 404 });
  }

  const rest = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/\/+$/, "");

  if (request.method === "POST" && rest === "restore-upload") {
    try {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return jsonError(400, "Missing file field");
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await restoreDbFromUploadedBuffer(buffer, file.name);
      return new Response(
        JSON.stringify({
          ok: true,
          liveDbPath: result.liveDbPath,
          safetyBackup: result.safetyBackup,
          message: "Database replaced. Reload the app to use the new data.",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "private, no-store" },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload restore failed";
      const status = err instanceof ApiError ? err.status : 500;
      return jsonError(status, message);
    }
  }

  if (request.method === "POST" && rest === "restore") {
    try {
      const body = (await request.json()) as { filename?: string };
      if (!body?.filename?.trim()) return jsonError(400, "filename is required");
      const result = await restoreDbFromBackupFilename(body.filename.trim());
      return new Response(
        JSON.stringify({
          ok: true,
          liveDbPath: result.liveDbPath,
          safetyBackup: result.safetyBackup,
          message: "Database restored. Reload the app to use the new data.",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "private, no-store" },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Restore failed";
      const status = err instanceof ApiError ? err.status : 500;
      return jsonError(status, message);
    }
  }

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const filename = rest;
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
