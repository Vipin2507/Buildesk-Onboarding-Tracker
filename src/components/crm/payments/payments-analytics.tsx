import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

const DONUT_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.35)"];
const BAR_COLOR = "hsl(var(--primary))";

const STATUS_BAR_KEYS = [
  { key: "overdue", label: "Overdue" },
  { key: "due_this_week", label: "This week" },
  { key: "due_this_month", label: "This month" },
  { key: "due_in_45_days", label: "45 days" },
  { key: "due_in_90_days", label: "90 days" },
  { key: "fully_paid", label: "Fully paid" },
] as const;

export function PaymentsAnalytics({
  summary,
  loading,
}: {
  summary?: PaymentsSummaryView | null;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (loading && !summary) {
    return <div className="h-12 animate-pulse rounded-xl border bg-card" />;
  }
  if (!summary) return null;

  const received = summary.totalReceived;
  const pending = summary.totalPending;
  const donutData = [
    { name: "Collected", value: Math.max(0, received) },
    { name: "Pending", value: Math.max(0, pending) },
  ];
  const hasDonut = received + pending > 0;
  const statusCounts = summary.statusCounts ?? {};
  const barData = STATUS_BAR_KEYS.map((row) => ({
    name: row.label,
    count: statusCounts[row.key] ?? 0,
  }));
  const trend = summary.collectionTrend ?? [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PieChartIcon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">Payment analytics</div>
                <div className="text-[11px] text-muted-foreground">
                  Collection mix, account filters, and monthly receipts
                </div>
              </div>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 border-t border-border/60 p-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Received vs pending
              </div>
              {hasDonut ? (
                <div className="relative h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donutData.map((_, index) => (
                          <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatPaymentsInr(value)}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-lg font-semibold tabular-nums text-foreground">
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
                  <span className="h-2 w-2 rounded-full bg-primary" /> Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Pending
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Accounts by filter
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} name="Accounts" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Filter counts — windows can overlap; not mutually exclusive.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Collection trend
              </div>
              {trend.length > 0 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) =>
                          v >= 100000 ? `${Math.round(v / 100000)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => formatPaymentsInr(value)}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="collected"
                        name="Collected"
                        stroke={BAR_COLOR}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
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
    <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-border/70 bg-background/50 px-4 text-center text-[12px] text-muted-foreground">
      {label}
    </div>
  );
}
