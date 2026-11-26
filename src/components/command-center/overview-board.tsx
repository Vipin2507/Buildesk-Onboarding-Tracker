import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAdminFilters } from "@/components/command-center/filters";
import { adminHealth, adminOverview, adminUsage, adminWork } from "@/server/api/command-center";

const ERP = "#0891b2";
const CRM = "#7c3aed";
const BRAND = "#009bff";

const APP_COLOR: Record<string, string> = {
  erp: ERP,
  crm: CRM,
  admin: BRAND,
};

type Tone = "slate" | "green" | "blue" | "amber" | "red" | "violet";

const TONE: Record<Tone, string> = {
  slate: "bg-slate-400",
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
};

export function OverviewBoard() {
  const filters = useAdminFilters();
  const range = { from: filters.from, to: filters.to, app: filters.app };
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

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
  const health = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminHealth(),
    refetchInterval: 20_000,
  });
  const work = useQuery({
    queryKey: ["admin-work", range],
    queryFn: () => adminWork({ data: range }),
  });

  const data = overview.data?.success ? overview.data.data : null;
  const split = usage.data?.success ? usage.data.data : null;
  const healthData = health.data?.success ? health.data.data : null;
  const workData = work.data?.success ? work.data.data : null;
  const presence = data?.presence ?? [];
  const online = presence.filter((person) => person.status !== "offline");
  const shown = (online.length ? online : presence).slice(0, 10);

  const tiles = data
    ? [
        { label: "Employees", metric: data.metrics.totalEmployees, href: "/admin/employees" as const, tone: "slate" as const },
        { label: "Online", metric: data.metrics.currentlyOnline, href: "/admin/attendance" as const, tone: "green" as const },
        { label: "Sessions", metric: data.metrics.sessions, href: "/admin/attendance" as const, tone: "blue" as const },
        { label: "Offline", metric: data.metrics.offline, href: "/admin/employees" as const, tone: "slate" as const },
        { label: "Events", metric: data.metrics.activities, href: "/admin/activity" as const, tone: "violet" as const },
        { label: "Tasks done", metric: data.metrics.tasksCompleted, href: "/admin/work" as const, tone: "green" as const },
        { label: "Pending", metric: data.metrics.tasksPending, href: "/admin/work" as const, tone: "amber" as const },
        { label: "Alerts", metric: data.metrics.securityAlerts, href: "/admin/security" as const, tone: "red" as const },
      ]
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-none tracking-tight">Command Center</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {now.toLocaleString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            Heartbeats decide who is online. Counts follow the header range.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      {overview.isLoading && !data ? (
        <div className="h-[72px] animate-pulse rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0E1C33]" />
      ) : null}
      {overview.data && !overview.data.success ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {overview.data.error}
        </p>
      ) : null}

      {tiles.length > 0 ? (
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 xl:grid-cols-8 dark:border-white/10 dark:bg-[#0E1C33]">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              to={tile.href}
              title={tile.metric.note}
              className="relative flex min-h-[68px] flex-col justify-center border-b border-r border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              <span className={`absolute inset-y-2 left-0 w-0.5 ${TONE[tile.tone]}`} />
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {tile.label}
              </span>
              <span className="mt-1 text-[22px] font-semibold leading-none tabular-nums">
                {tile.metric.value}
              </span>
              <span
                className={`mt-1 truncate text-[10px] ${
                  tile.metric.change == null
                    ? "text-slate-400"
                    : tile.metric.change >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {tile.metric.change == null
                  ? "Now"
                  : `${tile.metric.change > 0 ? "+" : ""}${tile.metric.change}% vs prior`}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid items-stretch gap-3 xl:grid-cols-[1.618fr_1fr]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0E1C33]">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-white/10">
            <h2 className="text-[13px] font-semibold">Live activity</h2>
            <Link to="/admin/activity" className="text-[11px] font-semibold text-[#009bff]">
              Open feed
            </Link>
          </div>
          {(data?.recentEvents ?? []).length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-slate-500">
              No recorded events in this range.
            </p>
          ) : (
            <ol>
              {data?.recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[3.25rem_12px_minmax(0,1fr)] items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-white/5"
                >
                  <time className="pt-0.5 text-[11px] tabular-nums text-slate-400">
                    {clock(event.createdAt)}
                  </time>
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: APP_COLOR[event.application] ?? "#64748b" }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-5">
                      <span className="font-semibold">{event.employeeName || "Unknown"}</span>
                      <span className="text-slate-600 dark:text-slate-300">{event.action}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <AppBadge app={event.application} />
                      <span>{event.module || event.eventType}</span>
                      {event.resourceType ? <span>· {event.resourceType}</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0E1C33]">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-white/10">
            <h2 className="text-[13px] font-semibold">Who is online</h2>
            <div className="flex gap-1.5 text-[10px] font-medium">
              <span className="text-emerald-600">{presence.filter((p) => p.status === "active").length} active</span>
              <span className="text-amber-600">{presence.filter((p) => p.status === "idle").length} idle</span>
              <span className="text-slate-400">{presence.filter((p) => p.status === "offline").length} off</span>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-slate-500">No employees in this filter.</p>
          ) : (
            <ul className="min-h-0 flex-1">
              {shown.map((person) => (
                <li key={person.id} className="border-b border-slate-100 last:border-b-0 dark:border-white/5">
                  <Link
                    to="/admin/employees/$userId"
                    params={{ userId: person.id }}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        person.status === "active"
                          ? "bg-emerald-500"
                          : person.status === "idle"
                            ? "bg-amber-500"
                            : "bg-slate-300"
                      }`}
                    />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-100">
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{person.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {person.department || person.jobTitle || "No department"} ·{" "}
                        {person.status === "offline" ? "offline" : sessionAge(person.loginAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <AppBadge app={person.application} />
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {person.lastHeartbeatAt ? clock(person.lastHeartbeatAt) : "—"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/admin/employees"
            className="border-t border-slate-100 px-3 py-2 text-[11px] font-semibold text-[#009bff] dark:border-white/10"
          >
            All employees
          </Link>
        </section>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-[1.618fr_1fr]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0E1C33]">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold">Activity over time</h2>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <Legend color={ERP} label="ERP" />
              <Legend color={CRM} label="CRM" />
              <Legend color={BRAND} label="Admin" />
            </div>
          </div>
          {(split?.byDay.length ?? 0) === 0 ? (
            <p className="flex h-44 items-center justify-center text-[13px] text-slate-500">
              No events in this range.
            </p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={split?.byDay ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-white/10" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="erp" name="ERP" stackId="a" stroke={ERP} fill={ERP} fillOpacity={0.35} />
                  <Area type="monotone" dataKey="crm" name="CRM" stackId="a" stroke={CRM} fill={CRM} fillOpacity={0.35} />
                  <Area type="monotone" dataKey="admin" name="Admin" stackId="a" stroke={BRAND} fill={BRAND} fillOpacity={0.28} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {workData ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Follow-up tasks: {workData.byScope.erp} ERP · {workData.byScope.crm} CRM ·{" "}
              {workData.completedInRange} completed in range · {workData.pending} pending
            </p>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0E1C33]">
          <h2 className="mb-2 text-[13px] font-semibold">Module usage</h2>
          {(split?.modules.length ?? 0) === 0 ? (
            <p className="flex h-36 items-center justify-center text-[13px] text-slate-500">
              No module events in this range.
            </p>
          ) : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={split?.modules ?? []} layout="vertical" margin={{ left: 4, right: 8, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="module" width={92} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Events" radius={[0, 4, 4, 0]} barSize={10}>
                    {(split?.modules ?? []).map((row) => (
                      <Cell key={`${row.application}-${row.module}`} fill={APP_COLOR[row.application] ?? BRAND} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2 text-[12px] dark:border-white/10">
            <HealthLine label="Database" value={healthData ? (healthData.database.ok ? "Connected" : "Down") : "Checking"} ok={Boolean(healthData?.database.ok)} />
            <HealthLine label="Query" value={healthData ? `${healthData.database.latencyMs} ms` : "—"} ok={Boolean(healthData?.database.ok)} />
            <HealthLine label="Process" value={healthData ? `${Math.round(healthData.processUptimeSeconds / 60)} min` : "—"} ok />
            <HealthLine label="Memory" value={healthData ? `${healthData.processMemoryMb} MB` : "—"} ok />
          </div>
        </section>
      </div>
    </div>
  );
}

function AppBadge({ app }: { app: string }) {
  const tone =
    app === "crm"
      ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-100"
      : app === "erp"
        ? "bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-100"
        : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200";
  return <span className={`rounded px-1 py-px text-[10px] font-semibold uppercase ${tone}`}>{app}</span>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function HealthLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function sessionAge(loginAt: string | null) {
  if (!loginAt) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(loginAt).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}
