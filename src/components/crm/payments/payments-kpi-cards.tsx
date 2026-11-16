import { AlertTriangle, CheckCircle2, Clock3, FileText } from "lucide-react";

import { formatPaymentsInr, type PaymentsSummaryView } from "@/components/crm/payments/payments-format";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    id: "contract",
    label: "Total contract value",
    icon: FileText,
    iconWrap: "bg-primary/10 text-primary",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalContractValue),
    sub: (s: PaymentsSummaryView) =>
      `Across ${s.accountCount ?? 0} ${(s.accountCount ?? 0) === 1 ? "account" : "accounts"}`,
    tone: "text-foreground",
  },
  {
    id: "collected",
    label: "Total collected",
    icon: CheckCircle2,
    iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalReceived),
    sub: (s: PaymentsSummaryView) => `${s.collectionRatePercent}% collection rate`,
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  {
    id: "outstanding",
    label: "Outstanding",
    icon: Clock3,
    iconWrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalPending),
    sub: () => "Amount yet to collect",
    tone: "text-amber-700 dark:text-amber-400",
  },
  {
    id: "overdue",
    label: "Overdue amount",
    icon: AlertTriangle,
    iconWrap: "bg-destructive/10 text-destructive",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalOverdueAmount),
    sub: (s: PaymentsSummaryView) =>
      `${s.overdueAccountCount} ${s.overdueAccountCount === 1 ? "account requires" : "accounts require"} attention`,
    tone: "text-destructive",
  },
] as const;

export function PaymentsKpiCards({
  summary,
  loading,
}: {
  summary?: PaymentsSummaryView | null;
  loading?: boolean;
}) {
  if (loading && !summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[7.25rem] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </div>
                <div className={cn("mt-1.5 text-xl font-semibold tabular-nums tracking-tight", card.tone)}>
                  {card.value(summary)}
                </div>
                <div className={cn("mt-1 text-[11px] tabular-nums", card.tone === "text-foreground" ? "text-muted-foreground" : card.tone)}>
                  {card.sub(summary)}
                </div>
              </div>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", card.iconWrap)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
