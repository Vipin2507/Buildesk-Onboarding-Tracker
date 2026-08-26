#!/usr/bin/env node
/**
 * Quick web-push / task-reminder diagnostics against production SQLite.
 * Usage: node scripts/check-web-push.mjs
 */
import Database from "better-sqlite3";

import { loadAppDotEnv, resolveDbPath } from "./lib/resolve-db-path.mjs";

loadAppDotEnv();

const dbPath = resolveDbPath();
console.log(`Database: ${dbPath}\n`);

const db = new Database(dbPath, { readonly: true });

function tableExists(name) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
}

console.log("=== Environment (from .env) ===");
console.log("VAPID_PUBLIC_KEY:", process.env.VAPID_PUBLIC_KEY ? "set" : "MISSING");
console.log("VAPID_PRIVATE_KEY:", process.env.VAPID_PRIVATE_KEY ? "set" : "MISSING");
console.log("DATABASE_URL:", process.env.DATABASE_URL ?? "(default)");

console.log("\n=== CRM settings (app_config.crm-settings) ===");
const cfg = db.prepare("SELECT value_json FROM app_config WHERE key='crm-settings'").get();
if (!cfg) {
  console.log("MISSING — admin must save Email & Alerts settings after deploy");
} else {
  try {
    const parsed = JSON.parse(cfg.value_json);
    const n = parsed.notifications ?? {};
    console.log("taskReminderWebPushEnabled:", n.taskReminderWebPushEnabled ?? false);
    console.log("taskReminderWebPushMinutesBefore:", n.taskReminderWebPushMinutesBefore ?? "(default 15)");
    console.log("quietHoursEnabled:", n.quietHoursEnabled ?? false);
    console.log("quietHoursStart:", n.quietHoursStart ?? "?");
    console.log("quietHoursEnd:", n.quietHoursEnd ?? "?");
  } catch (e) {
    console.log("Invalid JSON:", e.message);
  }
}

console.log("\n=== Push subscriptions ===");
if (!tableExists("push_subscriptions")) {
  console.log("Table push_subscriptions MISSING — run: npm run db:ensure");
} else {
  const subs = db
    .prepare(
      "SELECT user_id, substr(endpoint, 1, 55) AS endpoint, created_at FROM push_subscriptions ORDER BY created_at DESC",
    )
    .all();
  console.log(`Count: ${subs.length}`);
  for (const row of subs) {
    console.log(`  user=${row.user_id} endpoint=${row.endpoint}… created=${row.created_at}`);
  }
}

console.log("\n=== Upcoming scheduled tasks ===");
const tasks = db
  .prepare(
    `SELECT id, title, starts_at, status, assignee_user_id, assignee_user_ids_json
     FROM follow_up_tasks
     WHERE starts_at IS NOT NULL
     ORDER BY starts_at DESC
     LIMIT 8`,
  )
  .all();
for (const row of tasks) {
  console.log(
    `  ${row.starts_at} [${row.status}] ${row.title} assignee=${row.assignee_user_id ?? row.assignee_user_ids_json ?? "none"}`,
  );
}

console.log("\n=== Recent web-push reminders sent ===");
if (tableExists("automation_reminders_sent")) {
  const sent = db
    .prepare(
      `SELECT task_id, assignee_user_id, starts_at, sent_at
       FROM automation_reminders_sent
       WHERE rule_id='crm-web-push'
       ORDER BY sent_at DESC
       LIMIT 5`,
    )
    .all();
  console.log(`Count (last 5): ${sent.length}`);
  for (const row of sent) {
    console.log(`  task=${row.task_id} assignee=${row.assignee_user_id} at=${row.sent_at}`);
  }
}

db.close();
console.log("\nDone.");
