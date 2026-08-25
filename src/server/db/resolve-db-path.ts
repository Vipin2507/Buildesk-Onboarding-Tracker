import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let projectRoot: string | null = null;

/** Repo root — works when Nitro runs from `.output/` or PM2 uses a nested cwd. */
export function getProjectRoot() {
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

/** Load `.env` from the app directory; never override vars already set by PM2/shell. */
export function loadAppDotEnv() {
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

/**
 * Single source of truth for SQLite location.
 * Production VPS: use an absolute DATABASE_URL outside htdocs, e.g.
 * `file:/home/buildesk-track/data/buildesk.db`
 */
export function resolveDbPath() {
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
