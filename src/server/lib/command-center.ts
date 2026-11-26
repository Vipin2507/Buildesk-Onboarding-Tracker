import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";

import { ApiError, newId, nowIso, requireUser, SESSION_COOKIE } from "@/server/auth/session";
import { getDb, getSqlite } from "@/server/db/client";
import {
  activityEntries,
  adminAuditLogs,
  appConfig,
  companies,
  companyPaymentTransactions,
  crmAccounts,
  followUpTasks,
  monitoringEvents,
  paymentTransactions,
  projects,
  securityEvents,
  sessions,
  tickets,
  users,
  workSessions,
} from "@/server/db/schema";
import type { User } from "@/types";

export type MonitorApp = "all" | "erp" | "crm" | "admin";

const CONFIG_KEY = "command-center";

export type MonitorConfig = {
  heartbeatSeconds: number;
  onlineMinutes: number;
  idleMinutes: number;
  retentionDays: number;
  failedLoginThreshold: number;
};

const DEFAULT_CONFIG: MonitorConfig = {
  heartbeatSeconds: 60,
  onlineMinutes: 3,
  idleMinutes: 10,
  retentionDays: 180,
  failedLoginThreshold: 5,
};

let ready = false;

export function ensureMonitoringSchema() {
  if (ready) return;
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      employee_id TEXT NOT NULL,
      application TEXT NOT NULL,
      module TEXT NOT NULL DEFAULT '',
      login_at TEXT NOT NULL,
      last_heartbeat_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      logout_at TEXT,
      ip_address TEXT,
      user_agent TEXT,
      device TEXT,
      browser TEXT,
      os TEXT,
      status TEXT NOT NULL DEFAULT 'online',
      terminated_by TEXT
    );
    CREATE TABLE IF NOT EXISTS monitoring_events (
      id TEXT PRIMARY KEY NOT NULL,
      employee_id TEXT,
      employee_name TEXT,
      application TEXT NOT NULL,
      module TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      metadata_json TEXT,
      ip_address TEXT,
      user_agent TEXT,
      session_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY NOT NULL,
      employee_id TEXT,
      employee_name TEXT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      application TEXT NOT NULL DEFAULT '',
      ip_address TEXT,
      user_agent TEXT,
      metadata_json TEXT,
      investigation_status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      reviewed_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      admin_id TEXT NOT NULL,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      metadata_json TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS work_sessions_employee_idx ON work_sessions(employee_id);
    CREATE INDEX IF NOT EXISTS monitoring_events_created_idx ON monitoring_events(created_at);
    CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events(created_at);
    CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at);
  `);
  ready = true;
}

export function requireAdmin() {
  const user = requireUser();
  if (user.role !== "Admin") {
    throw new ApiError(403, "Command Center is limited to Admin accounts.");
  }
  ensureMonitoringSchema();
  return user;
}

export function getMonitorConfig(): MonitorConfig {
  ensureMonitoringSchema();
  const row = getDb().select().from(appConfig).where(eq(appConfig.key, CONFIG_KEY)).get();
  if (!row) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(row.valueJson) as Partial<MonitorConfig>;
    return {
      heartbeatSeconds: clamp(parsed.heartbeatSeconds, 30, 300, DEFAULT_CONFIG.heartbeatSeconds),
      onlineMinutes: clamp(parsed.onlineMinutes, 1, 30, DEFAULT_CONFIG.onlineMinutes),
      idleMinutes: clamp(parsed.idleMinutes, 2, 120, DEFAULT_CONFIG.idleMinutes),
      retentionDays: clamp(parsed.retentionDays, 7, 3650, DEFAULT_CONFIG.retentionDays),
      failedLoginThreshold: clamp(
        parsed.failedLoginThreshold,
        3,
        20,
        DEFAULT_CONFIG.failedLoginThreshold,
      ),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveMonitorConfig(admin: User, next: MonitorConfig) {
  const config = {
    heartbeatSeconds: clamp(next.heartbeatSeconds, 30, 300, DEFAULT_CONFIG.heartbeatSeconds),
    onlineMinutes: clamp(next.onlineMinutes, 1, 30, DEFAULT_CONFIG.onlineMinutes),
    idleMinutes: clamp(next.idleMinutes, 2, 120, DEFAULT_CONFIG.idleMinutes),
    retentionDays: clamp(next.retentionDays, 7, 3650, DEFAULT_CONFIG.retentionDays),
    failedLoginThreshold: clamp(
      next.failedLoginThreshold,
      3,
      20,
      DEFAULT_CONFIG.failedLoginThreshold,
    ),
  };
  const db = getDb();
  const now = nowIso();
  const existing = db.select().from(appConfig).where(eq(appConfig.key, CONFIG_KEY)).get();
  if (existing) {
    db.update(appConfig)
      .set({ valueJson: JSON.stringify(config), updatedAt: now })
      .where(eq(appConfig.key, CONFIG_KEY))
      .run();
  } else {
    db.insert(appConfig)
      .values({ key: CONFIG_KEY, valueJson: JSON.stringify(config), updatedAt: now })
      .run();
  }
  writeAdminAudit(admin, "Updated monitoring settings", "settings", CONFIG_KEY, config);
  return config;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function requestMeta() {
  let ip = "";
  let userAgent = "";
  try {
    const forwarded = getRequestHeader("x-forwarded-for");
    ip = forwarded?.split(",")[0]?.trim() || getRequestHeader("x-real-ip") || "";
    userAgent = getRequestHeader("user-agent") || "";
  } catch {
    /* called outside a request */
  }
  return { ip: ip || null, userAgent: userAgent || null, ...parseUserAgent(userAgent) };
}

function parseUserAgent(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : ua
            ? "Other"
            : "Unknown";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : ua
              ? "Other"
              : "Unknown";
  const device = /Mobile|Android|iPhone/.test(ua) ? "Mobile" : ua ? "Desktop" : "Unknown";
  return { browser, os, device };
}

function appOf(user: User, requested?: string): "erp" | "crm" | "admin" {
  if (requested === "erp" || requested === "crm" || requested === "admin") return requested;
  return user.productScope === "crm" ? "crm" : "erp";
}

export function recordMonitoringEvent(input: {
  employeeId?: string | null;
  employeeName?: string | null;
  application: string;
  module?: string;
  eventType: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  sessionId?: string | null;
}) {
  try {
    ensureMonitoringSchema();
    const meta = requestMeta();
    getDb()
      .insert(monitoringEvents)
      .values({
        id: newId(),
        employeeId: input.employeeId ?? null,
        employeeName: input.employeeName ?? null,
        application: input.application,
        module: input.module ?? "",
        eventType: input.eventType,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        sessionId: input.sessionId ?? null,
        createdAt: nowIso(),
      })
      .run();
  } catch (error) {
    console.error("[command-center] event dropped", error);
  }
}

export function recordSecurityEvent(input: {
  employeeId?: string | null;
  employeeName?: string | null;
  eventType: string;
  severity: "informational" | "low" | "medium" | "high" | "critical";
  application?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    ensureMonitoringSchema();
    const meta = requestMeta();
    getDb()
      .insert(securityEvents)
      .values({
        id: newId(),
        employeeId: input.employeeId ?? null,
        employeeName: input.employeeName ?? null,
        eventType: input.eventType,
        severity: input.severity,
        application: input.application ?? "",
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        investigationStatus: "open",
        notes: null,
        reviewedBy: null,
        createdAt: nowIso(),
      })
      .run();
  } catch (error) {
    console.error("[command-center] security event dropped", error);
  }
}

function writeAdminAudit(
  admin: User,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata?: Record<string, unknown>,
) {
  const meta = requestMeta();
  getDb()
    .insert(adminAuditLogs)
    .values({
      id: newId(),
      adminId: admin.id,
      adminName: admin.name,
      action,
      resourceType,
      resourceId,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      ipAddress: meta.ip,
      createdAt: nowIso(),
    })
    .run();
}

export function openWorkSession(user: User, sessionId: string, application?: string) {
  try {
    ensureMonitoringSchema();
    const meta = requestMeta();
    const now = nowIso();
    const app = appOf(user, application);
    const db = getDb();
    const openCount = db
      .select({ n: sql<number>`count(*)` })
      .from(workSessions)
      .where(and(eq(workSessions.employeeId, user.id), sql`${workSessions.logoutAt} IS NULL`))
      .get();
    const seenAgent = meta.userAgent
      ? db
          .select({ id: workSessions.id })
          .from(workSessions)
          .where(
            and(eq(workSessions.employeeId, user.id), eq(workSessions.userAgent, meta.userAgent)),
          )
          .get()
      : { id: "unknown" };

    db.insert(workSessions)
      .values({
        id: sessionId,
        employeeId: user.id,
        application: app,
        module: "auth",
        loginAt: now,
        lastHeartbeatAt: now,
        lastActiveAt: now,
        logoutAt: null,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        browser: meta.browser,
        os: meta.os,
        status: "online",
        terminatedBy: null,
      })
      .onConflictDoNothing()
      .run();

    recordMonitoringEvent({
      employeeId: user.id,
      employeeName: user.name,
      application: app,
      module: "auth",
      eventType: "auth",
      action: "Logged in",
      sessionId,
    });

    if (Number(openCount?.n ?? 0) >= 1) {
      recordSecurityEvent({
        employeeId: user.id,
        employeeName: user.name,
        eventType: "concurrent-sessions",
        severity: "low",
        application: app,
        metadata: { openSessions: Number(openCount?.n ?? 0) + 1 },
      });
    }
    if (meta.userAgent && !seenAgent) {
      recordSecurityEvent({
        employeeId: user.id,
        employeeName: user.name,
        eventType: "new-device",
        severity: "low",
        application: app,
        metadata: { browser: meta.browser, os: meta.os, device: meta.device },
      });
    }
  } catch (error) {
    console.error("[command-center] session open failed", error);
  }
}

export function closeWorkSession(
  sessionId: string,
  reason: "logout" | "terminated",
  terminatedBy?: string,
) {
  try {
    ensureMonitoringSchema();
    const db = getDb();
    const row = db.select().from(workSessions).where(eq(workSessions.id, sessionId)).get();
    if (!row || row.logoutAt) return;
    const now = nowIso();
    db.update(workSessions)
      .set({
        logoutAt: now,
        status: reason === "terminated" ? "terminated" : "ended",
        terminatedBy: terminatedBy ?? null,
        lastHeartbeatAt: now,
      })
      .where(eq(workSessions.id, sessionId))
      .run();
    const user = db.select().from(users).where(eq(users.id, row.employeeId)).get();
    recordMonitoringEvent({
      employeeId: row.employeeId,
      employeeName: user?.name ?? null,
      application: row.application,
      module: "auth",
      eventType: "auth",
      action: reason === "terminated" ? "Session terminated by an admin" : "Logged out",
      sessionId,
    });
  } catch (error) {
    console.error("[command-center] session close failed", error);
  }
}

export function noteFailedLogin(email: string) {
  try {
    ensureMonitoringSchema();
    const config = getMonitorConfig();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recent = getDb()
      .select({ n: sql<number>`count(*)` })
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.eventType, "failed-login"),
          gte(securityEvents.createdAt, since),
          sql`${securityEvents.metadataJson} LIKE ${"%" + email.toLowerCase() + "%"}`,
        ),
      )
      .get();
    const count = Number(recent?.n ?? 0) + 1;
    recordSecurityEvent({
      eventType: "failed-login",
      severity: count >= config.failedLoginThreshold ? "high" : "medium",
      metadata: { email: email.toLowerCase(), attemptsIn15Minutes: count },
    });
    recordMonitoringEvent({
      employeeName: email.toLowerCase(),
      application: "auth",
      module: "auth",
      eventType: "security",
      action: "Failed login",
    });
  } catch (error) {
    console.error("[command-center] failed login note dropped", error);
  }
}

export function heartbeat(user: User, application: string, module: string) {
  ensureMonitoringSchema();
  const sessionId = getCookie(SESSION_COOKIE);
  if (!sessionId) return { ok: false as const };
  const db = getDb();
  const now = nowIso();
  const meta = requestMeta();
  const existing = db.select().from(workSessions).where(eq(workSessions.id, sessionId)).get();
  const app = appOf(user, application);
  if (!existing) {
    const auth = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    db.insert(workSessions)
      .values({
        id: sessionId,
        employeeId: user.id,
        application: app,
        module: module || "",
        loginAt: auth?.createdAt ?? now,
        lastHeartbeatAt: now,
        lastActiveAt: auth?.createdAt ?? now,
        logoutAt: null,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        browser: meta.browser,
        os: meta.os,
        status: "online",
        terminatedBy: null,
      })
      .run();
  } else if (!existing.logoutAt) {
    db.update(workSessions)
      .set({
        lastHeartbeatAt: now,
        application: app,
        module: module || existing.module,
        status: "online",
      })
      .where(eq(workSessions.id, sessionId))
      .run();
  }
  return { ok: true as const, heartbeatSeconds: getMonitorConfig().heartbeatSeconds };
}

export function recordNavigation(user: User, application: string, module: string) {
  const sessionId = getCookie(SESSION_COOKIE) ?? null;
  recordMonitoringEvent({
    employeeId: user.id,
    employeeName: user.name,
    application: appOf(user, application),
    module,
    eventType: "navigation",
    action: `Opened ${module || "home"}`,
    sessionId,
  });
  const db = getDb();
  if (sessionId) {
    db.update(workSessions)
      .set({ lastActiveAt: nowIso(), module, application: appOf(user, application) })
      .where(and(eq(workSessions.id, sessionId), sql`${workSessions.logoutAt} IS NULL`))
      .run();
  }
}

function num(value: unknown) {
  return Number(value ?? 0);
}

function inRange(column: unknown, from: string, to: string) {
  return and(gte(column as never, from), lte(column as never, to));
}

export function buildOverview(from: string, to: string, app: MonitorApp) {
  ensureMonitoringSchema();
  const db = getDb();
  const config = getMonitorConfig();
  const onlineAfter = new Date(Date.now() - config.onlineMinutes * 60 * 1000).toISOString();
  const activeAfter = new Date(Date.now() - config.idleMinutes * 60 * 1000).toISOString();
  const span = new Date(to).getTime() - new Date(from).getTime();
  const prevTo = from;
  const prevFrom = new Date(new Date(from).getTime() - Math.max(span, 1)).toISOString();

  const appFilter = app === "all" ? undefined : eq(monitoringEvents.application, app);
  const taskScope =
    app === "all" ? undefined : eq(followUpTasks.productScope, app === "admin" ? "erp" : app);

  const totalEmployees = num(
    db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.active, true))
      .get()?.n,
  );
  const openSessions = db
    .select()
    .from(workSessions)
    .where(sql`${workSessions.logoutAt} IS NULL`)
    .all()
    .filter((row) => app === "all" || row.application === app);

  const online = openSessions.filter((row) => row.lastHeartbeatAt >= onlineAfter).length;
  const activeNow = openSessions.filter(
    (row) => row.lastHeartbeatAt >= onlineAfter && row.lastActiveAt >= activeAfter,
  ).length;

  const eventsIn = (start: string, end: string) =>
    num(
      db
        .select({ n: sql<number>`count(*)` })
        .from(monitoringEvents)
        .where(and(inRange(monitoringEvents.createdAt, start, end), appFilter))
        .get()?.n,
    );

  const sessionsIn = (start: string, end: string) =>
    num(
      db
        .select({ n: sql<number>`count(*)` })
        .from(workSessions)
        .where(
          and(
            inRange(workSessions.loginAt, start, end),
            app === "all" ? undefined : eq(workSessions.application, app),
          ),
        )
        .get()?.n,
    );

  const distinctActive = db
    .select({ id: monitoringEvents.employeeId })
    .from(monitoringEvents)
    .where(
      and(
        inRange(monitoringEvents.createdAt, from, to),
        appFilter,
        sql`${monitoringEvents.employeeId} IS NOT NULL`,
      ),
    )
    .all();
  const activeToday = new Set(distinctActive.map((row) => row.id).filter(Boolean)).size;

  const tasksCompleted = num(
    db
      .select({ n: sql<number>`count(*)` })
      .from(followUpTasks)
      .where(and(inRange(followUpTasks.completedAt, from, to), taskScope))
      .get()?.n,
  );
  const tasksPending = num(
    db
      .select({ n: sql<number>`count(*)` })
      .from(followUpTasks)
      .where(
        and(sql`${followUpTasks.status} IN ('open','in_progress','blocked','overdue')`, taskScope),
      )
      .get()?.n,
  );
  const securityOpen = num(
    db
      .select({ n: sql<number>`count(*)` })
      .from(securityEvents)
      .where(
        and(
          inRange(securityEvents.createdAt, from, to),
          sql`${securityEvents.investigationStatus} != 'resolved'`,
        ),
      )
      .get()?.n,
  );

  return {
    config,
    range: { from, to },
    application: app,
    metrics: {
      totalEmployees: metric(
        totalEmployees,
        null,
        "All active user accounts. Not affected by the date range.",
      ),
      currentlyOnline: metric(
        online,
        null,
        `Heartbeat within the last ${config.onlineMinutes} minutes.`,
      ),
      activeNow: metric(
        activeNow,
        null,
        `Online, with a page view in the last ${config.idleMinutes} minutes.`,
      ),
      offline: metric(
        Math.max(totalEmployees - online, 0),
        null,
        "Active accounts without a current heartbeat.",
      ),
      sessions: metric(
        sessionsIn(from, to),
        sessionsIn(prevFrom, prevTo),
        "Login sessions started in the range.",
      ),
      activities: metric(
        eventsIn(from, to),
        eventsIn(prevFrom, prevTo),
        "Recorded monitoring events in the range.",
      ),
      tasksCompleted: metric(
        tasksCompleted,
        null,
        "Follow-up tasks with a completion time in the range.",
      ),
      tasksPending: metric(tasksPending, null, "Open follow-up tasks right now. Not historical."),
      securityAlerts: metric(
        securityOpen,
        null,
        "Security events in the range that are not resolved.",
      ),
      activePeople: metric(
        activeToday,
        null,
        "Distinct people with a recorded event in the range.",
      ),
    },
    health: systemHealth(),
    presence: presenceRows(app),
    recentEvents: listEvents({ from, to, app, limit: 12 }).rows,
  };
}

function metric(value: number, previous: number | null, note: string) {
  let change: number | null = null;
  if (previous !== null && previous > 0) {
    change = Math.round(((value - previous) / previous) * 100);
  }
  return { value, previous, change, note };
}

export function systemHealth() {
  const started = Date.now();
  let database: { ok: boolean; latencyMs: number } = { ok: false, latencyMs: 0 };
  try {
    getSqlite().prepare("SELECT 1").get();
    database = { ok: true, latencyMs: Date.now() - started };
  } catch {
    database = { ok: false, latencyMs: Date.now() - started };
  }
  const memory = process.memoryUsage();
  return {
    database,
    processUptimeSeconds: Math.round(process.uptime()),
    processMemoryMb: Math.round(memory.rss / 1024 / 1024),
    cpuPercent: null as number | null,
    backgroundJobs: null as string | null,
    note: "CPU, disk, and background jobs are not instrumented on this single Node process. Blank means unavailable, not zero.",
  };
}

function presenceRows(app: MonitorApp) {
  const config = getMonitorConfig();
  const onlineAfter = new Date(Date.now() - config.onlineMinutes * 60 * 1000).toISOString();
  const activeAfter = new Date(Date.now() - config.idleMinutes * 60 * 1000).toISOString();
  const db = getDb();
  const people = db.select().from(users).where(eq(users.active, true)).all();
  const sessions = db
    .select()
    .from(workSessions)
    .where(sql`${workSessions.logoutAt} IS NULL`)
    .all();
  return people
    .map((person) => {
      const open = sessions
        .filter((row) => row.employeeId === person.id)
        .sort((a, b) => b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt))[0];
      if (app !== "all" && open && open.application !== app) return null;
      if (app !== "all" && !open && person.productScope !== app) return null;
      const online = Boolean(open && open.lastHeartbeatAt >= onlineAfter);
      const active = Boolean(online && open && open.lastActiveAt >= activeAfter);
      const status = !open || !online ? "offline" : active ? "active" : "idle";
      return {
        id: person.id,
        name: person.name,
        email: person.email,
        role: person.role,
        jobTitle: person.jobTitle,
        department: person.department,
        productScope: person.productScope,
        application: open?.application ?? person.productScope,
        module: open?.module || null,
        status,
        loginAt: open?.loginAt ?? null,
        lastHeartbeatAt: open?.lastHeartbeatAt ?? null,
        lastActiveAt: open?.lastActiveAt ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
}

export function listEvents(input: {
  from?: string;
  to?: string;
  app?: MonitorApp;
  employeeId?: string;
  eventType?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  ensureMonitoringSchema();
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const filters = [];
  if (input.from) filters.push(gte(monitoringEvents.createdAt, input.from));
  if (input.to) filters.push(lte(monitoringEvents.createdAt, input.to));
  if (input.app && input.app !== "all") filters.push(eq(monitoringEvents.application, input.app));
  if (input.employeeId) filters.push(eq(monitoringEvents.employeeId, input.employeeId));
  if (input.eventType && input.eventType !== "all")
    filters.push(eq(monitoringEvents.eventType, input.eventType));
  if (input.q) {
    const like = `%${input.q.trim()}%`;
    filters.push(
      or(
        sql`${monitoringEvents.action} LIKE ${like}`,
        sql`${monitoringEvents.employeeName} LIKE ${like}`,
        sql`${monitoringEvents.module} LIKE ${like}`,
      ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const db = getDb();
  const total = num(
    db
      .select({ n: sql<number>`count(*)` })
      .from(monitoringEvents)
      .where(where)
      .get()?.n,
  );
  const rows = db
    .select()
    .from(monitoringEvents)
    .where(where)
    .orderBy(desc(monitoringEvents.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
  return { total, rows, limit, offset };
}

export function listEmployees(input: { q?: string; app?: MonitorApp; status?: string }) {
  const presence = presenceRows(input.app ?? "all");
  const q = input.q?.trim().toLowerCase() ?? "";
  return presence.filter((person) => {
    if (input.status && input.status !== "all" && person.status !== input.status) return false;
    if (!q) return true;
    return (
      person.name.toLowerCase().includes(q) ||
      person.email.toLowerCase().includes(q) ||
      person.id.toLowerCase().includes(q) ||
      (person.department ?? "").toLowerCase().includes(q) ||
      (person.jobTitle ?? "").toLowerCase().includes(q)
    );
  });
}

export function employeeDetail(id: string, from: string, to: string) {
  ensureMonitoringSchema();
  const db = getDb();
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw new ApiError(404, "Employee not found");
  const { passwordHash: _hidden, ...safe } = user;
  void _hidden;
  const sessions = db
    .select()
    .from(workSessions)
    .where(
      and(
        eq(workSessions.employeeId, id),
        gte(workSessions.loginAt, from),
        lte(workSessions.loginAt, to),
      ),
    )
    .orderBy(desc(workSessions.loginAt))
    .limit(100)
    .all();
  const events = listEvents({ employeeId: id, from, to, limit: 100 });
  const security = db
    .select()
    .from(securityEvents)
    .where(and(eq(securityEvents.employeeId, id), gte(securityEvents.createdAt, from)))
    .orderBy(desc(securityEvents.createdAt))
    .limit(50)
    .all();
  const tasks = db.select().from(followUpTasks).where(eq(followUpTasks.assigneeUserId, id)).all();
  const handledCompanies = db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(
      or(
        eq(companies.onboardingManagerId, id),
        eq(companies.csmId, id),
        eq(companies.salesAgentId, id),
      ),
    )
    .all();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const durationMs = sessions.reduce((sum, row) => {
    const start = new Date(row.loginAt).getTime();
    const end = new Date(row.logoutAt || row.lastHeartbeatAt).getTime();
    return sum + Math.max(0, end - start);
  }, 0);
  return {
    user: safe,
    sessions,
    events: events.rows,
    security,
    work: {
      assigned: tasks.length,
      completed: tasks.filter((task) => task.status === "completed").length,
      pending: tasks.filter((task) =>
        ["open", "in_progress", "blocked", "overdue"].includes(task.status),
      ).length,
      overdue: tasks.filter(
        (task) =>
          task.dueDate &&
          task.dueDate < todayIso.slice(0, 10) &&
          task.status !== "completed" &&
          task.status !== "cancelled",
      ).length,
      companies: handledCompanies,
    },
    recordedSessionMs: durationMs,
    location: "Location unavailable",
  };
}

export function listSessions(input: { from: string; to: string; app?: MonitorApp; q?: string }) {
  ensureMonitoringSchema();
  const db = getDb();
  const rows = db
    .select({
      session: workSessions,
      name: users.name,
      email: users.email,
    })
    .from(workSessions)
    .innerJoin(users, eq(users.id, workSessions.employeeId))
    .where(
      and(
        gte(workSessions.loginAt, input.from),
        lte(workSessions.loginAt, input.to),
        input.app && input.app !== "all" ? eq(workSessions.application, input.app) : undefined,
      ),
    )
    .orderBy(desc(workSessions.loginAt))
    .limit(300)
    .all();
  const q = input.q?.trim().toLowerCase() ?? "";
  return rows.filter(
    (row) => !q || row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q),
  );
}

export function terminateWorkSession(admin: User, sessionId: string) {
  ensureMonitoringSchema();
  const db = getDb();
  const row = db.select().from(workSessions).where(eq(workSessions.id, sessionId)).get();
  if (!row) throw new ApiError(404, "Session not found");
  closeWorkSession(sessionId, "terminated", admin.id);
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  writeAdminAudit(admin, "Terminated a session", "session", sessionId, {
    employeeId: row.employeeId,
  });
}

export function workSummary(from: string, to: string, app: MonitorApp) {
  const db = getDb();
  const scope = app === "erp" || app === "crm" ? eq(followUpTasks.productScope, app) : undefined;
  const tasks = db.select().from(followUpTasks).where(scope).all();
  const today = new Date().toISOString().slice(0, 10);
  const completedInRange = tasks.filter(
    (task) => task.completedAt && task.completedAt >= from && task.completedAt <= to,
  );
  return {
    assigned: tasks.length,
    completedInRange: completedInRange.length,
    pending: tasks.filter((task) =>
      ["open", "in_progress", "blocked", "overdue"].includes(task.status),
    ).length,
    overdue: tasks.filter(
      (task) =>
        task.dueDate &&
        task.dueDate < today &&
        task.status !== "completed" &&
        task.status !== "cancelled",
    ).length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    byScope: {
      erp: tasks.filter((task) => task.productScope !== "crm").length,
      crm: tasks.filter((task) => task.productScope === "crm").length,
    },
    note: "Counts come from follow-up tasks. Browser-open time is not treated as work completed.",
  };
}

export function erpSummary(from: string, to: string) {
  const db = getDb();
  const companyRows = db.select().from(companies).all();
  const created = companyRows.filter((row) => row.createdAt >= from && row.createdAt <= to).length;
  const payments = db
    .select()
    .from(companyPaymentTransactions)
    .where(
      and(
        gte(companyPaymentTransactions.paidDate, from.slice(0, 10)),
        lte(companyPaymentTransactions.paidDate, to.slice(0, 10)),
      ),
    )
    .all();
  const ticketRows = db.select().from(tickets).all();
  const tasks = db
    .select()
    .from(followUpTasks)
    .where(sql`${followUpTasks.productScope} != 'crm'`)
    .all();
  return {
    companies: companyRows.length,
    companiesCreated: created,
    paymentsRecorded: payments.length,
    paymentAmount: payments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    tickets: ticketRows.length,
    ticketsResolved: ticketRows.filter(
      (row) =>
        row.resolutionStatus === "Resolved" || row.status === "resolved" || row.status === "closed",
    ).length,
    tasksCompleted: tasks.filter(
      (row) => row.completedAt && row.completedAt >= from && row.completedAt <= to,
    ).length,
    activityLog: db
      .select()
      .from(activityEntries)
      .where(and(gte(activityEntries.createdAt, from), lte(activityEntries.createdAt, to)))
      .orderBy(desc(activityEntries.createdAt))
      .limit(20)
      .all(),
    note: "ERP figures are live records. Module-by-module click history starts when someone opens a page after this release.",
  };
}

export function crmSummary(from: string, to: string) {
  const db = getDb();
  const accounts = db.select().from(crmAccounts).all();
  const tasks = db.select().from(followUpTasks).where(eq(followUpTasks.productScope, "crm")).all();
  const payments = db
    .select()
    .from(paymentTransactions)
    .where(and(gte(paymentTransactions.createdAt, from), lte(paymentTransactions.createdAt, to)))
    .all();
  return {
    accounts: accounts.length,
    accountsCreated: accounts.filter((row) => row.createdAt >= from && row.createdAt <= to).length,
    tasksPending: tasks.filter((row) =>
      ["open", "in_progress", "blocked", "overdue"].includes(row.status),
    ).length,
    tasksCompleted: tasks.filter(
      (row) => row.completedAt && row.completedAt >= from && row.completedAt <= to,
    ).length,
    paymentsRecorded: payments.length,
    note: "CRM has accounts, tasks, and payments in this database. A separate lead or deal pipeline table is not present, so those figures are not shown.",
  };
}

export function listSecurity(from: string, to: string) {
  ensureMonitoringSchema();
  return getDb()
    .select()
    .from(securityEvents)
    .where(and(gte(securityEvents.createdAt, from), lte(securityEvents.createdAt, to)))
    .orderBy(desc(securityEvents.createdAt))
    .limit(200)
    .all();
}

export function reviewSecurity(
  admin: User,
  id: string,
  status: "open" | "reviewing" | "resolved",
  notes?: string,
) {
  ensureMonitoringSchema();
  const db = getDb();
  const row = db.select().from(securityEvents).where(eq(securityEvents.id, id)).get();
  if (!row) throw new ApiError(404, "Security event not found");
  db.update(securityEvents)
    .set({
      investigationStatus: status,
      notes: notes ?? row.notes,
      reviewedBy: admin.id,
    })
    .where(eq(securityEvents.id, id))
    .run();
  writeAdminAudit(admin, `Marked security event ${status}`, "security_event", id);
}

export function listAudit(from: string, to: string) {
  ensureMonitoringSchema();
  return getDb()
    .select()
    .from(adminAuditLogs)
    .where(and(gte(adminAuditLogs.createdAt, from), lte(adminAuditLogs.createdAt, to)))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(200)
    .all();
}

export function searchCommandCenter(q: string) {
  ensureMonitoringSchema();
  const like = `%${q.trim()}%`;
  const db = getDb();
  const people = db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      or(
        sql`${users.name} LIKE ${like}`,
        sql`${users.email} LIKE ${like}`,
        sql`${users.id} LIKE ${like}`,
      ),
    )
    .limit(6)
    .all();
  const companyHits = db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(sql`${companies.name} LIKE ${like}`)
    .limit(6)
    .all();
  const projectHits = db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(sql`${projects.name} LIKE ${like}`)
    .limit(6)
    .all();
  const taskHits = db
    .select({
      id: followUpTasks.id,
      title: followUpTasks.title,
      productScope: followUpTasks.productScope,
    })
    .from(followUpTasks)
    .where(sql`${followUpTasks.title} LIKE ${like}`)
    .limit(6)
    .all();
  return { people, companies: companyHits, projects: projectHits, tasks: taskHits };
}

export function usageSplit(from: string, to: string, app: MonitorApp = "all") {
  ensureMonitoringSchema();
  const db = getDb();
  const appFilter = app === "all" ? undefined : eq(monitoringEvents.application, app);
  const where = and(
    gte(monitoringEvents.createdAt, from),
    lte(monitoringEvents.createdAt, to),
    appFilter,
  );
  const rows = db
    .select({
      application: monitoringEvents.application,
      n: sql<number>`count(*)`,
    })
    .from(monitoringEvents)
    .where(where)
    .groupBy(monitoringEvents.application)
    .all();
  const modules = db
    .select({
      application: monitoringEvents.application,
      module: monitoringEvents.module,
      n: sql<number>`count(*)`,
    })
    .from(monitoringEvents)
    .where(where)
    .groupBy(monitoringEvents.application, monitoringEvents.module)
    .all()
    .sort((a, b) => num(b.n) - num(a.n))
    .slice(0, 8);
  const days = db
    .select({
      day: sql<string>`substr(${monitoringEvents.createdAt}, 1, 10)`,
      application: monitoringEvents.application,
      n: sql<number>`count(*)`,
    })
    .from(monitoringEvents)
    .where(where)
    .groupBy(sql`substr(${monitoringEvents.createdAt}, 1, 10)`, monitoringEvents.application)
    .all();
  const byDayMap = new Map<string, { day: string; label: string; erp: number; crm: number; admin: number }>();
  for (const row of days) {
    const day = row.day || "";
    if (!day) continue;
    const current = byDayMap.get(day) ?? { day, label: dayLabel(day), erp: 0, crm: 0, admin: 0 };
    const key = row.application === "crm" || row.application === "erp" ? row.application : "admin";
    current[key] += num(row.n);
    byDayMap.set(day, current);
  }
  return {
    byApp: rows.map((row) => ({ application: row.application, count: num(row.n) })),
    modules: modules.map((row) => ({
      application: row.application,
      module: row.module || "unknown",
      count: num(row.n),
    })),
    byDay: [...byDayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}

function dayLabel(day: string) {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day.slice(5);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
