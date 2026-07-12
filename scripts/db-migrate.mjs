import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import Database from "better-sqlite3";

const require = createRequire(import.meta.url);

function resolveDbPath() {
  const fromEnv = process.env.DATABASE_URL?.replace(/^file:/, "");
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR, "buildesk.db");
  }
  return path.resolve(process.cwd(), "data", "buildesk.db");
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const migrationsFolder = path.resolve(process.cwd(), "drizzle");
const journalPath = path.join(migrationsFolder, "meta", "_journal.json");

if (!fs.existsSync(journalPath)) {
  console.error("No migrations found. Run: npm run db:generate");
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
  entries: { tag: string }[];
};

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at INTEGER
  );
`);

const applied = new Set(
  sqlite.prepare("SELECT hash FROM __drizzle_migrations").all().map((r) => (r as { hash: string }).hash),
);

for (const entry of journal.entries) {
  if (applied.has(entry.tag)) continue;
  const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Missing migration file: ${sqlPath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  sqlite.exec(sql);
  sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(entry.tag, Date.now());
  console.log(`Applied ${entry.tag}`);
}

console.log(`Database ready at ${dbPath}`);
sqlite.close();
