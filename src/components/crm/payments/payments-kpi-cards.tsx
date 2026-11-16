import { AlertTriangle, CheckCircle2, Clock3, FileText } from "lucide-react";

import { formatPaymentsInr, type PaymentsSummaryView } from "@/components/crm/payments/payments-format";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    id: "contract",
    label: "Contract value",
    icon: FileText,
    iconWrap: "bg-primary/10 text-primary",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalContractValue),
    sub: (s: PaymentsSummaryView) => `${s.accountCount ?? 0} accounts`,
    tone: "text-foreground",
  },
  {
    id: "collected",
    label: "Collected",
    icon: CheckCircle2,
    iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalReceived),
    sub: (s: PaymentsSummaryView) => `${s.collectionRatePercent}% rate`,
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  {
    id: "outstanding",
    label: "Outstanding",
    icon: Clock3,
    iconWrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalPending),
    sub: () => "Yet to collect",
    tone: "text-amber-700 dark:text-amber-400",
  },
  {
    id: "overdue",
    label: "Overdue",
    icon: AlertTriangle,
    iconWrap: "bg-destructive/10 text-destructive",
    value: (s: PaymentsSummaryView) => formatPaymentsInr(s.totalOverdueAmount),
    sub: (s: PaymentsSummaryView) => `${s.overdueAccountCount} accounts`,
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
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm"
          >
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", card.iconWrap)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </div>
              <div className={cn("truncate text-sm font-semibold tabular-nums leading-tight", card.tone)}>
                {card.value(summary)}
              </div>
              <div
                className={cn(
                  "truncate text-[10px] tabular-nums",
                  card.tone === "text-foreground" ? "text-muted-foreground" : card.tone,
                )}
              >
                {card.sub(summary)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
