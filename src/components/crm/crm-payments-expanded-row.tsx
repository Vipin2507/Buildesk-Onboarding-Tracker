import { Bell, Mail, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CrmRecordPaymentDialog } from "@/components/crm/crm-record-payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCrmPaymentInstallments,
  useCrmPaymentTransactions,
  useRecordCrmPayment,
  useRemindCrmPayment,
  useRemindCrmPaymentExecutive,
} from "@/hooks/use-crm-payments";
import type { CrmPaymentsSearch } from "@/lib/crm-payments-search";
import { cn, formatDate } from "@/lib/utils";

type PaymentRow = {
  id: string;
  accountName: string;
};

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function installmentStatusClass(status: string) {
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

function installmentStatusLabel(status: string) {
  if (status === "partially_paid") return "Partial";
  if (status === "paid") return "Paid";
  if (status === "overdue") return "Overdue";
  return "Pending";
}

type Props = {
  row: PaymentRow;
  search: CrmPaymentsSearch;
};

export function CrmPaymentsExpandedRow({ row, search }: Props) {
  const [recordOpen, setRecordOpen] = useState(false);
  const installmentsQuery = useCrmPaymentInstallments(row.id, true);
  const transactionsQuery = useCrmPaymentTransactions(row.id, true);
  const recordPayment = useRecordCrmPayment(search);
  const remindClient = useRemindCrmPayment();
  const remindExecutive = useRemindCrmPaymentExecutive();

  async function handleRemindClient() {
    try {
      await remindClient.mutateAsync(row.id);
      toast.success("Client payment reminder sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send client reminder");
    }
  }

  async function handleRemindExecutive() {
    try {
      const result = await remindExecutive.mutateAsync(row.id);
      toast.success(
        result.recipientCount
          ? `Executive reminder sent to ${result.recipientCount} recipients`
          : "Executive reminder sent",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send executive reminder");
    }
  }

  const installments = installmentsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

  return (
    <div className="grid gap-3 border-t border-border/80 bg-muted/20 p-3 dark:bg-muted/10 md:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Installment schedule
          </h4>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={remindClient.isPending}
              onClick={() => void handleRemindClient()}
            >
              <Bell className="h-3 w-3" />
              Remind client
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={remindExecutive.isPending}
              onClick={() => void handleRemindExecutive()}
            >
              <Mail className="h-3 w-3" />
              Remind executives
            </Button>
          </div>
        </div>
        {installmentsQuery.isLoading ? (
          <p className="py-2 text-xs text-muted-foreground">Loading schedule…</p>
        ) : installments.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No installments configured.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[280px] text-xs">
              <thead className="bg-card text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-left font-medium">Amount</th>
                  <th className="px-2 py-1.5 text-left font-medium">Due</th>
                  <th className="px-2 py-1.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst) => (
                  <tr key={inst.index} className="border-t border-border/60">
                    <td className="px-2 py-1.5 tabular-nums">{inst.index}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatInr(inst.amount)}
                      {inst.remainingAmount > 0 && inst.remainingAmount < inst.amount ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          ({formatInr(inst.remainingAmount)} due)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">{formatDate(inst.dueDate)}</td>
                    <td className="px-2 py-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md px-1.5 py-0 text-[10px] font-medium",
                          installmentStatusClass(inst.status),
                        )}
                      >
                        {installmentStatusLabel(inst.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payment history
          </h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() => setRecordOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Record payment
          </Button>
        </div>
        {transactionsQuery.isLoading ? (
          <p className="py-2 text-xs text-muted-foreground">Loading payments…</p>
        ) : transactions.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {transactions.map((txn) => (
              <li key={txn.id} className="flex items-start justify-between gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium tabular-nums">{formatInr(txn.amount)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(txn.paidDate)}</div>
                  {txn.note ? (
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{txn.note}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CrmRecordPaymentDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        accountName={row.accountName}
        onSubmit={async (input) => {
          await recordPayment.mutateAsync({ accountId: row.id, ...input });
        }}
      />
    </div>
  );
}
