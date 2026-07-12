/**
 * Idempotent SQLite schema sync — safer than drizzle-kit push for ADD COLUMN.
 * Usage: npm run db:ensure
 */
import { getSqlite } from "../src/server/db/client";

type Col = { name: string; ddl: string };

const PROJECT_COLUMNS: Col[] = [
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

function existingColumns(table: string): Set<string> {
  const sqlite = getSqlite();
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function tableExists(table: string): boolean {
  const sqlite = getSqlite();
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

function ensureProjectColumns() {
  const sqlite = getSqlite();
  if (!tableExists("projects")) {
    console.log("projects table missing — run npm run db:push once on a fresh DB, or restore from backup.");
    process.exit(1);
  }

  const have = existingColumns("projects");
  let added = 0;
  for (const col of PROJECT_COLUMNS) {
    if (have.has(col.name)) continue;
    const sql = `ALTER TABLE projects ADD COLUMN ${col.name} ${col.ddl}`;
    console.log(`+ ${sql}`);
    sqlite.exec(sql);
    added += 1;
  }
  if (added === 0) {
    console.log("projects: schema already up to date");
  } else {
    console.log(`projects: added ${added} column(s)`);
  }
}

ensureProjectColumns();
console.log("db:ensure complete");
