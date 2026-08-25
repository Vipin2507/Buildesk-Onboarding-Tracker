import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

let projectRoot: string | null = null;

/** Resolve repo root even when Nitro/Vite run with cwd under `.output/`. */
function getProjectRoot() {
  if (projectRoot) return projectRoot;
  const startDir = (() => {
    try {
      return path.dirname(fileURLToPath(import.meta.url));
    } catch {
      return process.cwd();
    }
  })();
  let dir = startDir;
  for (;;) {
    const hasPkg = fs.existsSync(path.join(dir, "package.json"));
    const hasVite = fs.existsSync(path.join(dir, "vite.config.ts"));
    const hasDataDb = fs.existsSync(path.join(dir, "data", "buildesk.db"));
    if (hasPkg && (hasVite || hasDataDb)) {
      projectRoot = dir;
      return projectRoot;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  projectRoot = process.cwd();
  return projectRoot;
}

function loadDotEnv() {
  try {
    const envPath = path.resolve(getProjectRoot(), ".env");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadDotEnv();

function resolveDbPath() {
  const root = getProjectRoot();
  const fromEnv = process.env.DATABASE_URL?.replace(/^file:/, "");
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(root, fromEnv);
  }
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR, "buildesk.db");
  }
  return path.resolve(root, "data", "buildesk.db");
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function getSqlite() {
  if (_sqlite) return _sqlite;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  return _sqlite;
}

export function getDb() {
  if (_db) return _db;
  _db = drizzle(getSqlite(), { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
