import { CalendarClock, Info, TrendingUp } from "lucide-react";

import { formatPaymentsInr, type PaymentsSummaryView } from "@/components/crm/payments/payments-format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { CrmPaymentStatusTabId } from "@/lib/crm-payments-search";

const UPCOMING = [
  {
    id: "due_this_week" as const,
    label: "This week",
    amount: (s: PaymentsSummaryView) => s.dueThisWeekAmount,
    count: (s: PaymentsSummaryView) => s.dueThisWeekCount,
  },
  {
    id: "due_this_month" as const,
    label: "This month",
    amount: (s: PaymentsSummaryView) => s.dueThisMonthAmount,
    count: (s: PaymentsSummaryView) => s.dueThisMonthCount,
  },
  {
    id: "due_in_45_days" as const,
    label: "Next 45 days",
    amount: (s: PaymentsSummaryView) => s.dueIn45DaysAmount,
    count: (s: PaymentsSummaryView) => s.dueIn45DaysCount,
  },
] as const;

export function PaymentsUpcomingPerformance({
  summary,
  loading,
  onFilter,
}: {
  summary?: PaymentsSummaryView | null;
  loading?: boolean;
  onFilter: (statusTab: CrmPaymentStatusTabId) => void;
}) {
  if (loading && !summary) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border bg-card" />
        <div className="h-48 animate-pulse rounded-xl border bg-card" />
      </div>
    );
  }
  if (!summary) return null;

  const allZero =
    summary.dueThisWeekAmount === 0 &&
    summary.dueThisMonthAmount === 0 &&
    summary.dueIn45DaysAmount === 0;
  const rate = summary.collectionRatePercent;
  const target = summary.totalContractValue;
  const collected = summary.totalReceived;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Upcoming collections</div>
            <div className="text-[11px] text-muted-foreground">Filter the table by due window</div>
          </div>
        </div>
        {allZero ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 text-[12px] text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>No dues scheduled in the next 45 days for the current filter.</span>
          </div>
        ) : null}
        <div className="space-y-2.5">
          {UPCOMING.map((row) => {
            const amount = row.amount(summary);
            const count = row.count(summary);
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-foreground">{row.label}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {count} {count === 1 ? "account" : "accounts"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatPaymentsInr(amount)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-primary"
                    onClick={() => onFilter(row.id)}
                  >
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Collection performance</div>
            <div className="text-[11px] text-muted-foreground">Received vs contract value</div>
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-3xl font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
              {rate}%
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Collection rate</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div className="tabular-nums text-foreground">
              {formatPaymentsInr(collected)}
              <span className="text-muted-foreground"> / {formatPaymentsInr(target)}</span>
            </div>
            <div className="mt-0.5">Collected / target</div>
          </div>
        </div>
        <Progress value={Math.min(100, Math.max(0, rate))} className="mt-4 h-2.5" />
      </div>
    </div>
  );
}
