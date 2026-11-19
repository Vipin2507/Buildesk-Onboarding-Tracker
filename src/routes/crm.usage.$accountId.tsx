import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Download,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { z } from "zod";

import { CrmUsageReportsPanel } from "@/components/crm/crm-usage-reports-panel";
import { DesignTicketDateField } from "@/components/design-ticket/design-ticket-fields";
import {
  DesignTicketFilterBar,
  DesignTicketTabNav,
} from "@/components/design-ticket/design-ticket-shared";
import { PageWrap } from "@/components/page-header";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { getCrmUsageAccountPage, refreshCrmUsageAccount } from "@/lib/api";
import { crmAccountStatusLabel } from "@/lib/crm-account-status";
import { eachIsoDay, usageFocus, usageTag, usageTagTone } from "@/lib/crm-usage";
import { cn } from "@/lib/utils";
import type { CrmUsageAccountPage, CrmUsageDay } from "@/types/crm-usage";

const searchSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tab: z.enum(["overview", "reports", "people"]).optional(),
});

export const Route = createFileRoute("/crm/usage/$accountId")({
  validateSearch: (search) => searchSchema.parse(search),
  component: CrmUsageAccountPageView,
});

const EASE = [0.22, 1, 0.36, 1] as const;

type TabId = "overview" | "reports" | "people";

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { from: isoDate(start), to: isoDate(end) };
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint ? <div className="truncate text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function percent(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PeopleFilter = "all" | "productive" | "leads" | "idle";
type PeopleSort = "leads" | "followups" | "calls" | "bookings" | "activeDays";
type DayFilter = "all" | "used" | "quiet" | "failed" | "missing";

function dayStatus(day: CrmUsageDay) {
  if (!day.saved) return "Not saved";
  if (!day.ok) return "Failed";
  if (day.hasCrmActivity) return "Used CRM";
  if (day.leadOnly) return "Leads only";
  return "No CRM use";
}

function CrmUsageAccountPageView() {
  const { accountId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const initial = defaultRange();
  const [from, setFrom] = useState(search.from || initial.from);
  const [to, setTo] = useState(search.to || initial.to);
  const [page, setPage] = useState<CrmUsageAccountPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>("all");
  const [peopleSort, setPeopleSort] = useState<PeopleSort>("leads");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");

  const tab: TabId = search.tab ?? "overview";

  useEffect(() => {
    if (search.from && search.from !== from) {
      setFrom(search.from);
    }
    if (search.to && search.to !== to) {
      setTo(search.to);
    }
  }, [search.from, search.to]);

  const load = useCallback(
    async (range: { from: string; to: string }) => {
      setLoading(true);
      try {
        const next = await getCrmUsageAccountPage({ data: { accountId, ...range } });
        setPage(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load this account");
      } finally {
        setLoading(false);
      }
    },
    [accountId],
  );

  useEffect(() => {
    void load({ from, to });
  }, [from, to, load]);

  async function refreshAccount() {
    if (from > to) {
      toast.error("Start date must be on or before the end date");
      return;
    }
    const days = eachIsoDay(from, to);
    if (days.length > 31) {
      toast.error("Refresh 31 days or fewer. Widen the view only after those days are saved.");
      return;
    }
    setRefreshing(true);
    const slices: { from: string; to: string }[] = [];
    for (let index = 0; index < days.length; index += 5) {
      const slice = days.slice(index, index + 5);
      slices.push({ from: slice[0], to: slice[slice.length - 1] });
    }
    setProgress({ done: 0, total: slices.length });
    try {
      for (let index = 0; index < slices.length; index += 1) {
        await refreshCrmUsageAccount({
          data: { accountId, ...slices[index], force: true },
        });
        setProgress({ done: index + 1, total: slices.length });
      }
      await load({ from, to });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh this account");
      await load({ from, to });
    } finally {
      setRefreshing(false);
    }
  }

  const account = page?.account;
  const summary = page?.summary ?? null;
  const tag = summary ? usageTag(summary) : account?.connected ? "Not saved" : "Not connected";
  const chartData = (page?.days ?? []).map((day) => ({
    date: day.date.slice(5),
    Leads: day.ok ? day.leads : null,
    "Follow-ups": day.ok ? day.followups : null,
    Bookings: day.ok ? day.bookings : null,
    Calls: day.ok ? day.calls : null,
  }));
  const weekdayData = useMemo(() => {
    const buckets = WEEKDAYS.map((day) => ({ day, Leads: 0, Calls: 0, "Follow-ups": 0 }));
    for (const day of page?.days ?? []) {
      if (!day.ok) continue;
      const index = new Date(`${day.date}T00:00:00`).getDay();
      buckets[index].Leads += day.leads;
      buckets[index].Calls += day.calls;
      buckets[index]["Follow-ups"] += day.followups;
    }
    return buckets;
  }, [page?.days]);
  const people = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    const rows = (page?.people ?? []).filter((person) => {
      if (peopleFilter === "productive" && !person.productive) return false;
      if (peopleFilter === "leads" && !person.leadOnly) return false;
      if (peopleFilter === "idle" && (person.productive || person.leadOnly)) return false;
      if (!query) return true;
      return person.name.toLowerCase().includes(query) || person.team.toLowerCase().includes(query);
    });
    return rows.sort((a, b) => b[peopleSort] - a[peopleSort] || a.name.localeCompare(b.name));
  }, [page?.people, peopleFilter, peopleQuery, peopleSort]);
  const days = useMemo(() => {
    return (page?.days ?? []).filter((day) => {
      if (dayFilter === "used") return day.ok && day.hasCrmActivity;
      if (dayFilter === "quiet") return day.ok && !day.hasCrmActivity;
      if (dayFilter === "failed") return day.saved && !day.ok;
      if (dayFilter === "missing") return !day.saved;
      return true;
    });
  }, [page?.days, dayFilter]);
  const leadPeak = Math.max(1, ...(page?.people ?? []).map((person) => person.leads));

  function applyWindow(daysBack: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (daysBack - 1));
    const nextFrom = isoDate(start);
    const nextTo = isoDate(end);
    setFrom(nextFrom);
    setTo(nextTo);
    void navigate({
      search: (prev: typeof search) => ({
        ...prev,
        from: nextFrom,
        to: nextTo,
      }),
      replace: true,
    });
  }

  function setTab(next: TabId) {
    void navigate({
      search: (prev: typeof search) => ({
        ...prev,
        from,
        to,
        tab: next === "overview" ? undefined : next,
      }),
      replace: true,
    });
  }

  function exportAccount() {
    if (!page || !account) return;
    const dayRows: (string | number)[][] = [
      [
        "Date",
        "Status",
        "Users",
        "Leads",
        "Contacts",
        "Follow-ups",
        "Visits scheduled",
        "Visits completed",
        "Visits pending",
        "Bookings",
        "Calls",
        "Connected calls",
        "Score",
      ],
      ...page.days.map((day) => [
        day.date,
        dayStatus(day),
        day.ok ? day.activeUsers : "",
        day.ok ? day.leads : "",
        day.ok ? day.contacts : "",
        day.ok ? day.followups : "",
        day.ok ? day.visitsScheduled : "",
        day.ok ? day.visitsConducted : "",
        day.ok ? Math.max(0, day.visitsScheduled - day.visitsConducted) : "",
        day.ok && day.bookings != null ? day.bookings : "",
        day.ok ? day.calls : "",
        day.ok ? day.connectedCalls : "",
        day.ok ? day.score : "",
      ]),
    ];
    downloadCsv(
      `${account.name.replaceAll(/\s+/g, "-").toLowerCase()}-usage-${page.from}-to-${page.to}.csv`,
      dayRows,
    );
  }

  const ready = Boolean(page && summary?.ok);

  return (
    <PageWrap>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="mb-1 -ml-2" asChild>
              <Link to="/crm/usage" search={{ from, to }}>
                <ArrowLeft className="h-3.5 w-3.5" />
                All accounts
              </Link>
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">
              {account?.name ?? "Account usage"}
            </h1>
            {account ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {crmAccountStatusLabel(account.status)}
                  {account.city ? ` · ${account.city}` : ""}
                  {account.salesManagerName ? ` · ${account.salesManagerName}` : ""}
                  {` · ${account.licensedUsers || "—"} licensed`}
                </span>
                <Pill tone={usageTagTone(tag)}>{tag}</Pill>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {account ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/crm/accounts/$accountId" params={{ accountId: account.id }}>
                  Open account
                </Link>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={exportAccount}
              disabled={!page || !summary?.ok}
            >
              <Download className="h-3.5 w-3.5" />
              Export days
            </Button>
            <Button
              size="sm"
              onClick={() => void refreshAccount()}
              disabled={refreshing || loading || !account?.connected}
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {refreshing
                ? `Refreshing ${progress.done}/${progress.total}`
                : "Refresh this account"}
            </Button>
          </div>
        </div>

        <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
          {page
            ? `${page.savedDays} of ${page.expectedDays} days saved${page.failedDays ? `, ${page.failedDays} failed` : ""}. Refresh replaces the stored days for this account only.`
            : "Loading saved days…"}
          {summary?.ok ? ` ${usageFocus(summary, account?.licensedUsers ?? 0)}` : ""}
        </p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {[7, 15, 30].map((daysBack) => (
            <Button
              key={daysBack}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyWindow(daysBack)}
            >
              {daysBack} days
            </Button>
          ))}
        </div>
        <DesignTicketFilterBar className="mb-3">
          <DesignTicketDateField
            compact
            label="From"
            value={from}
            onChange={(nextFrom) => {
              setFrom(nextFrom);
              void navigate({
                search: (prev: typeof search) => ({ ...prev, from: nextFrom }),
                replace: true,
              });
            }}
          />
          <DesignTicketDateField
            compact
            label="To"
            value={to}
            onChange={(nextTo) => {
              setTo(nextTo);
              void navigate({
                search: (prev: typeof search) => ({ ...prev, to: nextTo }),
                replace: true,
              });
            }}
          />
        </DesignTicketFilterBar>

        <DesignTicketTabNav
          compact
          activeId={tab}
          onChange={(id) => setTab(id as TabId)}
          tabs={[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "reports", label: "Reports", icon: BarChart3 },
            {
              id: "people",
              label: "People",
              icon: Users,
              badge: page?.people.length || undefined,
            },
          ]}
        />

        {loading && !page ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading saved analysis…
          </div>
        ) : ready && page && summary ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {tab === "reports" ? <CrmUsageReportsPanel page={page} /> : null}

              {tab === "people" ? (
                <motion.section
                  className="overflow-x-auto rounded-lg border border-border"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                    <h2 className="text-sm font-medium">People</h2>
                    <input
                      value={peopleQuery}
                      onChange={(event) => setPeopleQuery(event.target.value)}
                      placeholder="Search people"
                      className="h-7 w-36 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    {(["all", "productive", "leads", "idle"] as const).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPeopleFilter(id)}
                        className={cn(
                          "rounded-md px-2 py-1 text-[11px]",
                          peopleFilter === id
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {id === "all"
                          ? "All"
                          : id === "productive"
                            ? "Active"
                            : id === "leads"
                              ? "Leads only"
                              : "Idle"}
                      </button>
                    ))}
                    <select
                      value={peopleSort}
                      onChange={(event) => setPeopleSort(event.target.value as PeopleSort)}
                      className="ml-auto h-7 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="leads">Sort by leads</option>
                      <option value="followups">Sort by follow-ups</option>
                      <option value="calls">Sort by calls</option>
                      <option value="bookings">Sort by bookings</option>
                      <option value="activeDays">Sort by active days</option>
                    </select>
                  </div>
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        {[
                          "Name",
                          "Share of leads",
                          "Active days",
                          "Leads",
                          "Contacts",
                          "Follow-ups",
                          "Visits S/C/P",
                          "Bookings",
                          "Calls",
                          "Connected",
                        ].map((label) => (
                          <th key={label} className="px-2 py-1.5 font-medium">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {people.length ? (
                        people.map((person) => (
                          <tr key={person.name} className="border-t border-border">
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{person.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {person.leadOnly
                                  ? "Leads only"
                                  : person.productive
                                    ? person.team || "Active"
                                    : "No activity"}
                              </div>
                            </td>
                            <td className="w-36 px-2 py-1.5">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{
                                    width: `${Math.round((person.leads / leadPeak) * 100)}%`,
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">{person.activeDays}</td>
                            <td className="px-2 py-1.5 tabular-nums">{person.leads}</td>
                            <td className="px-2 py-1.5 tabular-nums">{person.contacts}</td>
                            <td className="px-2 py-1.5 tabular-nums">{person.followups}</td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {person.visitsScheduled}/{person.visitsConducted}/
                              {Math.max(0, person.visitsScheduled - person.visitsConducted)}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">{person.bookings}</td>
                            <td className="px-2 py-1.5 tabular-nums">{person.calls}</td>
                            <td className="px-2 py-1.5 tabular-nums">{person.connectedCalls}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-3 py-6 text-center text-muted-foreground"
                          >
                            No people match this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </motion.section>
              ) : null}

              {tab === "overview" ? (
                <div className="space-y-4">
                  <motion.div
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.05, ease: EASE }}
                  >
                    <Metric
                      label="Peak active users"
                      value={`${summary.activeUsers}/${account?.licensedUsers || "—"}`}
                      hint={
                        account?.licensedUsers
                          ? `${percent(summary.activeUsers, account.licensedUsers)} of seats`
                          : "No licensed seats"
                      }
                    />
                    <Metric label="Leads" value={String(summary.leads)} hint={page.pattern} />
                    <Metric
                      label="Contacts"
                      value={String(summary.contacts ?? 0)}
                      hint="Customers / contacts"
                    />
                    <Metric
                      label="Follow-ups done"
                      value={String(summary.followups)}
                      hint={`${percent(summary.followups, summary.leads)} of leads`}
                    />
                    <Metric
                      label="Bookings"
                      value={summary.bookings == null ? "—" : String(summary.bookings)}
                      hint={
                        summary.bookings == null
                          ? "Not loaded"
                          : `${percent(summary.bookings, summary.leads)} of leads`
                      }
                    />
                    <Metric
                      label="Visits S/C/P"
                      value={`${summary.visitsScheduled}/${summary.visitsConducted}/${Math.max(0, summary.visitsScheduled - summary.visitsConducted)}`}
                      hint={`${percent(summary.visitsConducted, summary.visitsScheduled)} completed`}
                    />
                    <Metric
                      label="Calls"
                      value={String(summary.calls)}
                      hint={`${percent(summary.connectedCalls, summary.calls)} connected`}
                    />
                    <Metric
                      label="Active days"
                      value={`${page.days.filter((day) => day.ok && day.hasCrmActivity).length}/${page.savedDays}`}
                      hint="Days with CRM use"
                    />
                  </motion.div>

                  {summary.bookingWarning ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {summary.bookingWarning}
                    </p>
                  ) : null}
                  {summary.callWarning ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {summary.callWarning}
                    </p>
                  ) : null}

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                    <motion.section
                      className="rounded-lg border border-border bg-card p-3"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-medium">Daily activity</h2>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-primary"
                          onClick={() => setTab("reports")}
                        >
                          Open full reports
                        </Button>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="Leads"
                              stroke="#009bff"
                              strokeWidth={2}
                              dot={false}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="Follow-ups"
                              stroke="#0f766e"
                              strokeWidth={2}
                              dot={false}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="Bookings"
                              stroke="#b45309"
                              strokeWidth={2}
                              dot={false}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="Calls"
                              stroke="#6366f1"
                              strokeWidth={2}
                              dot={false}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.section>
                    <motion.section
                      className="rounded-lg border border-border bg-card p-3"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.12, ease: EASE }}
                    >
                      <h2 className="mb-2 text-sm font-medium">Weekday pattern</h2>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weekdayData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Leads" fill="#009bff" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Follow-ups" fill="#0f766e" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Calls" fill="#6366f1" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.section>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <motion.section
                      className="rounded-lg border border-border px-3 py-3"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-medium">People snapshot</h2>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-primary"
                          onClick={() => setTab("people")}
                        >
                          View all people
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {(page.people ?? [])
                          .slice()
                          .sort((a, b) => b.leads - a.leads)
                          .slice(0, 5)
                          .map((person) => (
                            <div
                              key={person.name}
                              className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-1.5 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">{person.name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {person.calls} calls · {person.activeDays} active days
                                </div>
                              </div>
                              <div className="tabular-nums text-muted-foreground">
                                {person.leads} leads
                              </div>
                            </div>
                          ))}
                        {!page.people.length ? (
                          <p className="text-xs text-muted-foreground">No people totals yet.</p>
                        ) : null}
                      </div>
                    </motion.section>

                    <motion.section
                      className="space-y-2"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2, ease: EASE }}
                    >
                      <h2 className="text-sm font-medium">Customer success</h2>
                      {page.recommendations.map((item) => (
                        <div key={item.finding} className="rounded-lg border border-border px-3 py-2">
                          <Pill
                            tone={
                              item.priority === "High"
                                ? "danger"
                                : item.priority === "Medium"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {item.priority}
                          </Pill>
                          <p className="mt-1 text-sm font-medium">{item.finding}</p>
                          <p className="text-xs text-muted-foreground">{item.action}</p>
                        </div>
                      ))}
                    </motion.section>
                  </div>

                  <motion.section
                    className="overflow-x-auto rounded-lg border border-border"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25, ease: EASE }}
                  >
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                      <h2 className="text-sm font-medium">Day by day</h2>
                      {(["all", "used", "quiet", "failed", "missing"] as const).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setDayFilter(id)}
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px]",
                            dayFilter === id
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {id === "all"
                            ? "All"
                            : id === "used"
                              ? "Used CRM"
                              : id === "quiet"
                                ? "Quiet"
                                : id === "failed"
                                  ? "Failed"
                                  : "Not saved"}
                        </button>
                      ))}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {days.length} days
                      </span>
                    </div>
                    <table className="w-full min-w-[780px] text-left text-xs">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          {[
                            "Date",
                            "Status",
                            "Users",
                            "Leads",
                            "Contacts",
                            "Follow-ups",
                            "Visits S/C/P",
                            "Bookings",
                            "Calls",
                            "Connected",
                            "Score",
                          ].map((label) => (
                            <th key={label} className="px-2 py-1.5 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((day) => (
                          <tr
                            key={day.date}
                            className={cn(
                              "border-t border-border",
                              !day.ok && "text-muted-foreground",
                            )}
                          >
                            <td className="px-2 py-1.5">{day.date}</td>
                            <td className="px-2 py-1.5">{dayStatus(day)}</td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok ? day.activeUsers : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok ? day.leads : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok ? day.contacts : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok ? day.followups : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok
                                ? `${day.visitsScheduled}/${day.visitsConducted}/${Math.max(0, day.visitsScheduled - day.visitsConducted)}`
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok && day.bookings != null ? day.bookings : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok ? day.calls : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok ? day.connectedCalls : "—"}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">
                              {day.ok ? day.score : "—"}
                            </td>
                          </tr>
                        ))}
                        {days.length === 0 ? (
                          <tr>
                            <td
                              colSpan={11}
                              className="px-3 py-6 text-center text-muted-foreground"
                            >
                              No days match this filter.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </motion.section>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        ) : (
          <p className="text-sm text-muted-foreground">
            {account && !account.connected
              ? "This account has no Buildesk key, so there is nothing to refresh."
              : summary && !summary.ok
                ? summary.error
                : "No saved days in this window yet. Refresh this account to fetch and store them."}
          </p>
        )}
      </motion.div>
    </PageWrap>
  );
}
