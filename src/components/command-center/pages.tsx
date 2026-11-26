import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

import { OverviewBoard } from "@/components/command-center/overview-board";
import { downloadCsv, useAdminFilters } from "@/components/command-center/filters";
import {
  adminAudit,
  adminCrm,
  adminEmployee,
  adminEmployees,
  adminErp,
  adminEvents,
  adminHealth,
  adminReviewSecurity,
  adminSaveSettings,
  adminSecurity,
  adminSessions,
  adminSettings,
  adminTerminateSession,
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}

export function OverviewPage() {
  return <OverviewBoard />;
}

function AppBadge({ app }: { app: string }) {
  const tone =
    app === "crm"
      ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-100"
      : app === "erp"
        ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-100"
        : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{app}</span>
  );
}

function HealthRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-slate-400" />
        )}
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}

export function EmployeesPage() {
  const { app } = useAdminFilters();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState<"activity" | "name">("activity");
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["admin-employees", app],
    queryFn: () => adminEmployees({ data: { app, status: "all" } }),
  });
  const all = query.data?.success ? query.data.data : [];
  const departments = [
    ...new Set(all.map((person) => person.department).filter(Boolean)),
  ] as string[];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((person) => (status === "all" ? true : person.status === status))
      .filter((person) => (department === "all" ? true : person.department === department))
      .filter((person) => {
        if (!needle) return true;
        return (
          person.name.toLowerCase().includes(needle) ||
          person.email.toLowerCase().includes(needle) ||
          person.id.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        return (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "");
      });
  }, [all, q, status, department, sort]);
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const counts = {
    total: all.length,
    online: all.filter((person) => person.status !== "offline").length,
    active: all.filter((person) => person.status === "active").length,
    offline: all.filter((person) => person.status === "offline").length,
    erp: all.filter((person) => person.productScope === "erp").length,
    crm: all.filter((person) => person.productScope === "crm").length,
  };

  return (
    <div className="space-y-[13px]">
      <div>
        <h1 className="text-[26px] font-semibold leading-none tracking-tight">
          Employee Intelligence
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Status comes from the session heartbeat. Location is not collected.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Mini label="Employees" value={counts.total} tone="bg-white dark:bg-[#0E1C33]" />
        <Mini
          label="Online"
          value={counts.online}
          tone="bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50"
        />
        <Mini
          label="Active now"
          value={counts.active}
          tone="bg-cyan-50 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-50"
        />
        <Mini label="Offline" value={counts.offline} tone="bg-slate-100 dark:bg-slate-800/70" />
        <Mini label="ERP accounts" value={counts.erp} tone="bg-cyan-600 text-white" />
        <Mini label="CRM accounts" value={counts.crm} tone="bg-violet-600 text-white" />
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0E1C33]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-white/10">
          <input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(0);
            }}
            placeholder="Name, email, or id"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-[#07111F]"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-[#07111F]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="offline">Offline</option>
          </select>
          <select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-[#07111F]"
          >
            <option value="all">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "activity" | "name")}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-[#07111F]"
          >
            <option value="activity">Last activity</option>
            <option value="name">Name</option>
          </select>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
            onClick={() =>
              downloadCsv(
                "employees.csv",
                filtered.map((person) => ({
                  name: person.name,
                  email: person.email,
                  department: person.department ?? "",
                  role: person.role,
                  application: person.productScope,
                  status: person.status,
                  lastActive: person.lastActiveAt ?? "",
                })),
              )
            }
          >
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "Employee",
                  "Department",
                  "Designation",
                  "Application",
                  "Status",
                  "Last activity",
                  "",
                ].map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => (
                <tr
                  key={person.id}
                  className="border-t border-slate-100 hover:bg-blue-50/50 dark:border-white/5 dark:hover:bg-white/5"
                >
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/employees/$userId"
                      params={{ userId: person.id }}
                      className="flex items-center gap-2"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-800 dark:bg-blue-500/20 dark:text-blue-100">
                        {initials(person.name)}
                      </span>
                      <span>
                        <span className="block font-medium">{person.name}</span>
                        <span className="block text-[11px] text-slate-500">{person.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {person.department || "Not recorded"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {person.jobTitle || person.role}
                  </td>
                  <td className="px-3 py-2">
                    <AppBadge app={person.productScope} />
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 capitalize">
                      <span
                        className={`h-2 w-2 rounded-full ${person.status === "active" ? "bg-emerald-500" : person.status === "idle" ? "bg-amber-500" : "bg-slate-400"} ${person.status === "active" ? "animate-pulse" : ""}`}
                      />
                      {person.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {person.lastActiveAt
                      ? new Date(person.lastActiveAt).toLocaleString()
                      : "No session yet"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to="/admin/employees/$userId"
                      params={{ userId: person.id }}
                      className="text-xs font-semibold text-blue-600"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    No employees match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-white/10">
          <span>{filtered.length} people</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
            >
              Previous
            </button>
            <span className="py-1">
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0E1C33]">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold leading-none tabular-nums">{value}</div>
    </div>
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
          className="grid max-w-lg gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0E1C33]"
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
    <div className="space-y-3">
      <div>
        <h1 className="text-[26px] font-semibold leading-none tracking-tight">{title}</h1>
        {note ? <p className="mt-1 max-w-3xl text-[13px] text-slate-500">{note}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0E1C33]">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold leading-none tabular-nums">{value}</div>
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-[13px] text-slate-500">Nothing in this range.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0E1C33]">
      <table className="w-full text-left text-[13px]">
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
            <tr
              key={index}
              className="border-b border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
            >
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
