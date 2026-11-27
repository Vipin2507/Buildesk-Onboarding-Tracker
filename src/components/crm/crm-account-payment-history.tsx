import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { useCrmPaymentTransactions } from "@/hooks/use-crm-payments";
import { getCrmAccountRenewalSummary } from "@/lib/api";
import {
  financialYearStartFromYmd,
  renewalYearDeals,
  type RenewalYearSummary,
} from "@/lib/crm-renewal-years";
import { formatDate } from "@/lib/utils";

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export type RenewalYearDeal = {
  fyStartYear: number;
  label: string;
  dealValue: number;
};

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

export function groupPaymentsByRenewalYear<T extends { id: string; paidDate: string; amount: number }>(
  transactions: T[],
  deals: RenewalYearDeal[],
) {
  const used = new Set<string>();
  const groups = [...deals]
    .filter((year) => year.dealValue > 0.01)
    .sort((a, b) => b.fyStartYear - a.fyStartYear)
    .map((year) => {
      const rows = transactions.filter(
        (txn) => financialYearStartFromYmd(txn.paidDate) === year.fyStartYear,
      );
      for (const row of rows) used.add(row.id);
      const received =
        Math.round(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) * 100) / 100;
      return { year, rows, received };
    });
  const other = transactions.filter((txn) => !used.has(txn.id));
  return { groups, other };
}

export function RenewalPaymentHistory<T extends { id: string; paidDate: string; amount: number }>({
  transactions,
  deals,
  renderTransaction,
}: {
  transactions: T[];
  deals: RenewalYearDeal[];
  renderTransaction: (txn: T) => ReactNode;
}) {
  const { groups, other } = groupPaymentsByRenewalYear(transactions, deals);
  return (
    <>
      {groups.map((group) => (
        <li key={`renewal-${group.year.fyStartYear}`} className="px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-xs font-medium tabular-nums">{inr(group.year.dealValue)}</div>
            <Badge
              variant="outline"
              className="rounded-md border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-700 dark:text-violet-400"
            >
              Renewal
            </Badge>
            <span className="text-[10px] text-muted-foreground">{group.year.label}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {group.rows.length === 0
              ? "No payment recorded"
              : `Received ${inr(group.received)}`}
          </div>
          {group.rows.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5 border-l border-violet-500/30 pl-2">
              {group.rows.map((txn) => (
                <li key={txn.id}>{renderTransaction(txn)}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
      {other.map((txn) => (
        <li key={txn.id} className="px-2.5 py-2">
          {renderTransaction(txn)}
        </li>
      ))}
    </>
  );
}

export function CrmAccountPaymentHistory({ accountId }: { accountId: string }) {
  const transactionsQuery = useCrmPaymentTransactions(accountId, true);
  const { deals } = useAccountRenewalDeals(accountId);
  const transactions = transactionsQuery.data ?? [];
  const loading = transactionsQuery.isLoading && transactions.length === 0;

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
          <RenewalPaymentHistory
            transactions={transactions}
            deals={deals}
            renderTransaction={(txn) => (
              <div>
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
              </div>
            )}
          />
        </ul>
      )}
    </div>
  );
}
