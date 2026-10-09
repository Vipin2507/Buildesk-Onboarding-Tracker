import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { ConfirmDeleteDialog, EntityFormModal } from "@/components/entity-form-modal";
import { EmptyState } from "@/components/empty-state";
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

function paymentStatusTone(status?: string) {
  if (status === "Fully paid") return "success" as const;
  if (status === "Partially paid" || status === "Part payment subscription") return "warning" as const;
  if (status === "Pending") return "danger" as const;
  return "muted" as const;
}

function installmentTone(status: CompanyPaymentInstallmentStatus) {
  if (status === "paid") return "success" as const;
  if (status === "overdue") return "danger" as const;
  if (status === "waived") return "muted" as const;
  return "warning" as const;
}

export function CompanyPaymentsTab({ companyId }: { companyId: string }) {
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

  const collectionPct = useMemo(() => {
    if (!data || data.dealSize <= 0) return 0;
    return Math.min(100, Math.round((data.paymentReceived / data.dealSize) * 100));
  }, [data]);

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
    return <p className="text-sm text-muted-foreground">Loading ERP payments…</p>;
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load payments"
        description="ERP payment data is separate from CRM. Try again."
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Deal size" value={formatInr(data.dealSize)} />
        <SummaryCard label="Received" value={formatInr(data.paymentReceived)} />
        <SummaryCard label="Pending" value={formatInr(data.pendingAmount)} />
        <div className="card-soft flex flex-col gap-1 px-3 py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={paymentStatusTone(data.paymentStatus)}>{data.paymentStatus}</Pill>
            <span className="text-xs tabular-nums text-muted-foreground">{collectionPct}%</span>
          </div>
        </div>
      </div>

      <section className="card-soft p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Installment schedule</h3>
            <p className="text-xs text-muted-foreground">
              ERP-only schedule for this company — not linked to CRM payments.
            </p>
          </div>
          <Button size="sm" className="h-8 gap-1" onClick={openCreateInstallment}>
            <Plus className="h-3.5 w-3.5" /> Add installment
          </Button>
        </div>
        {data.installments.length === 0 ? (
          <EmptyState
            title="No installments yet"
            description="Add a schedule or seed from commercial installment fields on Details."
            actionLabel="+ Add installment"
            onAction={openCreateInstallment}
          />
        ) : (
          <ul className="space-y-2">
            {data.installments.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {row.label || `Installment ${row.sequence}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Due {formatDate(row.dueDate)} · {formatInr(row.amount)}
                  </div>
                </div>
                <Pill tone={installmentTone(row.status)}>{row.status}</Pill>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => openEditInstallment(row)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setDeleteInstallmentId(row.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-soft p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Payment history
            </h3>
            <p className="text-xs text-muted-foreground">
              Ledger for this ERP company. CRM account payments are not shown here.
            </p>
          </div>
          <Button size="sm" className="h-8 gap-1 bg-primary" onClick={openCreatePayment}>
            <Plus className="h-3.5 w-3.5" /> Record payment
          </Button>
        </div>
        {data.transactions.length === 0 ? (
          <EmptyState
            title="No payments recorded"
            description="Record collections against this company’s deal size."
            actionLabel="+ Record payment"
            onAction={openCreatePayment}
          />
        ) : (
          <ul className="space-y-2">
            {data.transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold tabular-nums">{formatInr(tx.amount)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDate(tx.paidDate)}
                    {tx.method ? ` · ${tx.method}` : ""}
                    {tx.createdBy ? ` · by ${tx.createdBy}` : ""}
                  </div>
                  {tx.note ? (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{tx.note}</div>
                  ) : null}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => openEditPayment(tx)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setDeletePaymentId(tx.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EntityFormModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        title={editingPayment ? "Edit payment" : "Record payment"}
        onSubmit={() => void savePayment()}
        submitLabel={savingPayment ? "Saving…" : editingPayment ? "Save" : "Record"}
        submitDisabled={savingPayment}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Amount (₹)
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <div>
            <div className="text-xs font-medium">Paid date</div>
            <DatePickerField
              displayFormat="dd/MM/yyyy"
              value={paidDate}
              onChange={setPaidDate}
              className="mt-1"
            />
          </div>
          <label className="text-xs font-medium">
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof COMPANY_PAYMENT_METHODS)[number])}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
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
              className="mt-1 min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Optional reference / UTR"
            />
          </label>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={installmentOpen}
        onOpenChange={setInstallmentOpen}
        title={editingInstallment ? "Edit installment" : "Add installment"}
        onSubmit={() => void saveInstallment()}
        submitLabel={savingInstallment ? "Saving…" : "Save"}
        submitDisabled={savingInstallment}
      >
        <div className="grid gap-3">
          <label className="text-xs font-medium">
            Label
            <input
              value={instLabel}
              onChange={(e) => setInstLabel(e.target.value)}
              placeholder="Installment 1"
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium">
            Amount (₹)
            <input
              type="number"
              min={1}
              step={1}
              value={instAmount}
              onChange={(e) => setInstAmount(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <div>
            <div className="text-xs font-medium">Due date</div>
            <DatePickerField
              displayFormat="dd/MM/yyyy"
              value={instDueDate}
              onChange={setInstDueDate}
              className="mt-1"
            />
          </div>
          <label className="text-xs font-medium">
            Status
            <select
              value={instStatus}
              onChange={(e) => setInstStatus(e.target.value as CompanyPaymentInstallmentStatus)}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
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
              className="mt-1 min-h-[64px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      </EntityFormModal>

      <ConfirmDeleteDialog
        open={!!deletePaymentId}
        onOpenChange={(open) => !open && setDeletePaymentId(null)}
        title="Delete payment?"
        description="This removes the ERP payment ledger entry and recalculates received/pending."
        onConfirm={() => {
          if (!deletePaymentId) return;
          void deletePayment
            .mutateAsync(deletePaymentId)
            .then(() => toast.success("Payment deleted"))
            .catch((err) => toast.error(err instanceof Error ? err.message : "Delete failed"));
          setDeletePaymentId(null);
        }}
      />
      <ConfirmDeleteDialog
        open={!!deleteInstallmentId}
        onOpenChange={(open) => !open && setDeleteInstallmentId(null)}
        title="Delete installment?"
        description="This removes the installment from the ERP schedule."
        onConfirm={() => {
          if (!deleteInstallmentId) return;
          void deleteInstallment
            .mutateAsync(deleteInstallmentId)
            .then(() => toast.success("Installment deleted"))
            .catch((err) => toast.error(err instanceof Error ? err.message : "Delete failed"));
          setDeleteInstallmentId(null);
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft flex flex-col gap-1 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
