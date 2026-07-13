#!/usr/bin/env node
/**
 * Idempotent SQLite schema sync — safe ALTER TABLE for missing columns.
 * Usage: npm run db:ensure
 * No tsx required (works with production installs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadDotEnv() {
  try {
    const envPath = path.join(root, ".env");
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
  const fromEnv = process.env.DATABASE_URL?.replace(/^file:/, "");
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(root, fromEnv);
  }
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR, "buildesk.db");
  }
  return path.resolve(root, "data", "buildesk.db");
}

/** @type {{ name: string, ddl: string }[]} */
const PROJECT_COLUMNS = [
  { name: "address", ddl: "TEXT" },
  { name: "state", ddl: "TEXT" },
  { name: "pin_code", ddl: "TEXT" },
  { name: "total_towers", ddl: "INTEGER" },
  { name: "total_floors", ddl: "INTEGER" },
  { name: "agreement_value", ddl: "INTEGER" },
  { name: "other_charges_json", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: "custom_charges_json", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: "logo_url", ddl: "TEXT" },
];

const dbPath = resolveDbPath();
console.log(`Database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error("Database file not found. Create schema first (npm run db:push) or check DATABASE_URL.");
  process.exit(1);
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

function tableExists(table) {
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  return Boolean(row);
}

function existingColumns(table) {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  return new Set(rows.map((r) => r.name));
}

if (!tableExists("projects")) {
  console.error("projects table missing — run npm run db:push on a fresh DB first.");
  process.exit(1);
}

const have = existingColumns("projects");
let added = 0;
for (const col of PROJECT_COLUMNS) {
  if (have.has(col.name)) continue;
  const sql = `ALTER TABLE projects ADD COLUMN ${col.name} ${col.ddl}`;
  console.log(`+ ${sql}`);
  try {
    sqlite.exec(sql);
    added += 1;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column")) {
      console.log(`  (already exists)`);
    } else {
      throw e;
    }
  }
}

if (added === 0) {
  console.log("projects: schema already up to date");
} else {
  console.log(`projects: added ${added} column(s)`);
}

/** @type {{ table: string, name: string, ddl: string }[]} */
const EXTRA_COLUMNS = [
  {
    table: "onboarding_checklist_items",
    name: "not_applicable",
    ddl: "INTEGER NOT NULL DEFAULT 0",
  },
];

for (const col of EXTRA_COLUMNS) {
  if (!tableExists(col.table)) {
    console.log(`skip ${col.table}.${col.name} (table missing)`);
    continue;
  }
  const cols = existingColumns(col.table);
  if (cols.has(col.name)) {
    console.log(`${col.table}: ${col.name} already present`);
    continue;
  }
  const sql = `ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.ddl}`;
  console.log(`+ ${sql}`);
  sqlite.exec(sql);
}

sqlite.close();
console.log("db:ensure complete");
