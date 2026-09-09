import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  onSubmit: (input: { amount: number; paidDate: string; note?: string }) => Promise<void>;
};

export function CrmRecordPaymentDialog({
  open,
  onOpenChange,
  accountName,
  onSubmit,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setPaidDate(today);
      setNote("");
    }
  }, [open, today]);

  async function handleSave() {
    const parsed = Number(amount.replace(/[,₹]/g, "").trim());
    if (!parsed || parsed <= 0) {
      toast.error("Enter a payment amount greater than zero");
      return;
    }
    if (!paidDate) {
      toast.error("Select a payment date");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        amount: parsed,
        paidDate,
        note: note.trim() || undefined,
      });
      toast.success("Payment recorded");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Record payment — ${accountName}`}
      onSubmit={() => void handleSave()}
      submitDisabled={saving}
      submitLabel="Save payment"
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="payment-amount">Amount (₹)</Label>
          <Input
            id="payment-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="h-9"
          />
        </div>
        <div>
          <Label>Paid date</Label>
          <DatePickerField value={paidDate} onChange={setPaidDate} className="h-9" />
        </div>
        <div>
          <Label htmlFor="payment-note">Note (optional)</Label>
          <Textarea
            id="payment-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="resize-none text-sm"
            placeholder="Cheque ref, UTR, etc."
          />
        </div>
      </div>
    </EntityFormModal>
  );
}
