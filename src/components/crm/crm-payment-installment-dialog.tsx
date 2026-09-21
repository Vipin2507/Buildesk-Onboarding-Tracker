import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type InstallmentDialogInitial = {
  id: string;
  amount: number;
  dueDate: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  initial?: InstallmentDialogInitial | null;
  onSubmit: (input: { amount: number; dueDate: string }) => Promise<void>;
};

export function CrmPaymentInstallmentDialog({
  open,
  onOpenChange,
  accountName,
  initial,
  onSubmit,
}: Props) {
  const isEdit = Boolean(initial);
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setAmount(String(initial.amount));
      setDueDate(initial.dueDate.slice(0, 10));
    } else {
      setAmount("");
      setDueDate(today);
    }
  }, [open, initial, today]);

  async function handleSubmit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid installment amount");
      return;
    }
    if (!dueDate) {
      toast.error("Choose a due date");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ amount: value, dueDate });
      onOpenChange(false);
      toast.success(isEdit ? "Installment updated" : "Renewal installment added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save installment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit installment · ${accountName}` : `Add installment · ${accountName}`}
      submitLabel={saving ? "Saving…" : isEdit ? "Save" : "Add installment"}
      submitDisabled={saving}
      onSubmit={() => void handleSubmit()}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? "Update this installment amount or due date."
            : "Add a renewal installment for the next billing cycle. This is not counted against the original deal value."}
        </p>
        <div>
          <Label htmlFor="renewal-installment-amount">Amount (₹)</Label>
          <Input
            id="renewal-installment-amount"
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5"
            autoFocus
          />
        </div>
        <div>
          <Label>Due date</Label>
          <DatePickerField modal className="mt-1.5" value={dueDate} onChange={setDueDate} />
        </div>
      </div>
    </EntityFormModal>
  );
}
