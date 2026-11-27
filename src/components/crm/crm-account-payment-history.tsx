import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { useCrmPaymentTransactions } from "@/hooks/use-crm-payments";
import { getCrmAccountRenewalSummary } from "@/lib/api";
import { renewalYearDeals, type RenewalYearSummary } from "@/lib/crm-renewal-years";
import { formatDate } from "@/lib/utils";

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function useAccountRenewalDeals(accountId: string) {
  const query = useQuery({
    queryKey: ["crm-account-renewal-years", accountId],
    queryFn: () => getCrmAccountRenewalSummary({ data: { accountId } }),
  });
  const summary: RenewalYearSummary | undefined = query.data;
  return {
    deals: summary ? renewalYearDeals(summary) : [],
    ready: summary != null,
  };
}

export function RenewalDealHistoryItems({
  deals,
}: {
  deals: { fyStartYear: number; label: string; dealValue: number }[];
}) {
  return (
    <>
      {deals.map((year) => (
        <li key={`renewal-${year.fyStartYear}`} className="px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-xs font-medium tabular-nums">{inr(year.dealValue)}</div>
            <Badge
              variant="outline"
              className="rounded-md border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-700 dark:text-violet-400"
            >
              Renewal
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground">{year.label}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Renewal deal</div>
        </li>
      ))}
    </>
  );
}

export function CrmAccountPaymentHistory({ accountId }: { accountId: string }) {
  const transactionsQuery = useCrmPaymentTransactions(accountId, true);
  const { deals } = useAccountRenewalDeals(accountId);
  const transactions = transactionsQuery.data ?? [];
  const loading = transactionsQuery.isLoading;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Payment history
      </h4>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading payments…</p>
      ) : transactions.length === 0 && deals.length === 0 ? (
        <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          <RenewalDealHistoryItems deals={deals} />
          {transactions.map((txn) => (
            <li key={txn.id} className="px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="text-xs font-medium tabular-nums">{inr(txn.amount)}</div>
                {txn.isRenewal ? (
                  <Badge
                    variant="outline"
                    className="rounded-md border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-700 dark:text-violet-400"
                  >
                    {txn.dealAmount && txn.dealAmount > 0.01
                      ? `Renewal ${inr(txn.renewalAmount ?? 0)}`
                      : "Renewal"}
                  </Badge>
                ) : null}
              </div>
              <div className="text-[10px] text-muted-foreground">{formatDate(txn.paidDate)}</div>
              {txn.note ? (
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{txn.note}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
