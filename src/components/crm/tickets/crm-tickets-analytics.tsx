import { eachDayOfInterval, format, startOfDay, subDays } from "date-fns";
import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  TICKET_AGING_DAYS,
  daysOpenForTicket,
  isTicketAging,
  parseTicketDate,
} from "@/components/crm/tickets/crm-tickets-format";
import { TICKET_EASE } from "@/components/design-ticket/design-ticket-shared";
import { isDesignTicketActive } from "@/stores/design-ticket-selectors";
import type { DesignTicket } from "@/types/design-ticket";
import { cn } from "@/lib/utils";

const EXEC_CHART_COLORS = [
  "#009bff",
  "#8b5cf6",
  "#f59e0b",
  "#14b8a6",
  "#ef4444",
  "#22c55e",
  "#ec4899",
  "#64748b",
  "#0ea5e9",
  "#a855f7",
];

type TicketAnalyticsRow = Pick<
  DesignTicket,
  "status" | "createdAt" | "resolvedAt" | "updatedAt"
> & {
  /** Account Support 1 label (executive). */
  supportManager1?: string;
};

export function CrmTicketsAnalytics({
  tickets,
  onSelectExecutive,
}: {
  tickets: TicketAnalyticsRow[];
  /** Optional: click a Support 1 slice/legend to filter the table. */
  onSelectExecutive?: (name: string) => void;
}) {
  const pendingByExecutive = useMemo(() => {
    const pending = tickets.filter((t) => isDesignTicketActive(t.status));
    const counts = new Map<string, number>();
    for (const ticket of pending) {
      const name = ticket.supportManager1?.trim() || "Unassigned";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const total = pending.length || 1;
    return [...counts.entries()]
      .map(([name, value], index) => ({
        name,
        value,
        pct: Math.round((value / total) * 100),
        fill: EXEC_CHART_COLORS[index % EXEC_CHART_COLORS.length]!,
      }))
      .sort((a, b) => b.value - a.value);
  }, [tickets]);

  const pendingTotal = useMemo(
    () => tickets.filter((t) => isDesignTicketActive(t.status)).length,
    [tickets],
  );

  const trendData = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, 29);
    const days = eachDayOfInterval({ start, end });
    const created = new Map<string, number>();
    const resolved = new Map<string, number>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      created.set(key, 0);
      resolved.set(key, 0);
    }
    for (const ticket of tickets) {
      const createdAt = parseTicketDate(ticket.createdAt);
      if (createdAt) {
        const key = format(startOfDay(createdAt), "yyyy-MM-dd");
        if (created.has(key)) created.set(key, (created.get(key) ?? 0) + 1);
      }
      if (ticket.status === "resolved" || ticket.status === "closed") {
        const resolvedAt = parseTicketDate(ticket.resolvedAt ?? ticket.updatedAt);
        if (resolvedAt) {
          const key = format(startOfDay(resolvedAt), "yyyy-MM-dd");
          if (resolved.has(key)) resolved.set(key, (resolved.get(key) ?? 0) + 1);
        }
      }
    }
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      return {
        key,
        label: format(day, "d MMM"),
        created: created.get(key) ?? 0,
        resolved: resolved.get(key) ?? 0,
      };
    });
  }, [tickets]);

  const agingStats = useMemo(() => {
    const active = tickets.filter((t) => isDesignTicketActive(t.status));
    const aging = active.filter((t) => isTicketAging(t)).length;
    const onTrack = Math.max(0, active.length - aging);
    const total = active.length;
    const onTrackPct = total === 0 ? 100 : Math.round((onTrack / total) * 100);
    const agingPct = total === 0 ? 0 : 100 - onTrackPct;
    return { active: total, aging, onTrack, onTrackPct, agingPct };
  }, [tickets]);

  const gaugeData = [
    { name: "On track", value: Math.max(agingStats.onTrack, 0.0001), fill: "#22c55e" },
    { name: "Aging", value: Math.max(agingStats.aging, agingStats.active === 0 ? 0 : 0.0001), fill: "#ef4444" },
  ];

  const avgDaysOpen = useMemo(() => {
    if (tickets.length === 0) return 0;
    const sum = tickets.reduce((acc, t) => acc + daysOpenForTicket(t), 0);
    return Math.round((sum / tickets.length) * 10) / 10;
  }, [tickets]);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: TICKET_EASE }}
        className="rounded-xl border border-border/80 bg-gradient-to-b from-violet-500/[0.06] via-card to-card p-3 shadow-sm"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pending by Support 1
          </h3>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {pendingTotal} open / in progress
          </span>
        </div>
        {pendingByExecutive.length === 0 ? (
          <EmptyChart label="No pending tickets" />
        ) : (
          <>
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pendingByExecutive}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                    cursor={onSelectExecutive ? "pointer" : undefined}
                    onClick={(_, index) => {
                      const entry = pendingByExecutive[index];
                      if (entry && onSelectExecutive) {
                        onSelectExecutive(
                          entry.name === "Unassigned" ? "unassigned" : entry.name,
                        );
                      }
                    }}
                  >
                    {pendingByExecutive.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} pending`, name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-lg font-semibold tabular-nums text-foreground">
                  {pendingByExecutive[0]?.pct ?? 0}%
                </div>
                <div className="max-w-[6.5rem] truncate text-center text-[10px] text-muted-foreground">
                  {pendingByExecutive[0]?.name ?? "—"}
                </div>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {pendingByExecutive.slice(0, 6).map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] text-muted-foreground",
                    onSelectExecutive && "hover:text-foreground",
                  )}
                  onClick={() =>
                    onSelectExecutive?.(
                      entry.name === "Unassigned" ? "unassigned" : entry.name,
                    )
                  }
                  disabled={!onSelectExecutive}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: entry.fill }} />
                  {entry.name} {entry.value}
                </button>
              ))}
            </div>
          </>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06, ease: TICKET_EASE }}
        className="rounded-xl border border-border/80 bg-gradient-to-b from-sky-500/[0.06] via-card to-card p-3 shadow-sm"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ticket Status Trend
          </h3>
          <span className="text-[10px] text-muted-foreground">Last 30 days</span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="ticketCreatedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#009bff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#009bff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ticketResolvedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area
                type="monotone"
                dataKey="created"
                name="Created"
                stroke="#009bff"
                strokeWidth={2.2}
                fill="url(#ticketCreatedFill)"
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Area
                type="monotone"
                dataKey="resolved"
                name="Resolved"
                stroke="#22c55e"
                strokeWidth={2.2}
                fill="url(#ticketResolvedFill)"
                dot={false}
                activeDot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#009bff]" /> Created
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Resolved
          </span>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: TICKET_EASE }}
        className="rounded-xl border border-border/80 bg-gradient-to-b from-emerald-500/[0.06] via-card to-card p-3 shadow-sm"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Aging Health
          </h3>
          <span className="text-[10px] text-muted-foreground">
            Target &lt; {TICKET_AGING_DAYS}d open
          </span>
        </div>
        <div className="relative mx-auto h-40 w-full max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                dataKey="value"
                nameKey="name"
                startAngle={210}
                endAngle={-30}
                innerRadius={58}
                outerRadius={74}
                paddingAngle={agingStats.aging > 0 && agingStats.onTrack > 0 ? 2 : 0}
                strokeWidth={0}
              >
                {gaugeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2">
            <div
              className={cn(
                "text-2xl font-semibold tabular-nums",
                agingStats.onTrackPct >= 85
                  ? "text-emerald-600 dark:text-emerald-400"
                  : agingStats.onTrackPct >= 70
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400",
              )}
            >
              {agingStats.onTrackPct}%
            </div>
            <div className="text-[10px] font-medium text-muted-foreground">On track</div>
          </div>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-center text-[10px]">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
            <div className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {agingStats.onTrackPct}%
            </div>
            <div className="text-muted-foreground">Within target</div>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-1.5">
            <div className="font-semibold tabular-nums text-rose-700 dark:text-rose-400">
              {agingStats.agingPct}%
            </div>
            <div className="text-muted-foreground">Aging</div>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Avg age {avgDaysOpen}d · {agingStats.aging} of {agingStats.active} active aging
        </p>
      </motion.section>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">{label}</div>
  );
}
