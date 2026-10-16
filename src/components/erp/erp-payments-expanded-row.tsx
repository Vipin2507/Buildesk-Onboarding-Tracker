import { Link } from "@tanstack/react-router";
import { ArrowRight, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  useCompanyPayments,
  useDeleteCompanyPayment,
  useDeleteCompanyPaymentInstallment,
  useRecordCompanyPayment,
  useUpdateCompanyPayment,
  useUpsertCompanyPaymentInstallment,
} from "@/hooks/use-company-payments";
import { formatDate, formatInr } from "@/lib/utils";
import {
  COMPANY_PAYMENT_INSTALLMENT_STATUSES,
  COMPANY_PAYMENT_METHODS,
  type CompanyPaymentInstallment,
  type CompanyPaymentInstallmentStatus,
  type CompanyPaymentTransaction,
} from "@/types/company-payment";

function installmentTone(status: CompanyPaymentInstallmentStatus) {
  if (status === "paid") return "success" as const;
  if (status === "overdue") return "danger" as const;
  if (status === "waived") return "muted" as const;
  return "warning" as const;
}

type Props = {
  companyId: string;
  companyName: string;
};

/** Inline installment schedule + ledger for ERP /payments expand (CRM-style). */
export function ErpPaymentsExpandedRow({ companyId, companyName }: Props) {
  const { data, isLoading, isError, refetch } = useCompanyPayments(companyId);
  const recordPayment = useRecordCompanyPayment(companyId);
  const updatePayment = useUpdateCompanyPayment(companyId);
  const deletePayment = useDeleteCompanyPayment(companyId);
  const upsertInstallment = useUpsertCompanyPaymentInstallment(companyId);
  const deleteInstallment = useDeleteCompanyPaymentInstallment(companyId);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CompanyPaymentTransaction | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  const [installmentOpen, setInstallmentOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<CompanyPaymentInstallment | null>(
    null,
  );
  const [deleteInstallmentId, setDeleteInstallmentId] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(COMPANY_PAYMENT_METHODS[0]);
  const [note, setNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [instAmount, setInstAmount] = useState("");
  const [instDueDate, setInstDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [instLabel, setInstLabel] = useState("");
  const [instStatus, setInstStatus] = useState<CompanyPaymentInstallmentStatus>("pending");
  const [instNotes, setInstNotes] = useState("");
  const [savingInstallment, setSavingInstallment] = useState(false);

  function openCreatePayment() {
    setEditingPayment(null);
    setAmount("");
    setPaidDate(new Date().toISOString().slice(0, 10));
    setMethod(COMPANY_PAYMENT_METHODS[0]);
    setNote("");
    setPaymentOpen(true);
  }

  function openEditPayment(tx: CompanyPaymentTransaction) {
    setEditingPayment(tx);
    setAmount(String(tx.amount));
    setPaidDate(tx.paidDate.slice(0, 10));
    setMethod((tx.method as (typeof COMPANY_PAYMENT_METHODS)[number]) || COMPANY_PAYMENT_METHODS[0]);
    setNote(tx.note ?? "");
    setPaymentOpen(true);
  }

  async function savePayment() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (!paidDate) {
      toast.error("Paid date is required");
      return;
    }
    setSavingPayment(true);
    try {
      if (editingPayment) {
        await updatePayment.mutateAsync({
          id: editingPayment.id,
          amount: value,
          paidDate,
          method,
          note: note.trim() || null,
        });
        toast.success("Payment updated");
      } else {
        await recordPayment.mutateAsync({
          amount: value,
          paidDate,
          method,
          note: note.trim() || undefined,
        });
        toast.success("Payment recorded");
      }
      setPaymentOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save payment");
    } finally {
      setSavingPayment(false);
    }
  }

  function openCreateInstallment() {
    setEditingInstallment(null);
    setInstAmount("");
    setInstDueDate(new Date().toISOString().slice(0, 10));
    setInstLabel("");
    setInstStatus("pending");
    setInstNotes("");
    setInstallmentOpen(true);
  }

  function openEditInstallment(row: CompanyPaymentInstallment) {
    setEditingInstallment(row);
    setInstAmount(String(row.amount));
    setInstDueDate(row.dueDate.slice(0, 10));
    setInstLabel(row.label ?? "");
    setInstStatus(row.status);
    setInstNotes(row.notes ?? "");
    setInstallmentOpen(true);
  }

  async function saveInstallment() {
    const value = Number(instAmount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid installment amount");
      return;
    }
    if (!instDueDate) {
      toast.error("Due date is required");
      return;
    }
    setSavingInstallment(true);
    try {
      await upsertInstallment.mutateAsync({
        id: editingInstallment?.id,
        amount: value,
        dueDate: instDueDate,
        label: instLabel.trim() || undefined,
        status: instStatus,
        notes: instNotes.trim() || undefined,
      });
      toast.success(editingInstallment ? "Installment updated" : "Installment added");
      setInstallmentOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save installment");
    } finally {
      setSavingInstallment(false);
    }
  }

  if (isLoading) {
    return (
      <div className="border-t border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground dark:bg-muted/10">
        Loading schedule…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-border/80 bg-muted/20 p-3 dark:bg-muted/10">
        <p className="text-xs text-muted-foreground">Could not load payments for {companyName}.</p>
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

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
              onClick={openCreateInstallment}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" asChild>
              <Link
                to="/companies/$companyId"
                params={{ companyId }}
                search={{ tab: "Payments" }}
              >
                Full page <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
        {data.installments.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No installments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[260px] text-xs">
              <thead className="bg-card text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Label</th>
                  <th className="px-2 py-1.5 text-left font-medium">Amount</th>
                  <th className="px-2 py-1.5 text-left font-medium">Due</th>
                  <th className="px-2 py-1.5 text-left font-medium">Status</th>
                  <th className="px-2 py-1.5 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {data.installments.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-2 py-1.5">{row.label || `#${row.sequence}`}</td>
                    <td className="px-2 py-1.5 tabular-nums">{formatInr(row.amount)}</td>
                    <td className="px-2 py-1.5">{formatDate(row.dueDate)}</td>
                    <td className="px-2 py-1.5">
                      <Pill tone={installmentTone(row.status)}>{row.status}</Pill>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openEditInstallment(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => setDeleteInstallmentId(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
          <h4 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-3 w-3" />
            Payment history
          </h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={openCreatePayment}
          >
            <Plus className="h-3 w-3" />
            Record
          </Button>
        </div>
        {data.transactions.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {data.transactions.map((tx) => (
              <li key={tx.id} className="flex items-start justify-between gap-2 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium tabular-nums">{formatInr(tx.amount)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDate(tx.paidDate)}
                    {tx.method ? ` · ${tx.method}` : ""}
                  </div>
                  {tx.note ? (
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{tx.note}</div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => openEditPayment(tx)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => setDeletePaymentId(tx.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EntityFormModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        title={editingPayment ? "Edit payment" : "Record payment"}
        submitLabel={savingPayment ? "Saving…" : editingPayment ? "Save" : "Record"}
        onSubmit={() => void savePayment()}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border px-2.5 text-xs"
              inputMode="decimal"
            />
          </label>
          <label className="text-xs font-medium">
            Paid date
            <div className="mt-1">
              <DatePickerField
                displayFormat="dd/MM/yyyy"
                value={paidDate}
                onChange={setPaidDate}
                modal
              />
            </div>
          </label>
          <label className="text-xs font-medium">
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof COMPANY_PAYMENT_METHODS)[number])}
              className="mt-1 h-8 w-full rounded-md border px-2.5 text-xs"
            >
              {COMPANY_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 min-h-[56px] w-full rounded-md border px-2.5 py-1.5 text-xs"
            />
          </label>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={installmentOpen}
        onOpenChange={setInstallmentOpen}
        title={editingInstallment ? "Edit installment" : "Add installment"}
        submitLabel={savingInstallment ? "Saving…" : editingInstallment ? "Save" : "Add"}
        onSubmit={() => void saveInstallment()}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Label
            <input
              value={instLabel}
              onChange={(e) => setInstLabel(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border px-2.5 text-xs"
              placeholder="Optional"
            />
          </label>
          <label className="text-xs font-medium">
            Amount
            <input
              value={instAmount}
              onChange={(e) => setInstAmount(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border px-2.5 text-xs"
              inputMode="decimal"
            />
          </label>
          <label className="text-xs font-medium">
            Due date
            <div className="mt-1">
              <DatePickerField
                displayFormat="dd/MM/yyyy"
                value={instDueDate}
                onChange={setInstDueDate}
                modal
              />
            </div>
          </label>
          <label className="text-xs font-medium">
            Status
            <select
              value={instStatus}
              onChange={(e) => setInstStatus(e.target.value as CompanyPaymentInstallmentStatus)}
              className="mt-1 h-8 w-full rounded-md border px-2.5 text-xs"
            >
              {COMPANY_PAYMENT_INSTALLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Notes
            <textarea
              value={instNotes}
              onChange={(e) => setInstNotes(e.target.value)}
              className="mt-1 min-h-[56px] w-full rounded-md border px-2.5 py-1.5 text-xs"
            />
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={Boolean(deletePaymentId)}
        onOpenChange={(o) => !o && setDeletePaymentId(null)}
        title="Delete payment?"
        description="Remove this ledger entry? Company totals will be recalculated."
        onConfirm={() => {
          if (!deletePaymentId) return;
          void deletePayment
            .mutateAsync(deletePaymentId)
            .then(() => {
              toast.success("Payment deleted");
              setDeletePaymentId(null);
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : "Delete failed"));
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteInstallmentId)}
        onOpenChange={(o) => !o && setDeleteInstallmentId(null)}
        title="Delete installment?"
        description="Remove this installment from the schedule?"
        onConfirm={() => {
          if (!deleteInstallmentId) return;
          void deleteInstallment
            .mutateAsync(deleteInstallmentId)
            .then(() => {
              toast.success("Installment deleted");
              setDeleteInstallmentId(null);
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : "Delete failed"));
        }}
      />
    </div>
  );
}
