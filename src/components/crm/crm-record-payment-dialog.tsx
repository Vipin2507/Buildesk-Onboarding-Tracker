import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isPaymentRemarkImageMime,
  PAYMENT_REMARK_MAX_IMAGE_BYTES,
} from "@/types/payment-remark";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  onSubmit: (input: {
    amount: number;
    paidDate: string;
    note?: string;
    image?: File;
  }) => Promise<void>;
};

export function CrmRecordPaymentDialog({
  open,
  onOpenChange,
  accountName,
  onSubmit,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(today);
  const [note, setNote] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  useEffect(() => {
    if (open) {
      setAmount("");
      setPaidDate(today);
      setNote("");
      clearImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens
  }, [open, today]);

  function onPickImage(file: File | null) {
    if (!file) {
      clearImage();
      return;
    }
    if (!isPaymentRemarkImageMime(file.type)) {
      toast.error("Choose a JPEG, PNG, WebP, or GIF image");
      return;
    }
    if (file.size > PAYMENT_REMARK_MAX_IMAGE_BYTES) {
      toast.error(
        `Image must be under ${Math.round(PAYMENT_REMARK_MAX_IMAGE_BYTES / 1024 / 1024)}MB`,
      );
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

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
        image: image ?? undefined,
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
        <div>
          <Label>Receipt image (optional)</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {image ? "Change image" : "Add image"}
            </Button>
            {image ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-muted-foreground"
                onClick={clearImage}
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
          {previewUrl ? (
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              <img
                src={previewUrl}
                alt="Payment receipt preview"
                className="max-h-40 w-full object-contain bg-muted/30"
              />
            </div>
          ) : null}
        </div>
      </div>
    </EntityFormModal>
  );
}
