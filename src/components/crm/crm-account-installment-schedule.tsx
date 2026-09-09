import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { allocateAccountPayments } from "@/lib/crm-payment-allocation";
import { calcDealExGst, calcGstAmount } from "@/lib/crm-account-commercial";
import { cn, formatDate } from "@/lib/utils";
import type { CrmAccount } from "@/types/crm-account";

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function statusClass(status: string) {
  if (status === "paid") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }
  if (status === "partially_paid") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  if (status === "overdue") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted/50 text-muted-foreground";
}

function statusLabel(status: string) {
  if (status === "partially_paid") return "Partial";
  if (status === "paid") return "Paid";
  if (status === "overdue") return "Overdue";
  return "Pending";
}

export function CrmAccountInstallmentSchedule({ account }: { account: CrmAccount }) {
  const installments = account.installments ?? [];
  const dealSize = account.dealSize ?? 0;
  const gstPercent = account.gstPercent ?? 0;
  const received = account.paymentReceived ?? 0;

  const allocation = useMemo(
    () =>
      allocateAccountPayments({
        installments,
        totalReceived: received,
        totalDealValue: dealSize,
      }),
    [installments, received, dealSize],
  );

  if (installments.length === 0 && dealSize <= 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        No commercial or installment data — edit the account to add deal value and installments.
      </p>
    );
  }

  const dealExGst = calcDealExGst(dealSize, gstPercent);
  const gstAmount = calcGstAmount(dealSize, gstPercent);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Deal incl. GST</div>
          <div className="font-medium tabular-nums">{dealSize > 0 ? formatInr(dealSize) : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Received / Pending</div>
          <div className="font-medium tabular-nums">
            {formatInr(received)} / {formatInr(account.pendingAmount ?? 0)}
          </div>
        </div>
        {gstPercent > 0 ? (
          <>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Ex-GST / GST</div>
              <div className="font-medium tabular-nums">
                {formatInr(dealExGst)} / {formatInr(gstAmount)} ({gstPercent}%)
              </div>
            </div>
          </>
        ) : null}
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Collected</div>
          <div className="font-medium tabular-nums">{allocation.collectionPercent}%</div>
        </div>
      </div>

      {installments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No installment schedule configured.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[320px] text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Amount</th>
                <th className="px-2 py-1.5 text-left font-medium">Due date</th>
                <th className="px-2 py-1.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {allocation.installments.map((row) => (
                <tr key={row.index} className="border-t border-border/60">
                  <td className="px-2 py-1.5 tabular-nums">{row.index}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {formatInr(row.amount)}
                    {row.remainingAmount > 0 && row.remainingAmount < row.amount ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({formatInr(row.remainingAmount)} due)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5">{formatDate(row.dueDate)}</td>
                  <td className="px-2 py-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md px-1.5 py-0 text-[10px] font-medium",
                        statusClass(row.status),
                      )}
                    >
                      {statusLabel(row.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
