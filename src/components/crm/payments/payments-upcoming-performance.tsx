import { Info } from "lucide-react";

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
    return <div className="h-16 animate-pulse rounded-lg border bg-card" />;
  }
  if (!summary) return null;

  const allZero =
    summary.dueThisWeekAmount === 0 &&
    summary.dueThisMonthAmount === 0 &&
    summary.dueIn45DaysAmount === 0;
  const rate = summary.collectionRatePercent;

  return (
    <div className="rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="grid divide-y divide-border/60 lg:grid-cols-[1fr_minmax(14rem,18rem)] lg:divide-x lg:divide-y-0">
        <div className="min-w-0 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming collections
            </div>
            {allZero ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-sky-700 dark:text-sky-300">
                <Info className="h-3 w-3" />
                No dues in 45 days
              </span>
            ) : null}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {UPCOMING.map((row) => {
              const amount = row.amount(summary);
              const count = row.count(summary);
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/15 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-foreground">{row.label}</div>
                    <div className="text-[10px] tabular-nums text-muted-foreground">
                      {count} acct · {formatPaymentsInr(amount)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-1.5 text-[10px] text-primary"
                    onClick={() => onFilter(row.id)}
                  >
                    View
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-1.5 px-3 py-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Collection rate
              </div>
              <div className="text-xl font-semibold tabular-nums leading-none text-emerald-700 dark:text-emerald-400">
                {rate}%
              </div>
            </div>
            <div className="text-right text-[10px] tabular-nums text-muted-foreground">
              <div className="text-foreground">{formatPaymentsInr(summary.totalReceived)}</div>
              <div>/ {formatPaymentsInr(summary.totalContractValue)}</div>
            </div>
          </div>
          <Progress value={Math.min(100, Math.max(0, rate))} className="h-1.5" />
        </div>
      </div>
    </div>
  );
}
