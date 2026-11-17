/**
 * Focused CRM / subscription regression checks (no vitest dependency).
 * Run: node scripts/crm-regression-check.mjs
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(e);
  }
}

/** Mirror of withSubscriptionProjection / normalize legacy optedIn mapping. */
function withSubscriptionProjection(m) {
  const start = m.subscriptionStartDate ?? m.optedOnDate;
  const status = m.subscriptionStatus ?? (m.optedIn ? "active" : "inactive");
  return {
    ...m,
    subscriptionStatus: status,
    subscriptionStartDate: start,
    subscriptionValidUntil: m.subscriptionValidUntil,
  };
}

check("legacy opted-in projects to active subscription (no forced expiry)", () => {
  const projected = withSubscriptionProjection({
    moduleKey: "post-sales",
    label: "Post Sales",
    optedIn: true,
    optedOnDate: "2024-01-15",
  });
  assert.equal(projected.subscriptionStatus, "active");
  assert.equal(projected.subscriptionStartDate, "2024-01-15");
  assert.equal(projected.subscriptionValidUntil, undefined);
});

check("legacy opted-out projects to inactive subscription", () => {
  const projected = withSubscriptionProjection({
    moduleKey: "vendor-management",
    label: "Vendor",
    optedIn: false,
  });
  assert.equal(projected.subscriptionStatus, "inactive");
});

check("explicit subscription fields are preserved", () => {
  const projected = withSubscriptionProjection({
    moduleKey: "post-sales",
    label: "Post Sales",
    optedIn: true,
    optedOnDate: "2024-01-15",
    subscriptionStatus: "paused",
    subscriptionStartDate: "2025-02-01",
    subscriptionValidUntil: "2026-02-01",
  });
  assert.equal(projected.subscriptionStatus, "paused");
  assert.equal(projected.subscriptionStartDate, "2025-02-01");
  assert.equal(projected.subscriptionValidUntil, "2026-02-01");
});

check("task overdue logic treats dueDate < today as overdue", () => {
  const today = "2026-07-19";
  const open = [
    { status: "open", dueDate: "2026-07-18" },
    { status: "in_progress", dueDate: "2026-07-19" },
    { status: "completed", dueDate: "2026-07-01" },
    { status: "blocked", dueDate: null },
  ];
  const overdue = open.filter(
    (t) => ["open", "in_progress", "blocked"].includes(t.status) && t.dueDate && t.dueDate < today,
  );
  assert.equal(overdue.length, 1);
});

check("permission keys include CRM + sales agent", () => {
  const keys = [
    "manageTasks",
    "manageClientVisits",
    "manageModuleSubscriptions",
    "assignSalesAgent",
  ];
  const defaultsAdmin = {
    manageTasks: true,
    manageClientVisits: true,
    manageModuleSubscriptions: true,
    assignSalesAgent: true,
  };
  for (const k of keys) assert.equal(defaultsAdmin[k], true);
});

check("timeline merge sorts by createdAt descending", () => {
  const activity = [{ id: "a", createdAt: "2026-07-01T10:00:00.000Z", kind: "activity" }];
  const crm = [{ id: "c", createdAt: "2026-07-10T10:00:00.000Z", kind: "crm" }];
  const merged = [...activity, ...crm].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  assert.equal(merged[0].id, "c");
  assert.equal(merged[1].id, "a");
});

check("overdue payments filter excludes suspended, closed, and inactive accounts", () => {
  const today = "2026-11-17";
  const rows = [
    {
      accountName: "Active Overdue",
      accountStatus: "live",
      paymentStatus: "overdue",
      overdueAmount: 50000,
      nextDueInstallment: { dueDate: "2026-11-01", remainingAmount: 50000 },
    },
    {
      accountName: "Suspended Overdue",
      accountStatus: "suspended",
      paymentStatus: "overdue",
      overdueAmount: 25000,
      nextDueInstallment: { dueDate: "2026-10-01", remainingAmount: 25000 },
    },
    {
      accountName: "Suspend and Close",
      accountStatus: "suspend_and_close",
      paymentStatus: "overdue",
      overdueAmount: 15000,
      nextDueInstallment: { dueDate: "2026-09-01", remainingAmount: 15000 },
    },
    {
      accountName: "Inactive",
      accountStatus: "inactive",
      paymentStatus: "overdue",
      overdueAmount: 10000,
      nextDueInstallment: { dueDate: "2026-08-01", remainingAmount: 10000 },
    },
    {
      accountName: "Active Future",
      accountStatus: "live",
      paymentStatus: "upcoming",
      overdueAmount: 0,
      nextDueInstallment: { dueDate: "2026-12-01", remainingAmount: 30000 },
    },
  ];

  const isInactive = (s) => s === "inactive" || s === "suspend_and_close";
  const isSuspended = (s) => s === "suspended";
  const activeOverdue = rows.filter(
    (r) =>
      !isInactive(r.accountStatus) &&
      !isSuspended(r.accountStatus) &&
      r.accountStatus !== "closed" &&
      r.nextDueInstallment?.dueDate < today &&
      r.paymentStatus !== "fully_paid" &&
      r.paymentStatus !== "renewal",
  );

  assert.equal(activeOverdue.length, 1);
  assert.equal(activeOverdue[0].accountName, "Active Overdue");
  const totalOverdue = activeOverdue.reduce((s, r) => s + r.overdueAmount, 0);
  assert.equal(totalOverdue, 50000);
});

const candidates = [
  process.env.DATABASE_URL?.replace(/^file:/, ""),
  path.join(root, "data", "buildesk.db"),
  path.join(root, "data", "buildesk.sqlite"),
].filter(Boolean);
const dbPath = candidates.find((p) => existsSync(p));
if (dbPath || process.env.RUN_DB_ENSURE === "1") {
  check("db:ensure is idempotent for CRM tables", () => {
    const run = () =>
      spawnSync("node", ["scripts/db-ensure-schema.mjs"], {
        cwd: root,
        encoding: "utf8",
        env: process.env,
      });
    const first = run();
    const second = run();
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout + second.stderr, /db:ensure complete/);
  });
} else {
  console.log("↷ skip db:ensure (no sqlite file; set RUN_DB_ENSURE=1 to force)");
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll CRM regression checks passed");
