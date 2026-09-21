import { Bell, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CrmPaymentRemarksPanel } from "@/components/crm/crm-payment-remarks-panel";
import {
  CrmPaymentInstallmentDialog,
  type InstallmentDialogInitial,
} from "@/components/crm/crm-payment-installment-dialog";
import {
  CrmRecordPaymentDialog,
  type PaymentDialogInitial,
} from "@/components/crm/crm-record-payment-dialog";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAddCrmPaymentInstallment,
  useCrmPaymentInstallments,
  useCrmPaymentTransactions,
  useDeleteCrmPayment,
  useDeleteCrmPaymentInstallment,
  useRecordCrmPayment,
  useRemindCrmPayment,
  useRemindCrmPaymentExecutive,
  useUpdateCrmPayment,
  useUpdateCrmPaymentInstallment,
} from "@/hooks/use-crm-payments";
import { refreshAutomationLogsInStore } from "@/lib/automation-log-sync";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<PaymentDialogInitial | null>(null);
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [installmentInitial, setInstallmentInitial] = useState<InstallmentDialogInitial | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; amount: number } | null>(
    null,
  );
  const [deleteInstallment, setDeleteInstallment] = useState<{
    id: string;
    amount: number;
  } | null>(null);
  const installmentsQuery = useCrmPaymentInstallments(row.id, true);
  const transactionsQuery = useCrmPaymentTransactions(row.id, true);
  const recordPayment = useRecordCrmPayment(search);
  const updatePayment = useUpdateCrmPayment(search);
  const deletePayment = useDeleteCrmPayment(search);
  const addInstallment = useAddCrmPaymentInstallment(search);
  const updateInstallment = useUpdateCrmPaymentInstallment(search);
  const removeInstallment = useDeleteCrmPaymentInstallment(search);
  const remindClient = useRemindCrmPayment();
  const remindExecutive = useRemindCrmPaymentExecutive();

  function openCreate() {
    setEditInitial(null);
    setDialogOpen(true);
  }

  function openAddInstallment() {
    setInstallmentInitial(null);
    setInstallmentDialogOpen(true);
  }

  function openEditInstallment(inst: { id?: string; amount: number; dueDate: string }) {
    if (!inst.id) return;
    setInstallmentInitial({ id: inst.id, amount: inst.amount, dueDate: inst.dueDate });
    setInstallmentDialogOpen(true);
  }

  function openEdit(txn: {
    id: string;
    amount: number;
    paidDate: string;
    note?: string;
    image?: PaymentDialogInitial["image"];
  }) {
    setEditInitial({
      id: txn.id,
      amount: txn.amount,
      paidDate: txn.paidDate,
      note: txn.note,
      image: txn.image,
    });
    setDialogOpen(true);
  }

  async function handleRemindClient() {
    try {
      await remindClient.mutateAsync(row.id);
      toast.success("Client payment reminder sent");
      void refreshAutomationLogsInStore("crm-automation");
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
      void refreshAutomationLogsInStore("crm-automation");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send executive reminder");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deletePayment.mutateAsync({ id: deleteTarget.id, accountId: row.id });
      toast.success("Payment deleted");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete payment");
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
              onClick={openAddInstallment}
            >
              <Plus className="h-3 w-3" />
              Add installment
            </Button>
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
          <p className="py-2 text-xs text-muted-foreground">
            No installments configured. Add a renewal installment to schedule the next due.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[280px] text-xs">
              <thead className="bg-card text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-left font-medium">Amount</th>
                  <th className="px-2 py-1.5 text-left font-medium">Due</th>
                  <th className="px-2 py-1.5 text-left font-medium">Status</th>
                  <th className="px-2 py-1.5 text-right font-medium"> </th>
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
                      <div className="flex flex-wrap items-center gap-1">
                        {inst.kind === "renewal" ? (
                          <Badge
                            variant="outline"
                            className="rounded-md border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-700 dark:text-violet-400"
                          >
                            Renewal
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md px-1.5 py-0 text-[10px] font-medium",
                            installmentStatusClass(inst.status),
                          )}
                        >
                          {installmentStatusLabel(inst.status)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {inst.id && inst.kind === "renewal" ? (
                        <div className="flex justify-end gap-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            aria-label="Edit installment"
                            onClick={() => openEditInstallment(inst)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            aria-label="Delete installment"
                            onClick={() =>
                              setDeleteInstallment({ id: inst.id!, amount: inst.amount })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : null}
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
            onClick={openCreate}
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
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="text-xs font-medium tabular-nums">{formatInr(txn.amount)}</div>
                    {txn.isRenewal ? (
                      <Badge
                        variant="outline"
                        className="rounded-md border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-700 dark:text-violet-400"
                      >
                        {txn.dealAmount && txn.dealAmount > 0.01
                          ? `Renewal ${formatInr(txn.renewalAmount ?? 0)}`
                          : "Renewal"}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(txn.paidDate)}</div>
                  {txn.note ? (
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{txn.note}</div>
                  ) : null}
                  {txn.image ? (
                    <a
                      href={txn.image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 block overflow-hidden rounded border border-border"
                    >
                      <img
                        src={txn.image.url}
                        alt={txn.image.fileName}
                        className="max-h-28 w-full object-contain bg-muted/20"
                      />
                    </a>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    aria-label="Edit payment"
                    onClick={() => openEdit(txn)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete payment"
                    onClick={() => setDeleteTarget({ id: txn.id, amount: txn.amount })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CrmPaymentRemarksPanel accountId={row.id} />

      <CrmRecordPaymentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditInitial(null);
        }}
        accountName={row.accountName}
        initial={editInitial}
        onSubmit={async (input) => {
          if (editInitial) {
            await updatePayment.mutateAsync({
              id: editInitial.id,
              accountId: row.id,
              amount: input.amount,
              paidDate: input.paidDate,
              note: input.note,
              image: input.image,
              clearImage: input.clearImage,
            });
          } else {
            await recordPayment.mutateAsync({ accountId: row.id, ...input });
          }
        }}
      />

      <CrmPaymentInstallmentDialog
        open={installmentDialogOpen}
        onOpenChange={(open) => {
          setInstallmentDialogOpen(open);
          if (!open) setInstallmentInitial(null);
        }}
        accountName={row.accountName}
        initial={installmentInitial}
        onSubmit={async (input) => {
          if (installmentInitial) {
            await updateInstallment.mutateAsync({
              accountId: row.id,
              installmentId: installmentInitial.id,
              amount: input.amount,
              dueDate: input.dueDate,
            });
          } else {
            await addInstallment.mutateAsync({
              accountId: row.id,
              amount: input.amount,
              dueDate: input.dueDate,
            });
          }
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete payment?"
        description={
          deleteTarget
            ? `Remove the ${formatInr(deleteTarget.amount)} payment from this account? Totals will be recalculated.`
            : undefined
        }
        onConfirm={() => void handleDeleteConfirm()}
        confirmLabel={deletePayment.isPending ? "Deleting…" : "Delete"}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteInstallment)}
        onOpenChange={(open) => {
          if (!open) setDeleteInstallment(null);
        }}
        title="Delete installment?"
        description={
          deleteInstallment
            ? `Remove the ${formatInr(deleteInstallment.amount)} renewal installment from this schedule?`
            : undefined
        }
        onConfirm={() => {
          if (!deleteInstallment) return;
          void removeInstallment
            .mutateAsync({ accountId: row.id, installmentId: deleteInstallment.id })
            .then(() => {
              toast.success("Installment deleted");
              setDeleteInstallment(null);
            })
            .catch((e) => {
              toast.error(e instanceof Error ? e.message : "Failed to delete installment");
            });
        }}
        confirmLabel={removeInstallment.isPending ? "Deleting…" : "Delete"}
      />
    </div>
  );
}
