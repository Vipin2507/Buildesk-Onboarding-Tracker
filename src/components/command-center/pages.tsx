import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { downloadCsv, useAdminFilters } from "@/components/command-center/filters";
import {
  adminAudit,
  adminCrm,
  adminEmployee,
  adminEmployees,
  adminErp,
  adminEvents,
  adminHealth,
  adminOverview,
  adminReviewSecurity,
  adminSaveSettings,
  adminSecurity,
  adminSessions,
  adminSettings,
  adminTerminateSession,
  adminUsage,
  adminWork,
} from "@/server/api/command-center";

function useRange() {
  const filters = useAdminFilters();
  return { from: filters.from, to: filters.to, app: filters.app };
}

function unwrap<T>(
  result: { success: boolean; data?: T; error?: string } | undefined,
  fallback: T,
): T {
  if (!result) return fallback;
  if (!result.success) return fallback;
  return result.data as T;
}

export function OverviewPage() {
  const range = useRange();
  const overview = useQuery({
    queryKey: ["admin-overview", range],
    queryFn: () => adminOverview({ data: range }),
    refetchInterval: 30_000,
  });
  const usage = useQuery({
    queryKey: ["admin-usage", range],
    queryFn: () => adminUsage({ data: range }),
    refetchInterval: 30_000,
  });
  const data = overview.data?.success ? overview.data.data : null;
  const split = usage.data?.success ? usage.data.data : null;

  return (
    <div className="space-y-[21px]">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Command Center</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Live picture of people, sessions, and work across ERP and CRM. Percentages appear only
          when the previous period has a comparable count.
        </p>
      </div>
      {overview.isError || (overview.data && !overview.data.success) ? (
        <p className="text-sm text-red-600">
          {overview.data && !overview.data.success
            ? overview.data.error
            : "Could not load the overview."}
        </p>
      ) : null}
      <div className="grid gap-[13px] sm:grid-cols-2 xl:grid-cols-5">
        {data ? (
          [
            ["Total employees", data.metrics.totalEmployees, "/admin/employees"],
            ["Currently online", data.metrics.currentlyOnline, "/admin/attendance"],
            ["Active now", data.metrics.activeNow, "/admin/activity"],
            ["Offline", data.metrics.offline, "/admin/employees"],
            ["Sessions", data.metrics.sessions, "/admin/attendance"],
            ["Recorded events", data.metrics.activities, "/admin/activity"],
            ["Tasks completed", data.metrics.tasksCompleted, "/admin/work"],
            ["Pending tasks", data.metrics.tasksPending, "/admin/work"],
            ["Security alerts", data.metrics.securityAlerts, "/admin/security"],
            ["People with events", data.metrics.activePeople, "/admin/activity"],
          ].map(([label, metric, href]) => (
            <a
              key={String(label)}
              href={href as string}
              className="rounded-xl border border-slate-200 bg-white p-[13px] hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="text-xs text-slate-500">{label as string}</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {(metric as { value: number }).value}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {(metric as { change: number | null }).change === null
                  ? "No prior-period comparison"
                  : `${(metric as { change: number }).change > 0 ? "+" : ""}${(metric as { change: number }).change}% vs previous period`}
              </div>
            </a>
          ))
        ) : (
          <p className="text-sm text-slate-500">Loading overview…</p>
        )}
      </div>

      <div className="grid gap-[21px] lg:grid-cols-[1.618fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-[21px] dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">Live activity</h2>
          <p className="mb-3 text-xs text-slate-500">
            Events captured after this release, plus nothing invented before that.
          </p>
          <ul className="space-y-2">
            {(data?.recentEvents ?? []).length === 0 ? (
              <li className="text-sm text-slate-500">
                No monitoring events in this range yet. A login or a page visit will show up here.
              </li>
            ) : (
              data?.recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800"
                >
                  <div>
                    <div className="font-medium">
                      {event.employeeName || "Unknown"} · {event.action}
                    </div>
                    <div className="text-xs text-slate-500">
                      {event.application} · {event.module || "—"} · {event.eventType}
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-slate-500">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-[21px] dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">Who is online</h2>
          <ul className="mt-3 space-y-2">
            {(data?.presence ?? [])
              .filter((person) => person.status !== "offline")
              .slice(0, 8)
              .map((person) => (
                <li key={person.id}>
                  <Link
                    to="/admin/employees/$userId"
                    params={{ userId: person.id }}
                    className="flex items-center justify-between text-sm hover:text-blue-600"
                  >
                    <span>{person.name}</span>
                    <span className="text-xs uppercase text-slate-500">
                      {person.status} · {person.application}
                    </span>
                  </Link>
                </li>
              ))}
            {(data?.presence ?? []).every((person) => person.status === "offline") ? (
              <li className="text-sm text-slate-500">
                Nobody has a heartbeat inside the online window.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-[21px] dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold">Events by application</h2>
        {(split?.byApp.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">No events to chart in this range.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={split?.byApp ?? []}>
                <XAxis dataKey="application" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

export function EmployeesPage() {
  const { app } = useAdminFilters();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["admin-employees", q, app, status],
    queryFn: () => adminEmployees({ data: { q, app, status } }),
  });
  const rows = query.data?.success ? query.data.data : [];
  return (
    <Section
      title="Employee Intelligence"
      note="Accounts are the existing users. Status comes from the session heartbeat, not from a guessed schedule."
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, id"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="offline">Offline</option>
        </select>
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
          onClick={() => downloadCsv("employees.csv", rows as never)}
        >
          Export CSV
        </button>
      </div>
      <Table
        columns={["Name", "Email", "Role", "Department", "App", "Status", "Last heartbeat"]}
        rows={rows.map((person) => [
          <Link
            key={person.id}
            to="/admin/employees/$userId"
            params={{ userId: person.id }}
            className="font-medium text-blue-600"
          >
            {person.name}
          </Link>,
          person.email,
          person.role,
          person.department || "Not recorded",
          person.productScope,
          person.status,
          person.lastHeartbeatAt
            ? new Date(person.lastHeartbeatAt).toLocaleString()
            : "No session yet",
        ])}
      />
    </Section>
  );
}

export function EmployeeProfilePage({ userId }: { userId: string }) {
  const range = useRange();
  const query = useQuery({
    queryKey: ["admin-employee", userId, range],
    queryFn: () => adminEmployee({ data: { ...range, id: userId } }),
  });
  if (!query.data) return <p className="text-sm text-slate-500">Loading employee…</p>;
  if (!query.data.success) return <p className="text-sm text-red-600">{query.data.error}</p>;
  const detail = query.data.data;
  const hours = Math.round((detail.recordedSessionMs / 36e5) * 10) / 10;
  return (
    <Section
      title={detail.user.name}
      note={`${detail.user.email} · ${detail.user.role} · ${detail.user.productScope}. Reporting manager is not stored on the user record.`}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Assigned tasks" value={detail.work.assigned} />
        <Stat label="Completed" value={detail.work.completed} />
        <Stat label="Pending" value={detail.work.pending} />
        <Stat label="Overdue" value={detail.work.overdue} />
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Recorded session time in this range: {hours} hours. This is login-to-heartbeat time, not a
        productivity score. Location: {detail.location}.
      </p>
      <h3 className="mb-2 text-sm font-semibold">Companies assigned</h3>
      <p className="mb-4 text-sm">
        {detail.work.companies.length
          ? detail.work.companies.map((c) => c.name).join(", ")
          : "None as manager, CSM, or sales agent."}
      </p>
      <h3 className="mb-2 text-sm font-semibold">Sessions</h3>
      <Table
        columns={["Login", "Logout", "App", "Browser", "OS", "IP", "Status"]}
        rows={detail.sessions.map((session) => [
          new Date(session.loginAt).toLocaleString(),
          session.logoutAt ? new Date(session.logoutAt).toLocaleString() : "Still open",
          session.application,
          session.browser || "Unknown",
          session.os || "Unknown",
          session.ipAddress || "Not recorded",
          session.status,
        ])}
      />
      <h3 className="mb-2 mt-4 text-sm font-semibold">Activity</h3>
      <Table
        columns={["When", "Action", "App", "Module"]}
        rows={detail.events.map((event) => [
          new Date(event.createdAt).toLocaleString(),
          event.action,
          event.application,
          event.module,
        ])}
      />
    </Section>
  );
}

export function ActivityPage() {
  const range = useRange();
  const [eventType, setEventType] = useState("all");
  const [paused, setPaused] = useState(false);
  const query = useQuery({
    queryKey: ["admin-events", range, eventType],
    queryFn: () => adminEvents({ data: { ...range, eventType, limit: 80 } }),
    refetchInterval: paused ? false : 15_000,
  });
  const rows = query.data?.success ? query.data.data.rows : [];
  return (
    <Section
      title="Live activity"
      note="Polls every 15 seconds. Pause stops the refresh. Page visits and logins are recorded. Mouse movement is not."
    >
      <div className="mb-3 flex gap-2">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {["all", "auth", "navigation", "security"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <Table
        columns={["When", "Person", "Action", "App", "Module", "Type"]}
        rows={rows.map((event) => [
          new Date(event.createdAt).toLocaleString(),
          event.employeeName || "—",
          event.action,
          event.application,
          event.module,
          event.eventType,
        ])}
      />
    </Section>
  );
}

export function AttendancePage() {
  const range = useRange();
  const [q, setQ] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-sessions", range, q],
    queryFn: () => adminSessions({ data: { ...range, q } }),
    refetchInterval: 30_000,
  });
  const rows = query.data?.success ? query.data.data : [];
  return (
    <Section
      title="Attendance and sessions"
      note="A session is one login. Duration runs until logout, termination, or the last heartbeat. City and GPS are unavailable because location is not collected."
    >
      <div className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
          onClick={() =>
            downloadCsv(
              "sessions.csv",
              rows.map((row) => ({
                name: row.name,
                email: row.email,
                login: row.session.loginAt,
                logout: row.session.logoutAt,
                application: row.session.application,
                status: row.session.status,
                ip: row.session.ipAddress,
                browser: row.session.browser,
              })),
            )
          }
        >
          Export CSV
        </button>
      </div>
      <Table
        columns={["Employee", "Login", "Logout", "App", "Device", "Status", ""]}
        rows={rows.map((row) => [
          row.name,
          new Date(row.session.loginAt).toLocaleString(),
          row.session.logoutAt ? new Date(row.session.logoutAt).toLocaleString() : "Open",
          row.session.application,
          `${row.session.browser || "Unknown"} · ${row.session.os || "Unknown"}`,
          row.session.status,
          row.session.logoutAt ? (
            "—"
          ) : (
            <button
              key={row.session.id}
              type="button"
              className="text-red-600"
              onClick={() => {
                if (!window.confirm(`End ${row.name}'s session? They will need to sign in again.`))
                  return;
                void adminTerminateSession({ data: { sessionId: row.session.id } }).then(
                  (result) => {
                    if (!result.success) toast.error(result.error);
                    else {
                      toast.success("Session ended");
                      void client.invalidateQueries({ queryKey: ["admin-sessions"] });
                    }
                  },
                );
              }}
            >
              End session
            </button>
          ),
        ])}
      />
    </Section>
  );
}

export function WorkPage() {
  const range = useRange();
  const query = useQuery({
    queryKey: ["admin-work", range],
    queryFn: () => adminWork({ data: range }),
  });
  const data = query.data?.success ? query.data.data : null;
  return (
    <Section title="Work and productivity" note={data?.note ?? "Loading task records…"}>
      {data ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Assigned" value={data.assigned} />
          <Stat label="Completed in range" value={data.completedInRange} />
          <Stat label="Pending" value={data.pending} />
          <Stat label="Overdue" value={data.overdue} />
          <Stat label="ERP tasks" value={data.byScope.erp} />
          <Stat label="CRM tasks" value={data.byScope.crm} />
        </div>
      ) : null}
    </Section>
  );
}

export function ErpPage() {
  const range = useRange();
  const query = useQuery({
    queryKey: ["admin-erp", range],
    queryFn: () => adminErp({ data: range }),
  });
  const data = query.data?.success ? query.data.data : null;
  return (
    <Section title="ERP monitoring" note={data?.note ?? ""}>
      {data ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Companies" value={data.companies} />
            <Stat label="Created in range" value={data.companiesCreated} />
            <Stat label="Payments recorded" value={data.paymentsRecorded} />
            <Stat label="Tickets" value={data.tickets} />
            <Stat label="Tickets resolved" value={data.ticketsResolved} />
            <Stat label="Tasks completed" value={data.tasksCompleted} />
          </div>
          <h3 className="mb-2 text-sm font-semibold">ERP activity log</h3>
          <Table
            columns={["When", "Who", "What"]}
            rows={data.activityLog.map((row) => [
              new Date(row.createdAt).toLocaleString(),
              row.who,
              row.what,
            ])}
          />
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading ERP records…</p>
      )}
    </Section>
  );
}

export function CrmPage() {
  const range = useRange();
  const query = useQuery({
    queryKey: ["admin-crm", range],
    queryFn: () => adminCrm({ data: range }),
  });
  const data = query.data?.success ? query.data.data : null;
  return (
    <Section title="CRM monitoring" note={data?.note ?? ""}>
      {data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Accounts" value={data.accounts} />
          <Stat label="Created in range" value={data.accountsCreated} />
          <Stat label="Tasks pending" value={data.tasksPending} />
          <Stat label="Tasks completed" value={data.tasksCompleted} />
          <Stat label="Payments recorded" value={data.paymentsRecorded} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Loading CRM records…</p>
      )}
    </Section>
  );
}

export function SecurityPage() {
  const range = useRange();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-security", range],
    queryFn: () => adminSecurity({ data: range }),
  });
  const rows = query.data?.success ? query.data.data : [];
  return (
    <Section
      title="Security center"
      note="Failed logins, a new browser, and a second open session are the rules in place. Alerts are never used to block someone automatically."
    >
      <Table
        columns={["When", "Type", "Severity", "Who", "Status", ""]}
        rows={rows.map((row) => [
          new Date(row.createdAt).toLocaleString(),
          row.eventType,
          row.severity,
          row.employeeName || "Unknown account",
          row.investigationStatus,
          row.investigationStatus === "resolved" ? (
            "—"
          ) : (
            <button
              key={row.id}
              type="button"
              className="text-blue-600"
              onClick={() => {
                void adminReviewSecurity({ data: { id: row.id, status: "resolved" } }).then(() => {
                  toast.success("Marked reviewed");
                  void client.invalidateQueries({ queryKey: ["admin-security"] });
                });
              }}
            >
              Mark resolved
            </button>
          ),
        ])}
      />
    </Section>
  );
}

export function ReportsPage() {
  const range = useRange();
  const sessions = useQuery({
    queryKey: ["admin-sessions", range, ""],
    queryFn: () => adminSessions({ data: { ...range, q: "" } }),
  });
  const events = useQuery({
    queryKey: ["admin-events-report", range],
    queryFn: () => adminEvents({ data: { ...range, limit: 200 } }),
  });
  return (
    <Section
      title="Reports"
      note="Exports use the rows already loaded for this date range. PDF is not generated."
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
          onClick={() =>
            sessions.data?.success &&
            downloadCsv(
              "login-report.csv",
              sessions.data.data.map((row) => ({
                name: row.name,
                login: row.session.loginAt,
                logout: row.session.logoutAt ?? "",
                application: row.session.application,
                status: row.session.status,
              })),
            )
          }
        >
          Login report CSV
        </button>
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
          onClick={() =>
            events.data?.success &&
            downloadCsv(
              "activity-report.csv",
              events.data.data.rows.map((row) => ({
                when: row.createdAt,
                who: row.employeeName,
                action: row.action,
                application: row.application,
                module: row.module,
              })),
            )
          }
        >
          Activity report CSV
        </button>
      </div>
    </Section>
  );
}

export function HealthPage() {
  const query = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminHealth(),
    refetchInterval: 20_000,
  });
  const data = query.data?.success ? query.data.data : null;
  return (
    <Section title="System health" note={data?.note ?? "Checking the database…"}>
      {data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Database" value={data.database.ok ? "Up" : "Down"} />
          <Stat label="Query latency" value={`${data.database.latencyMs} ms`} />
          <Stat
            label="Process uptime"
            value={`${Math.round(data.processUptimeSeconds / 60)} min`}
          />
          <Stat label="Process memory" value={`${data.processMemoryMb} MB`} />
          <Stat label="CPU" value="Unavailable" />
          <Stat label="Background jobs" value="Unavailable" />
        </div>
      ) : null}
    </Section>
  );
}

export function AuditPage() {
  const range = useRange();
  const query = useQuery({
    queryKey: ["admin-audit", range],
    queryFn: () => adminAudit({ data: range }),
  });
  const rows = unwrap(query.data, []);
  return (
    <Section
      title="Audit log"
      note="These rows are written when an admin changes settings, ends a session, or resolves a security event. There is no edit or delete action."
    >
      <Table
        columns={["When", "Admin", "Action", "Resource"]}
        rows={rows.map((row) => [
          new Date(row.createdAt).toLocaleString(),
          row.adminName,
          row.action,
          `${row.resourceType} ${row.resourceId ?? ""}`,
        ])}
      />
    </Section>
  );
}

export function SettingsPage() {
  const query = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminSettings() });
  const client = useQueryClient();
  const config = query.data?.success ? query.data.data : null;
  const [form, setForm] = useState<null | typeof config>(null);
  const current = form ?? config;
  return (
    <Section
      title="Admin settings"
      note="Every Admin account can open Command Center. Finer roles such as HR or read-only are not on the user record, so they are not pretended here. These values do not change the 14-day login cookie."
    >
      {current ? (
        <form
          className="grid max-w-lg gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void adminSaveSettings({ data: current }).then((result) => {
              if (!result.success) toast.error(result.error);
              else {
                toast.success("Settings saved");
                void client.invalidateQueries({ queryKey: ["admin-settings"] });
                setForm(null);
              }
            });
          }}
        >
          <Field
            label="Heartbeat seconds"
            value={current.heartbeatSeconds}
            onChange={(value) => setForm({ ...current, heartbeatSeconds: value })}
          />
          <Field
            label="Online window (minutes)"
            value={current.onlineMinutes}
            onChange={(value) => setForm({ ...current, onlineMinutes: value })}
          />
          <Field
            label="Idle after (minutes without a page view)"
            value={current.idleMinutes}
            onChange={(value) => setForm({ ...current, idleMinutes: value })}
          />
          <Field
            label="Failed logins before a high alert"
            value={current.failedLoginThreshold}
            onChange={(value) => setForm({ ...current, failedLoginThreshold: value })}
          />
          <Field
            label="Retention note (days, stored only)"
            value={current.retentionDays}
            onChange={(value) => setForm({ ...current, retentionDays: value })}
          />
          <button
            type="submit"
            className="w-fit rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
          >
            Save
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Loading settings…</p>
      )}
    </Section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-[13px]">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
        {note ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{note}</p> : null}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-[21px] dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="text-sm text-slate-500">Nothing in this range.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
            {columns.map((column) => (
              <th key={column} className="px-2 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
