#!/usr/bin/env node
/**
 * Idempotent SQLite schema sync — safe ALTER TABLE for missing columns.
 * Usage: npm run db:ensure
 * No tsx required (works with production installs).
 */
import fs from "node:fs";
import Database from "better-sqlite3";

import { loadAppDotEnv, resolveDbPath } from "./lib/resolve-db-path.mjs";

loadAppDotEnv();

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
  { name: "start_date", ddl: "TEXT" },
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
  {
    table: "onboarding_checklist_items",
    name: "source",
    ddl: "TEXT NOT NULL DEFAULT 'default'",
  },
  {
    table: "onboarding_checklist_items",
    name: "collected_at",
    ddl: "TEXT",
  },
  {
    table: "onboarding_checklist_items",
    name: "uploaded_at",
    ddl: "TEXT",
  },
  {
    table: "onboarding_checklist_items",
    name: "live_at",
    ddl: "TEXT",
  },
  {
    table: "onboarding_checklist_items",
    name: "assignee_user_id",
    ddl: "TEXT",
  },
  {
    table: "onboarding_checklist_items",
    name: "due_date",
    ddl: "TEXT",
  },
  {
    table: "project_manual_progress",
    name: "not_applicable_json",
    ddl: "TEXT NOT NULL DEFAULT '{}'",
  },
  {
    table: "companies",
    name: "start_date",
    ddl: "TEXT",
  },
  {
    table: "tickets",
    name: "description",
    ddl: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "tickets",
    name: "project_id",
    ddl: "TEXT",
  },
  {
    table: "tickets",
    name: "assigned_user_id",
    ddl: "TEXT",
  },
  {
    table: "tickets",
    name: "action_taken",
    ddl: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "tickets",
    name: "backend_assigned",
    ddl: "INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "tickets",
    name: "backend_assignee_id",
    ddl: "TEXT",
  },
  {
    table: "tickets",
    name: "backend_forwarded_at",
    ddl: "TEXT",
  },
  {
    table: "tickets",
    name: "resolution_status",
    ddl: "TEXT NOT NULL DEFAULT 'Not Resolved'",
  },
  {
    table: "tickets",
    name: "resolution_at",
    ddl: "TEXT",
  },
  {
    table: "tickets",
    name: "eta_revised_at",
    ddl: "TEXT",
  },
  {
    table: "tickets",
    name: "resolution_notes",
    ddl: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "companies",
    name: "region",
    ddl: "TEXT NOT NULL DEFAULT 'Rest of India'",
  },
  {
    table: "companies",
    name: "owner_name",
    ddl: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "companies",
    name: "owner_mobile",
    ddl: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "companies",
    name: "poc_name",
    ddl: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "companies",
    name: "poc_mobile",
    ddl: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "company_modules",
    name: "live_at",
    ddl: "TEXT",
  },
  {
    table: "company_modules",
    name: "poc_name",
    ddl: "TEXT",
  },
  {
    table: "company_modules",
    name: "poc_mobile",
    ddl: "TEXT",
  },
  {
    table: "projects",
    name: "poc_name",
    ddl: "TEXT",
  },
  {
    table: "projects",
    name: "poc_mobile",
    ddl: "TEXT",
  },
  {
    table: "companies",
    name: "sales_agent_id",
    ddl: "TEXT",
  },
  { table: "companies", name: "company_type", ddl: "TEXT" },
  { table: "companies", name: "state", ddl: "TEXT" },
  { table: "companies", name: "support_manager_1_id", ddl: "TEXT" },
  { table: "companies", name: "support_manager_2_id", ddl: "TEXT" },
  { table: "companies", name: "additional_support_contact_ids_json", ddl: "TEXT" },
  { table: "companies", name: "annual_license", ddl: "INTEGER" },
  { table: "companies", name: "deal_size", ddl: "TEXT" },
  { table: "companies", name: "users_purchased", ddl: "INTEGER" },
  { table: "companies", name: "total_cost", ddl: "TEXT" },
  { table: "companies", name: "payment_received", ddl: "TEXT" },
  { table: "companies", name: "pending_amount", ddl: "TEXT" },
  { table: "companies", name: "end_date", ddl: "TEXT" },
  { table: "companies", name: "payment_history_json", ddl: "TEXT" },
  { table: "users", name: "product_scope", ddl: "TEXT NOT NULL DEFAULT 'erp'" },
  { table: "users", name: "work_email", ddl: "TEXT" },
  { table: "booking_appointments", name: "google_event_id", ddl: "TEXT" },
  { table: "booking_appointments", name: "meet_url", ddl: "TEXT" },
  {
    table: "booking_appointments",
    name: "google_sync_status",
    ddl: "TEXT NOT NULL DEFAULT 'none'",
  },
  { table: "booking_appointments", name: "google_sync_error", ddl: "TEXT" },
  {
    table: "booking_appointments",
    name: "additional_guest_emails_json",
    ddl: "TEXT NOT NULL DEFAULT '[]'",
  },
  { table: "follow_up_tasks", name: "task_type", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "start_time", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "end_time", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "starts_at", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "ends_at", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "duration_minutes", ddl: "INTEGER" },
  { table: "follow_up_tasks", name: "extra_time_minutes", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "follow_up_tasks", name: "latest_remark", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "assignee_user_ids_json", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "follow_up_tasks", name: "completed_by_user_id", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "source", ddl: "TEXT NOT NULL DEFAULT 'manual'" },
  { table: "follow_up_tasks", name: "booking_appointment_id", ddl: "TEXT" },
  { table: "follow_up_tasks", name: "product_scope", ddl: "TEXT NOT NULL DEFAULT 'erp'" },
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

if (!tableExists("notifications")) {
  sqlite.exec(`
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'info',
      href TEXT,
      read_at TEXT,
      company_id TEXT,
      ticket_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications(created_at);
  `);
  console.log("+ CREATE TABLE notifications");
} else {
  console.log("notifications: table already present");
}

if (tableExists("tickets") && !tableExists("ticket_activities")) {
  sqlite.exec(`
    CREATE TABLE ticket_activities (
      id TEXT PRIMARY KEY NOT NULL,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor_user_id TEXT,
      actor_name TEXT NOT NULL,
      remark TEXT,
      old_values_json TEXT,
      new_values_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ticket_activities_ticket_idx ON ticket_activities(ticket_id);
    CREATE INDEX IF NOT EXISTS ticket_activities_created_idx ON ticket_activities(created_at);
  `);
  console.log("+ CREATE TABLE ticket_activities");
}

if (tableExists("onboarding_checklist_items")) {
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS checklist_assignee_idx ON onboarding_checklist_items(assignee_user_id);
    CREATE INDEX IF NOT EXISTS checklist_due_idx ON onboarding_checklist_items(due_date);
  `);
}

// Backfill ticket.project_id from company projects when missing
if (tableExists("tickets") && tableExists("projects")) {
  const orphan = sqlite
    .prepare(
      `SELECT id, company_id FROM tickets WHERE (project_id IS NULL OR project_id = '') AND company_id IS NOT NULL AND company_id != ''`,
    )
    .all();
  let filled = 0;
  const pickProject = sqlite.prepare(
    `SELECT id FROM projects WHERE company_id = ? ORDER BY id LIMIT 1`,
  );
  const setProject = sqlite.prepare(`UPDATE tickets SET project_id = ? WHERE id = ?`);
  for (const row of orphan) {
    const proj = pickProject.get(row.company_id);
    if (!proj?.id) continue;
    setProject.run(proj.id, row.id);
    filled += 1;
  }
  if (filled > 0) console.log(`tickets: backfilled project_id on ${filled} row(s)`);
}

// Migrate legacy company plans → Annual / Half-Yearly / AMC
if (tableExists("companies")) {
  const planMap = [
    ["Starter", "Annual"],
    ["Growth", "Half-Yearly"],
    ["Enterprise", "AMC"],
  ];
  let planChanges = 0;
  for (const [from, to] of planMap) {
    const r = sqlite.prepare(`UPDATE companies SET plan = ? WHERE plan = ?`).run(to, from);
    planChanges += r.changes;
  }
  if (planChanges > 0) console.log(`companies: migrated plan on ${planChanges} row(s)`);

  // Default POC from legacy contact/phone when empty
  const poc = sqlite
    .prepare(
      `UPDATE companies SET poc_name = contact WHERE (poc_name IS NULL OR poc_name = '') AND contact IS NOT NULL AND contact != ''`,
    )
    .run();
  if (poc.changes > 0) console.log(`companies: backfilled poc_name on ${poc.changes} row(s)`);
  const pocPhone = sqlite
    .prepare(
      `UPDATE companies SET poc_mobile = phone WHERE (poc_mobile IS NULL OR poc_mobile = '') AND phone IS NOT NULL AND phone != ''`,
    )
    .run();
  if (pocPhone.changes > 0) console.log(`companies: backfilled poc_mobile on ${pocPhone.changes} row(s)`);

  // Heuristic region from city when still at default
  const cities = sqlite.prepare(`SELECT id, city, region FROM companies`).all();
  const setRegion = sqlite.prepare(`UPDATE companies SET region = ? WHERE id = ?`);
  let regionChanges = 0;
  for (const row of cities) {
    if (row.region && row.region !== "Rest of India") continue;
    const c = String(row.city || "").toLowerCase();
    let region = "Rest of India";
    if (["delhi", "gurugram", "gurgaon", "noida", "faridabad", "ghaziabad"].some((x) => c.includes(x))) {
      region = "NCR";
    } else if (
      ["bengaluru", "bangalore", "chennai", "hyderabad", "kochi", "coimbatore"].some((x) =>
        c.includes(x),
      )
    ) {
      region = "South";
    } else if (["mumbai", "pune", "ahmedabad", "surat", "nagpur", "goa"].some((x) => c.includes(x))) {
      region = "West";
    }
    if (region !== "Rest of India" || !row.region) {
      setRegion.run(region, row.id);
      regionChanges += 1;
    }
  }
  if (regionChanges > 0) console.log(`companies: backfilled region on ${regionChanges} row(s)`);
}

// Backfill start dates for existing rows
if (tableExists("companies")) {
  const r = sqlite
    .prepare(
      `UPDATE companies SET start_date = agreement_date WHERE start_date IS NULL OR start_date = ''`,
    )
    .run();
  if (r.changes > 0) console.log(`companies: backfilled start_date on ${r.changes} row(s)`);
}
if (tableExists("projects")) {
  const r = sqlite
    .prepare(
      `UPDATE projects SET start_date = substr(created_at, 1, 10) WHERE (start_date IS NULL OR start_date = '') AND created_at IS NOT NULL`,
    )
    .run();
  if (r.changes > 0) console.log(`projects: backfilled start_date on ${r.changes} row(s)`);
}

/** One-shot: clear auto-seeded checklist ticks that were never manually edited. */
if (tableExists("onboarding_checklist_items")) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _schema_patches (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  const patch = "reset_untouched_checklist_progress_v1";
  const done = sqlite.prepare(`SELECT 1 AS ok FROM _schema_patches WHERE name = ?`).get(patch);
  if (!done) {
    const r = sqlite
      .prepare(
        `UPDATE onboarding_checklist_items
         SET collected = 0, uploaded = 0, live = 0
         WHERE created_at = updated_at
           AND (collected = 1 OR uploaded = 1 OR live = 1)`,
      )
      .run();
    sqlite
      .prepare(`INSERT INTO _schema_patches (name, applied_at) VALUES (?, ?)`)
      .run(patch, new Date().toISOString());
    console.log(
      `checklist: reset untouched fake progress on ${r.changes} item(s) (${patch})`,
    );
  }

  const restructure = "checklist_restructure_v2";
  const restructureDone = sqlite
    .prepare(`SELECT 1 AS ok FROM _schema_patches WHERE name = ?`)
    .get(restructure);
  if (!restructureDone) {
    const renames = [
      ["unit", "Unit configuration Excel uploaded", "Unit Detail Uploaded"],
      ["customer", "Customer data Excel uploaded", "Excel Uploaded"],
      ["payment", "Payment data uploaded", "Uploaded"],
    ];
    for (const [section, from, to] of renames) {
      sqlite
        .prepare(
          `UPDATE onboarding_checklist_items SET label = ? WHERE section = ? AND label = ? AND IFNULL(source, 'default') = 'default'`,
        )
        .run(to, section, from);
    }
    const obsolete = [
      "Tower/floor plan mapped",
      "Unit types validated",
      "Pricing sheet locked",
      "Duplicate check completed",
      "KYC linked",
      "Contact numbers verified",
      "Payment plans defined",
      "Booking data uploaded",
      "Ledger reconciled",
      "Website form integrated",
      "Handover to CSM",
      "Unit configuration Excel uploaded",
      "Customer data Excel uploaded",
      "Payment data uploaded",
    ];
    const del = sqlite
      .prepare(
        `DELETE FROM onboarding_checklist_items
         WHERE IFNULL(source, 'default') = 'default'
           AND label IN (${obsolete.map(() => "?").join(",")})`,
      )
      .run(...obsolete);
    // Backfill phase dates from updated_at where phase is on but date missing
    sqlite
      .prepare(
        `UPDATE onboarding_checklist_items SET collected_at = updated_at WHERE collected = 1 AND collected_at IS NULL`,
      )
      .run();
    sqlite
      .prepare(
        `UPDATE onboarding_checklist_items SET uploaded_at = updated_at WHERE uploaded = 1 AND uploaded_at IS NULL`,
      )
      .run();
    sqlite
      .prepare(
        `UPDATE onboarding_checklist_items SET live_at = updated_at WHERE live = 1 AND live_at IS NULL`,
      )
      .run();
    sqlite
      .prepare(`INSERT INTO _schema_patches (name, applied_at) VALUES (?, ?)`)
      .run(restructure, new Date().toISOString());
    console.log(`checklist: restructure removed ${del.changes} obsolete item(s) (${restructure})`);
  }
}

/** CRM tables: subscriptions, tasks, visits, events */
function ensureCrmTables() {
  if (!tableExists("module_subscriptions")) {
    sqlite.exec(`
      CREATE TABLE module_subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        module_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'inactive',
        start_date TEXT NOT NULL,
        valid_until TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS module_subscriptions_company_idx ON module_subscriptions(company_id);
      CREATE UNIQUE INDEX IF NOT EXISTS module_subscriptions_company_key_uidx ON module_subscriptions(company_id, module_key);
      CREATE INDEX IF NOT EXISTS module_subscriptions_status_idx ON module_subscriptions(status);
    `);
    console.log("+ CREATE TABLE module_subscriptions");
  }

  if (!tableExists("module_subscription_events")) {
    sqlite.exec(`
      CREATE TABLE module_subscription_events (
        id TEXT PRIMARY KEY NOT NULL,
        subscription_id TEXT NOT NULL REFERENCES module_subscriptions(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        module_key TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        previous_start_date TEXT,
        new_start_date TEXT,
        previous_valid_until TEXT,
        new_valid_until TEXT,
        actor_user_id TEXT,
        actor_name TEXT NOT NULL,
        reason TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS module_subscription_events_sub_idx ON module_subscription_events(subscription_id);
      CREATE INDEX IF NOT EXISTS module_subscription_events_company_idx ON module_subscription_events(company_id);
    `);
    console.log("+ CREATE TABLE module_subscription_events");
  }

  if (!tableExists("follow_up_tasks")) {
    sqlite.exec(`
      CREATE TABLE follow_up_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        onboarding_project_id TEXT,
        post_sales_project_id TEXT,
        source_visit_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        progress_percent INTEGER NOT NULL DEFAULT 0,
        due_date TEXT,
        task_type TEXT,
        start_time TEXT,
        end_time TEXT,
        starts_at TEXT,
        ends_at TEXT,
        duration_minutes INTEGER,
        assignee_user_id TEXT,
        assignee_user_ids_json TEXT NOT NULL DEFAULT '[]',
        created_by_user_id TEXT,
        completed_at TEXT,
        completed_by_user_id TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        booking_appointment_id TEXT,
        product_scope TEXT NOT NULL DEFAULT 'erp',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS follow_up_tasks_company_idx ON follow_up_tasks(company_id);
      CREATE INDEX IF NOT EXISTS follow_up_tasks_scope_idx ON follow_up_tasks(product_scope);
      CREATE INDEX IF NOT EXISTS follow_up_tasks_assignee_idx ON follow_up_tasks(assignee_user_id);
      CREATE INDEX IF NOT EXISTS follow_up_tasks_status_idx ON follow_up_tasks(status);
      CREATE INDEX IF NOT EXISTS follow_up_tasks_due_idx ON follow_up_tasks(due_date);
      CREATE INDEX IF NOT EXISTS follow_up_tasks_starts_idx ON follow_up_tasks(starts_at);
      CREATE INDEX IF NOT EXISTS follow_up_tasks_booking_idx ON follow_up_tasks(booking_appointment_id);
    `);
    console.log("+ CREATE TABLE follow_up_tasks");
  }

  if (!tableExists("client_visits")) {
    sqlite.exec(`
      CREATE TABLE client_visits (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        onboarding_project_id TEXT,
        post_sales_project_id TEXT,
        scheduled_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        visit_type TEXT,
        purpose TEXT NOT NULL,
        location TEXT,
        assigned_user_id TEXT,
        contact_name TEXT,
        contact_phone TEXT,
        outcome TEXT,
        remarks TEXT,
        notes TEXT,
        next_action TEXT,
        next_follow_up_date TEXT,
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS client_visits_company_idx ON client_visits(company_id);
      CREATE INDEX IF NOT EXISTS client_visits_assigned_idx ON client_visits(assigned_user_id);
      CREATE INDEX IF NOT EXISTS client_visits_status_idx ON client_visits(status);
      CREATE INDEX IF NOT EXISTS client_visits_scheduled_idx ON client_visits(scheduled_at);
    `);
    console.log("+ CREATE TABLE client_visits");
  }

  if (!tableExists("crm_events")) {
    sqlite.exec(`
      CREATE TABLE crm_events (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        task_id TEXT,
        visit_id TEXT,
        subscription_id TEXT,
        event_type TEXT NOT NULL,
        actor_user_id TEXT,
        actor_name TEXT NOT NULL,
        remark TEXT,
        old_values_json TEXT,
        new_values_json TEXT,
        progress_percent INTEGER,
        due_date TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS crm_events_company_idx ON crm_events(company_id);
      CREATE INDEX IF NOT EXISTS crm_events_task_idx ON crm_events(task_id);
      CREATE INDEX IF NOT EXISTS crm_events_visit_idx ON crm_events(visit_id);
      CREATE INDEX IF NOT EXISTS crm_events_created_idx ON crm_events(created_at);
    `);
    console.log("+ CREATE TABLE crm_events");
  }

  if (!tableExists("company_portal_access")) {
    sqlite.exec(`
      CREATE TABLE company_portal_access (
        company_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS company_portal_access_slug_uidx ON company_portal_access(slug);
    `);
    console.log("+ CREATE TABLE company_portal_access");
  }

  if (!tableExists("design_tickets")) {
    sqlite.exec(`
      CREATE TABLE design_tickets (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_number TEXT NOT NULL UNIQUE,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        assignee_id TEXT,
        created_by_type TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS design_tickets_company_idx ON design_tickets(company_id);
      CREATE INDEX IF NOT EXISTS design_tickets_status_idx ON design_tickets(status);

      CREATE TABLE design_ticket_messages (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_id TEXT NOT NULL REFERENCES design_tickets(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        author_type TEXT NOT NULL,
        author_name TEXT NOT NULL,
        message TEXT NOT NULL,
        attachments_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS design_ticket_messages_ticket_idx ON design_ticket_messages(ticket_id);
    `);
    console.log("+ CREATE TABLE design_tickets + design_ticket_messages");
  }

  if (!tableExists("chat_sessions")) {
    sqlite.exec(`
      CREATE TABLE chat_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
        portal_slug TEXT,
        visitor_name TEXT NOT NULL,
        status TEXT NOT NULL,
        assigned_agent_id TEXT,
        assigned_agent_name TEXT,
        linked_ticket_id TEXT,
        bot_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS chat_sessions_portal_idx ON chat_sessions(portal_slug);
      CREATE INDEX IF NOT EXISTS chat_sessions_status_idx ON chat_sessions(status);
      CREATE INDEX IF NOT EXISTS chat_sessions_updated_idx ON chat_sessions(updated_at);

      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        text TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id);
    `);
    console.log("+ CREATE TABLE chat_sessions + chat_messages");
  }

  // Unique (company_id, module_key) on company_modules when possible
  try {
    sqlite.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS company_modules_company_key_uidx ON company_modules(company_id, module_key)`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`company_modules unique index skipped: ${msg}`);
  }
}

ensureCrmTables();

/** CRM customer accounts (product CRM) — no FK to ERP companies. */
if (!tableExists("crm_accounts")) {
  sqlite.exec(`
    CREATE TABLE crm_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      user_id TEXT,
      company_type TEXT NOT NULL,
      contact TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT,
      country TEXT,
      region TEXT,
      owner_name TEXT,
      owner_phone TEXT,
      owner_email TEXT,
      poc_name TEXT,
      poc_mobile TEXT,
      poc_email TEXT,
      sales_manager_name TEXT,
      account_manager_name TEXT,
      support_manager_1 TEXT,
      support_manager_2 TEXT,
      start_date TEXT,
      end_date TEXT,
      annual_license INTEGER,
      deal_size REAL,
      users_purchased INTEGER,
      total_cost REAL,
      payment_received REAL,
      pending_amount REAL,
      health_score INTEGER,
      status TEXT NOT NULL DEFAULT 'onboarding',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS crm_accounts_name_idx ON crm_accounts(name);
    CREATE INDEX IF NOT EXISTS crm_accounts_user_id_idx ON crm_accounts(user_id);
    CREATE INDEX IF NOT EXISTS crm_accounts_status_idx ON crm_accounts(status);
  `);
  console.log("+ CREATE TABLE crm_accounts");
}

if (!tableExists("crm_onboarding_records")) {
  sqlite.exec(`
    CREATE TABLE crm_onboarding_records (
      company_id TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES crm_accounts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS crm_onboarding_updated_idx ON crm_onboarding_records(updated_at);
  `);
  console.log("+ CREATE TABLE crm_onboarding_records");
}

if (!tableExists("booking_event_types")) {
  sqlite.exec(`
    CREATE TABLE booking_event_types (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      host_user_id TEXT,
      buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
      buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS booking_event_types_company_idx ON booking_event_types(company_id);
    CREATE UNIQUE INDEX IF NOT EXISTS booking_event_types_company_slug_uidx ON booking_event_types(company_id, slug);
  `);
  console.log("+ CREATE TABLE booking_event_types");
}

if (!tableExists("booking_availability")) {
  sqlite.exec(`
    CREATE TABLE booking_availability (
      id TEXT PRIMARY KEY NOT NULL,
      host_user_id TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS booking_availability_host_idx ON booking_availability(host_user_id);
    CREATE INDEX IF NOT EXISTS booking_availability_weekday_idx ON booking_availability(weekday);
  `);
  console.log("+ CREATE TABLE booking_availability");
}

if (!tableExists("booking_blocks")) {
  sqlite.exec(`
    CREATE TABLE booking_blocks (
      id TEXT PRIMARY KEY NOT NULL,
      host_user_id TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS booking_blocks_host_idx ON booking_blocks(host_user_id);
    CREATE INDEX IF NOT EXISTS booking_blocks_range_idx ON booking_blocks(starts_at, ends_at);
  `);
  console.log("+ CREATE TABLE booking_blocks");
}

if (!tableExists("booking_appointments")) {
  sqlite.exec(`
    CREATE TABLE booking_appointments (
      id TEXT PRIMARY KEY NOT NULL,
      event_type_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      host_user_id TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      additional_guest_emails_json TEXT NOT NULL DEFAULT '[]',
      guest_phone TEXT,
      notes TEXT,
      host_note TEXT,
      created_via TEXT NOT NULL DEFAULT 'portal',
      google_event_id TEXT,
      meet_url TEXT,
      google_sync_status TEXT NOT NULL DEFAULT 'none',
      google_sync_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (event_type_id) REFERENCES booking_event_types(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS booking_appointments_company_idx ON booking_appointments(company_id);
    CREATE INDEX IF NOT EXISTS booking_appointments_host_idx ON booking_appointments(host_user_id);
    CREATE INDEX IF NOT EXISTS booking_appointments_status_idx ON booking_appointments(status);
    CREATE INDEX IF NOT EXISTS booking_appointments_starts_idx ON booking_appointments(starts_at);
    CREATE INDEX IF NOT EXISTS booking_appointments_event_idx ON booking_appointments(event_type_id);
  `);
  console.log("+ CREATE TABLE booking_appointments");
}

if (!tableExists("user_google_calendar")) {
  sqlite.exec(`
    CREATE TABLE user_google_calendar (
      user_id TEXT PRIMARY KEY NOT NULL,
      google_email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expires_at TEXT NOT NULL,
      calendar_id TEXT NOT NULL DEFAULT 'primary',
      scopes TEXT NOT NULL DEFAULT '',
      sync_enabled INTEGER NOT NULL DEFAULT 1,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log("+ CREATE TABLE user_google_calendar");
}

if (!tableExists("automation_reminders_sent")) {
  sqlite.exec(`
    CREATE TABLE automation_reminders_sent (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      assignee_user_id TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS automation_reminders_dedupe_idx
      ON automation_reminders_sent(task_id, rule_id, assignee_user_id, starts_at);
    CREATE INDEX IF NOT EXISTS automation_reminders_task_idx ON automation_reminders_sent(task_id);
  `);
  console.log("+ CREATE TABLE automation_reminders_sent");
}

if (!tableExists("push_subscriptions")) {
  sqlite.exec(`
    CREATE TABLE push_subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_uidx ON push_subscriptions(endpoint);
    CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);
  `);
  console.log("+ CREATE TABLE push_subscriptions");
}

/** Backfill module_subscriptions from opted-in company_modules (idempotent). */
if (tableExists("module_subscriptions") && tableExists("company_modules")) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _schema_patches (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  const patch = "backfill_module_subscriptions_v1";
  const done = sqlite.prepare(`SELECT 1 AS ok FROM _schema_patches WHERE name = ?`).get(patch);
  if (!done) {
    const rows = sqlite
      .prepare(
        `SELECT company_id, module_key, opted_in, opted_on_date FROM company_modules`,
      )
      .all();
    const exists = sqlite.prepare(
      `SELECT 1 AS ok FROM module_subscriptions WHERE company_id = ? AND module_key = ?`,
    );
    const insert = sqlite.prepare(
      `INSERT INTO module_subscriptions
        (id, company_id, module_key, status, start_date, valid_until, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    );
    const now = new Date().toISOString();
    let n = 0;
    for (const row of rows) {
      if (exists.get(row.company_id, row.module_key)) continue;
      const start = row.opted_on_date || now.slice(0, 10);
      const status = row.opted_in ? "active" : "inactive";
      const id = `sub_${row.company_id}_${row.module_key}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
      insert.run(id, row.company_id, row.module_key, status, start, now, now);
      n += 1;
    }
    sqlite
      .prepare(`INSERT INTO _schema_patches (name, applied_at) VALUES (?, ?)`)
      .run(patch, now);
    console.log(`subscriptions: backfilled ${n} row(s) (${patch})`);
  }
}

if (tableExists("follow_up_tasks") && existingColumns("follow_up_tasks").has("product_scope")) {
  const crmBackfill = sqlite
    .prepare(
      `UPDATE follow_up_tasks
       SET product_scope = 'crm'
       WHERE product_scope = 'erp'
         AND company_id IN (SELECT id FROM crm_accounts)`,
    )
    .run();
  if (crmBackfill.changes > 0) {
    console.log(`follow_up_tasks: scoped ${crmBackfill.changes} row(s) to crm`);
  }
}

sqlite.close();
console.log("db:ensure complete");
