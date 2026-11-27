import { Ban, HeartCrack, TrendingDown, UserX } from "lucide-react";

import { formatPaymentsInr, type PaymentsSummaryView } from "@/components/crm/payments/payments-format";
import { Button } from "@/components/ui/button";
import type { CrmPaymentStatusTabId } from "@/lib/crm-payments-search";

export function PaymentsLostSummary({
  summary,
  loading,
  onFilter,
}: {
  summary?: PaymentsSummaryView | null;
  loading?: boolean;
  onFilter: (statusTab: CrmPaymentStatusTabId) => void;
}) {
  if (loading && !summary) {
    return <div className="h-12 animate-pulse rounded-lg border bg-card" />;
  }
  if (!summary) return null;

  const cards = [
    {
      id: "suspended" as const,
      title: "Suspended",
      icon: Ban,
      iconWrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      count: summary.suspendedCount ?? 0,
      deal: summary.suspendedDealValue ?? 0,
      paid: null as number | null,
      lost: summary.suspendedDealValue ?? 0,
      filter: "suspended" as CrmPaymentStatusTabId,
    },
    {
      id: "sales_lost" as const,
      title: "Sales lost",
      icon: UserX,
      iconWrap: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      count: summary.salesLostCount ?? 0,
      deal: summary.salesLostDealValue ?? 0,
      paid: summary.salesLostPaidAmount ?? 0,
      lost: summary.salesLostAmount ?? 0,
      filter: "suspend_and_close" as CrmPaymentStatusTabId,
    },
    {
      id: "customer_lost" as const,
      title: "Customer lost",
      icon: HeartCrack,
      iconWrap: "bg-destructive/10 text-destructive",
      count: summary.customerLostCount ?? 0,
      deal: summary.customerLostDealValue ?? 0,
      paid: summary.customerLostPaidAmount ?? 0,
      lost: summary.customerLostAmount ?? 0,
      filter: "suspend_and_close" as CrmPaymentStatusTabId,
    },
  ];

  const total = {
    count: cards.reduce((sum, card) => sum + card.count, 0),
    deal: cards.reduce((sum, card) => sum + card.deal, 0),
    paid: cards.reduce((sum, card) => sum + (card.paid ?? 0), 0),
    lost: cards.reduce((sum, card) => sum + card.lost, 0),
  };

  return (
    <div className="grid items-stretch gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="flex h-full items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-1.5 shadow-sm"
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${card.iconWrap}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <div className="truncate text-[11px] font-semibold text-foreground">
                  {card.title}
                  <span className="ml-1 font-normal tabular-nums text-muted-foreground">
                    · {card.count}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 shrink-0 px-1.5 text-[10px] text-primary"
                  onClick={() => onFilter(card.filter)}
                >
                  View
                </Button>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
                <span className="text-muted-foreground">
                  Deal <span className="font-medium text-foreground">{formatPaymentsInr(card.deal)}</span>
                </span>
                {card.paid != null ? (
                  <span className="text-muted-foreground">
                    Paid{" "}
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {formatPaymentsInr(card.paid)}
                    </span>
                  </span>
                ) : null}
                <span className="text-muted-foreground">
                  Lost{" "}
                  <span className="font-semibold text-destructive">{formatPaymentsInr(card.lost)}</span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex h-full items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.04] px-2.5 py-1.5 shadow-sm">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TrendingDown className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <div className="truncate text-[11px] font-semibold text-foreground">
              Total loss
              <span className="ml-1 font-normal tabular-nums text-muted-foreground">· {total.count}</span>
            </div>
            <span className="h-6 w-9 shrink-0" aria-hidden />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
            <span className="text-muted-foreground">
              Deal <span className="font-medium text-foreground">{formatPaymentsInr(total.deal)}</span>
            </span>
            <span className="text-muted-foreground">
              Paid{" "}
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                {formatPaymentsInr(total.paid)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Lost <span className="font-semibold text-destructive">{formatPaymentsInr(total.lost)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
