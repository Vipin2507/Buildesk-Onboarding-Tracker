import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CalendarDays,
  PhoneCall,
  Target,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CrmUsageAccountPage,
  CrmUsageDay,
  CrmUsagePersonTotal,
} from "@/types/crm-usage";

const EASE = [0.22, 1, 0.36, 1] as const;

const METRICS = [
  { id: "leads", label: "Leads", color: "#009bff", dayKey: "leads" as const },
  { id: "followups", label: "Follow-ups", color: "#0d9488", dayKey: "followups" as const },
  { id: "visits", label: "Visits done", color: "#f59e0b", dayKey: "visitsConducted" as const },
  { id: "bookings", label: "Bookings", color: "#ea580c", dayKey: "bookings" as const },
  { id: "calls", label: "Calls", color: "#6366f1", dayKey: "calls" as const },
  { id: "connected", label: "Connected", color: "#22c55e", dayKey: "connectedCalls" as const },
] as const;

type MetricId = (typeof METRICS)[number]["id"];
type TrendMode = "area" | "line" | "bar";
type PeopleMetric = "leads" | "calls" | "bookings" | "followups" | "visitsConducted";
type CoverageFilter = "ok" | "all";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pct(part: number, whole: number) {
  if (!whole) return null;
  return Math.round((part / whole) * 100);
}

function formatPct(part: number, whole: number) {
  const value = pct(part, whole);
  return value == null ? "—" : `${value}%`;
}

function dayValue(day: CrmUsageDay, key: (typeof METRICS)[number]["dayKey"]) {
  if (!day.ok) return null;
  if (key === "bookings") return day.bookings;
  return day[key];
}

function ReportCard({
  title,
  subtitle,
  icon: Icon,
  delay = 0,
  className,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: typeof Activity;
  delay?: number;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {subtitle ? (
                <p className="text-[11px] text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </motion.section>
  );
}

function KpiTile({
  label,
  value,
  hint,
  accent,
  delay,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: EASE }}
      className="relative overflow-hidden rounded-xl border border-border/80 bg-card px-3 py-2.5 shadow-sm"
    >
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: accent }}
      />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</div>
      ) : null}
    </motion.div>
  );
}

function RatioRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  const numeric = value.endsWith("%") ? Number(value.replace("%", "")) : null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, numeric ?? 0)}%` }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </div>
    </div>
  );
}

export function CrmUsageReportsPanel({ page }: { page: CrmUsageAccountPage }) {
  const summary = page.summary;
  const [enabledMetrics, setEnabledMetrics] = useState<MetricId[]>([
    "leads",
    "followups",
    "calls",
    "bookings",
  ]);
  const [trendMode, setTrendMode] = useState<TrendMode>("area");
  const [coverage, setCoverage] = useState<CoverageFilter>("ok");
  const [peopleMetric, setPeopleMetric] = useState<PeopleMetric>("calls");
  const [peopleLimit, setPeopleLimit] = useState(8);

  const okDays = useMemo(
    () => page.days.filter((d) => d.ok),
    [page.days],
  );

  const chartDays = useMemo(() => {
    const source = coverage === "ok" ? okDays : page.days;
    return source.map((day) => {
      const row: Record<string, string | number | null> = {
        date: day.date.slice(5),
        fullDate: day.date,
      };
      for (const metric of METRICS) {
        row[metric.label] = dayValue(day, metric.dayKey);
      }
      row.Users = day.ok ? day.activeUsers : null;
      row.Score = day.ok ? day.score : null;
      return row;
    });
  }, [coverage, okDays, page.days]);

  const weekdayData = useMemo(() => {
    const buckets = WEEKDAYS.map((day) => ({
      day,
      Leads: 0,
      "Follow-ups": 0,
      Calls: 0,
      Bookings: 0,
      Visits: 0,
    }));
    for (const day of okDays) {
      const index = new Date(`${day.date}T00:00:00`).getDay();
      buckets[index].Leads += day.leads;
      buckets[index]["Follow-ups"] += day.followups;
      buckets[index].Calls += day.calls;
      buckets[index].Bookings += day.bookings ?? 0;
      buckets[index].Visits += day.visitsConducted;
    }
    return buckets;
  }, [okDays]);

  const peopleMix = useMemo(() => {
    const productive = page.people.filter((p) => p.productive).length;
    const leadOnly = page.people.filter((p) => p.leadOnly).length;
    const idle = page.people.filter((p) => !p.productive && !p.leadOnly).length;
    return [
      { name: "Active", value: productive, fill: "#22c55e" },
      { name: "Leads only", value: leadOnly, fill: "#f59e0b" },
      { name: "Idle", value: idle, fill: "#94a3b8" },
    ].filter((row) => row.value > 0);
  }, [page.people]);

  const topPeople = useMemo(() => {
    const rows = [...page.people].sort(
      (a, b) => b[peopleMetric] - a[peopleMetric] || a.name.localeCompare(b.name),
    );
    return rows.slice(0, peopleLimit).map((person) => ({
      name: person.name.length > 16 ? `${person.name.slice(0, 14)}…` : person.name,
      fullName: person.name,
      value: person[peopleMetric],
      team: person.team,
    }));
  }, [page.people, peopleLimit, peopleMetric]);

  const executiveTable = useMemo(() => {
    return [...page.people]
      .sort((a, b) => b.calls - a.calls || b.leads - a.leads || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [page.people]);

  const totals = useMemo(() => {
    const leads = summary?.leads ?? 0;
    const followups = summary?.followups ?? 0;
    const visitsDone = summary?.visitsConducted ?? 0;
    const visitsSched = summary?.visitsScheduled ?? 0;
    const bookings = summary?.bookings;
    const calls = summary?.calls ?? 0;
    const connected = summary?.connectedCalls ?? 0;
    const activeDays = page.days.filter((d) => d.ok && d.hasCrmActivity).length;
    return {
      leads,
      followups,
      visitsDone,
      visitsSched,
      bookings,
      calls,
      connected,
      activeDays,
      savedDays: page.savedDays,
      expectedDays: page.expectedDays,
      failedDays: page.failedDays,
      peakUsers: summary?.activeUsers ?? 0,
      licensed: page.account.licensedUsers,
    };
  }, [page, summary]);

  const activeMetrics = METRICS.filter((m) => enabledMetrics.includes(m.id));

  function toggleMetric(id: MetricId) {
    setEnabledMetrics((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }

  if (!summary?.ok) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Saved usage data is required before Reports can analyze this window.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/80 px-3 py-2 shadow-sm"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Usage reports</div>
          <div className="text-[11px] text-muted-foreground">
            {page.from} → {page.to} · {totals.savedDays}/{totals.expectedDays} days saved
            {totals.failedDays ? ` · ${totals.failedDays} failed` : ""}
            {page.pattern ? ` · ${page.pattern}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Chart
          </span>
          {(["area", "line", "bar"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={trendMode === mode ? "default" : "outline"}
              className="h-7 rounded-lg px-2.5 text-[11px] capitalize"
              onClick={() => setTrendMode(mode)}
            >
              {mode}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {(["ok", "all"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={coverage === mode ? "default" : "outline"}
              className="h-7 rounded-lg px-2.5 text-[11px]"
              onClick={() => setCoverage(mode)}
            >
              {mode === "ok" ? "OK days" : "All days"}
            </Button>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label="Leads received"
          value={String(totals.leads)}
          hint={page.pattern}
          accent="#009bff"
          delay={0.02}
        />
        <KpiTile
          label="Calls done"
          value={String(totals.calls)}
          hint={`${formatPct(totals.connected, totals.calls)} connected`}
          accent="#6366f1"
          delay={0.05}
        />
        <KpiTile
          label="Site visits done"
          value={String(totals.visitsDone)}
          hint={`${totals.visitsSched} scheduled`}
          accent="#f59e0b"
          delay={0.08}
        />
        <KpiTile
          label="Booked"
          value={totals.bookings == null ? "—" : String(totals.bookings)}
          hint={
            totals.bookings == null
              ? "Booking feed unavailable"
              : `${formatPct(totals.bookings, totals.leads)} of leads`
          }
          accent="#ea580c"
          delay={0.11}
        />
        <KpiTile
          label="CRM active days"
          value={`${totals.activeDays}/${totals.savedDays}`}
          hint={`${formatPct(totals.peakUsers, totals.licensed)} peak seat use`}
          accent="#22c55e"
          delay={0.14}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {METRICS.map((metric) => {
          const on = enabledMetrics.includes(metric.id);
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => toggleMetric(metric.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                on
                  ? "border-transparent text-white shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
              style={on ? { background: metric.color } : undefined}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: on ? "#fff" : metric.color }}
              />
              {metric.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
        <ReportCard
          title="Activity trend"
          subtitle="Toggle metrics above · gaps mean unsaved or failed days"
          icon={Activity}
          delay={0.08}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {trendMode === "bar" ? (
                <BarChart data={chartDays} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {activeMetrics.map((metric) => (
                    <Bar
                      key={metric.id}
                      dataKey={metric.label}
                      fill={metric.color}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                </BarChart>
              ) : trendMode === "line" ? (
                <LineChart data={chartDays} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {activeMetrics.map((metric) => (
                    <Line
                      key={metric.id}
                      type="monotone"
                      dataKey={metric.label}
                      stroke={metric.color}
                      strokeWidth={2.25}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={chartDays} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    {activeMetrics.map((metric) => (
                      <linearGradient
                        key={metric.id}
                        id={`usage-fill-${metric.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {activeMetrics.map((metric) => (
                    <Area
                      key={metric.id}
                      type="monotone"
                      dataKey={metric.label}
                      stroke={metric.color}
                      strokeWidth={2}
                      fill={`url(#usage-fill-${metric.id})`}
                      connectNulls={false}
                    />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </ReportCard>

        <ReportCard
          title="Conversion funnel"
          subtitle="Ratios from saved OK days only"
          icon={Target}
          delay={0.12}
        >
          <div className="space-y-3.5">
            <RatioRow
              label="Follow-up rate"
              value={formatPct(totals.followups, totals.leads)}
              tone="#0d9488"
            />
            <RatioRow
              label="Visit close rate"
              value={formatPct(totals.visitsDone, totals.visitsSched)}
              tone="#f59e0b"
            />
            <RatioRow
              label="Booking rate"
              value={
                totals.bookings == null
                  ? "—"
                  : formatPct(totals.bookings, totals.leads)
              }
              tone="#ea580c"
            />
            <RatioRow
              label="Call connect rate"
              value={formatPct(totals.connected, totals.calls)}
              tone="#22c55e"
            />
            <RatioRow
              label="CRM active day rate"
              value={formatPct(totals.activeDays, totals.savedDays)}
              tone="#009bff"
            />
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              Peak seats{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {totals.peakUsers}/{totals.licensed || "—"}
              </span>
              {totals.licensed ? (
                <span> · {formatPct(totals.peakUsers, totals.licensed)} licensed</span>
              ) : null}
            </div>
          </div>
        </ReportCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          title="Weekday pattern"
          subtitle="Where activity clusters across the week"
          icon={CalendarDays}
          delay={0.14}
          className="xl:col-span-1"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Leads" fill="#009bff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Follow-ups" fill="#0d9488" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Calls" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

        <ReportCard
          title="People mix"
          subtitle="How the roster used CRM in this window"
          icon={Users}
          delay={0.16}
        >
          {peopleMix.length ? (
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={peopleMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {peopleMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-lg font-semibold tabular-nums text-foreground">
                  {page.people.length}
                </div>
                <div className="text-[10px] text-muted-foreground">people</div>
              </div>
            </div>
          ) : (
            <EmptyBlock label="No people totals in this window" />
          )}
        </ReportCard>

        <ReportCard
          title="Data coverage"
          subtitle="Quality of the saved usage window"
          icon={BarChart3}
          delay={0.18}
        >
          <div className="space-y-3">
            <CoverageStat
              label="Saved days"
              value={`${totals.savedDays}/${totals.expectedDays}`}
              percent={pct(totals.savedDays, totals.expectedDays) ?? 0}
              tone="#009bff"
            />
            <CoverageStat
              label="CRM active days"
              value={`${totals.activeDays}/${totals.savedDays || 1}`}
              percent={pct(totals.activeDays, totals.savedDays) ?? 0}
              tone="#22c55e"
            />
            <CoverageStat
              label="Failed fetches"
              value={String(totals.failedDays)}
              percent={pct(totals.failedDays, totals.expectedDays) ?? 0}
              tone="#ef4444"
            />
            <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
              Last fetched{" "}
              <span className="font-medium text-foreground">
                {page.lastFetchedAt ? page.lastFetchedAt.slice(0, 16).replace("T", " ") : "—"}
              </span>
            </div>
          </div>
        </ReportCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <ReportCard
          title="Executive productivity"
          subtitle="Top performers by calls, leads, visits, and bookings"
          icon={PhoneCall}
          delay={0.2}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="bg-[#1e5a8a] text-white">
                  {[
                    "Executive",
                    "Calls",
                    "Connected",
                    "Leads",
                    "Follow-ups",
                    "Visits",
                    "Bookings",
                    "Active days",
                  ].map((label) => (
                    <th key={label} className="px-2.5 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {executiveTable.map((person, index) => (
                    <motion.tr
                      key={person.name}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.02, ease: EASE }}
                      className={cn(
                        "border-b border-border/70",
                        index % 2 === 0 ? "bg-sky-50/60 dark:bg-sky-950/20" : "bg-card",
                      )}
                    >
                      <td className="px-2.5 py-2">
                        <div className="font-medium text-foreground">{person.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {person.leadOnly
                            ? "Leads only"
                            : person.productive
                              ? person.team || "Active"
                              : "Idle"}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 tabular-nums">{person.calls}</td>
                      <td className="px-2.5 py-2 tabular-nums">{person.connectedCalls}</td>
                      <td className="px-2.5 py-2 tabular-nums">{person.leads}</td>
                      <td className="px-2.5 py-2 tabular-nums">{person.followups}</td>
                      <td className="px-2.5 py-2 tabular-nums">
                        {person.visitsConducted}/{person.visitsScheduled}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums">{person.bookings}</td>
                      <td className="px-2.5 py-2 tabular-nums">{person.activeDays}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {executiveTable.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No executive totals yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {executiveTable.length ? (
                <tfoot>
                  <tr className="border-t border-border bg-muted/40 font-semibold">
                    <td className="px-2.5 py-2">Visible total</td>
                    <td className="px-2.5 py-2 tabular-nums">
                      {sumPeople(executiveTable, "calls")}
                    </td>
                    <td className="px-2.5 py-2 tabular-nums">
                      {sumPeople(executiveTable, "connectedCalls")}
                    </td>
                    <td className="px-2.5 py-2 tabular-nums">
                      {sumPeople(executiveTable, "leads")}
                    </td>
                    <td className="px-2.5 py-2 tabular-nums">
                      {sumPeople(executiveTable, "followups")}
                    </td>
                    <td className="px-2.5 py-2 tabular-nums">
                      {sumPeople(executiveTable, "visitsConducted")}/
                      {sumPeople(executiveTable, "visitsScheduled")}
                    </td>
                    <td className="px-2.5 py-2 tabular-nums">
                      {sumPeople(executiveTable, "bookings")}
                    </td>
                    <td className="px-2.5 py-2 tabular-nums">—</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </ReportCard>

        <ReportCard
          title="Calls & volume by executive"
          subtitle="Ranked horizontal view — switch the metric"
          icon={PhoneCall}
          delay={0.22}
          action={
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["calls", "Calls"],
                  ["leads", "Leads"],
                  ["followups", "Follow-ups"],
                  ["visitsConducted", "Visits"],
                  ["bookings", "Bookings"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeopleMetric(id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium",
                    peopleMetric === id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
              <select
                value={peopleLimit}
                onChange={(e) => setPeopleLimit(Number(e.target.value))}
                className="h-7 rounded-md border bg-background px-1.5 text-[10px]"
                aria-label="Top N executives"
              >
                {[5, 8, 12, 20].map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {topPeople.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topPeople}
                  layout="vertical"
                  margin={{ top: 4, right: 18, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, peopleMetricLabel(peopleMetric)]}
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.fullName ?? "")
                    }
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#3b82f6">
                    {topPeople.map((row, index) => (
                      <Cell
                        key={row.fullName}
                        fill={["#009bff", "#3b82f6", "#0d9488", "#f59e0b", "#6366f1"][index % 5]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBlock label="No executive volume to chart" />
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function peopleMetricLabel(metric: PeopleMetric) {
  if (metric === "visitsConducted") return "Visits";
  if (metric === "followups") return "Follow-ups";
  return metric.charAt(0).toUpperCase() + metric.slice(1);
}

function sumPeople(
  rows: CrmUsagePersonTotal[],
  key:
    | "calls"
    | "connectedCalls"
    | "leads"
    | "followups"
    | "visitsConducted"
    | "visitsScheduled"
    | "bookings",
) {
  return rows.reduce((sum, row) => sum + (row[key] || 0), 0);
}

function CoverageStat({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: string;
  percent: number;
  tone: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </div>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border/70 text-[12px] text-muted-foreground">
      {label}
    </div>
  );
}
