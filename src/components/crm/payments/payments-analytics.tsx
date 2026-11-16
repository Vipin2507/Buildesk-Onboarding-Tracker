import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, PieChart as PieChartIcon } from "lucide-react";

import { formatPaymentsInr, type PaymentsSummaryView } from "@/components/crm/payments/payments-format";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const DONUT_COLORS = {
  collected: "#10b981",
  pending: "#f59e0b",
};

const STATUS_BAR_KEYS = [
  { key: "overdue", label: "Overdue", color: "#ef4444" },
  { key: "due_this_week", label: "This week", color: "#f59e0b" },
  { key: "due_this_month", label: "This month", color: "#f97316" },
  { key: "due_in_45_days", label: "45 days", color: "#3b82f6" },
  { key: "due_in_90_days", label: "90 days", color: "#06b6d4" },
  { key: "fully_paid", label: "Fully paid", color: "#22c55e" },
] as const;

const TREND_STROKE = "#009bff";
const TREND_FILL = "url(#paymentsTrendFill)";

export function PaymentsAnalytics({
  summary,
  loading,
}: {
  summary?: PaymentsSummaryView | null;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (loading && !summary) {
    return <div className="h-9 animate-pulse rounded-lg border bg-card" />;
  }
  if (!summary) return null;

  const received = summary.totalReceived;
  const pending = summary.totalPending;
  const donutData = [
    { name: "Collected", value: Math.max(0, received), fill: DONUT_COLORS.collected },
    { name: "Pending", value: Math.max(0, pending), fill: DONUT_COLORS.pending },
  ];
  const hasDonut = received + pending > 0;
  const statusCounts = summary.statusCounts ?? {};
  const barData = STATUS_BAR_KEYS.map((row) => ({
    name: row.label,
    count: statusCounts[row.key] ?? 0,
    fill: row.color,
  }));
  const trend = summary.collectionTrend ?? [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border/80 bg-card shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PieChartIcon className="h-3.5 w-3.5" />
              </span>
              <div className="text-[12px] font-semibold text-foreground">Payment analytics</div>
              <div className="hidden text-[10px] text-muted-foreground sm:block">
                Collection mix, filters & monthly receipts
              </div>
            </div>
            <ChevronDown
              className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 border-t border-border/60 p-3 lg:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-gradient-to-b from-emerald-500/5 to-transparent p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Received vs pending
              </div>
              {hasDonut ? (
                <div className="relative h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={64}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {donutData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatPaymentsInr(value)}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {summary.collectionRatePercent}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">Collected</div>
                  </div>
                </div>
              ) : (
                <EmptyChart label="No collection amounts in scope" />
              )}
              <div className="mt-1 flex justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: DONUT_COLORS.collected }} />{" "}
                  Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: DONUT_COLORS.pending }} /> Pending
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-gradient-to-b from-sky-500/5 to-transparent p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Accounts by filter
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Accounts">
                      {barData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Filter counts — windows can overlap; not mutually exclusive.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-gradient-to-b from-primary/5 to-transparent p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Collection trend
              </div>
              {trend.length > 0 ? (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="paymentsTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={TREND_STROKE} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={TREND_STROKE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) =>
                          v >= 100000
                            ? `${Math.round(v / 100000)}L`
                            : v >= 1000
                              ? `${Math.round(v / 1000)}k`
                              : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => formatPaymentsInr(value)}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="collected"
                        name="Collected"
                        stroke={TREND_STROKE}
                        strokeWidth={2.5}
                        fill={TREND_FILL}
                        dot={{ r: 3, fill: TREND_STROKE, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: TREND_STROKE }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart label="No payment receipts in the last 6 months" />
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border/70 bg-background/50 px-4 text-center text-[12px] text-muted-foreground">
      {label}
    </div>
  );
}
