import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";
import { getProjectRoot, loadAppDotEnv, resolveDbPath } from "./resolve-db-path";

loadAppDotEnv();

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;
let _loggedDbPath = false;

export { getProjectRoot, resolveDbPath };

export function getSqlite() {
  if (_sqlite) return _sqlite;
  const dbPath = resolveDbPath();
  if (!_loggedDbPath) {
    console.log(`[buildesk] SQLite database: ${dbPath}`);
    _loggedDbPath = true;
  }
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
