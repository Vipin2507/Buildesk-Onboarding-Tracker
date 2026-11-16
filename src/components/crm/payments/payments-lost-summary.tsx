import { Ban, HeartCrack, UserX } from "lucide-react";

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
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    );
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
      paid: 0,
      lost: summary.suspendedDealValue ?? 0,
      showPaid: false,
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
      showPaid: true,
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
      showPaid: true,
      filter: "suspend_and_close" as CrmPaymentStatusTabId,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.id} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${card.iconWrap}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{card.title}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {card.count} {card.count === 1 ? "account" : "accounts"}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] text-primary"
                onClick={() => onFilter(card.filter)}
              >
                View details
              </Button>
            </div>
            <div className="mt-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Deal value</span>
                <span className="font-medium tabular-nums text-foreground">{formatPaymentsInr(card.deal)}</span>
              </div>
              {card.showPaid ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatPaymentsInr(card.paid)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2 border-t border-border/60 pt-1.5">
                <span className="text-muted-foreground">Lost</span>
                <span className="font-semibold tabular-nums text-destructive">{formatPaymentsInr(card.lost)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
