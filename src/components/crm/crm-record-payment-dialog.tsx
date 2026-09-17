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
  type PaymentRemarkImage,
} from "@/types/payment-remark";

export type PaymentDialogInitial = {
  id: string;
  amount: number;
  paidDate: string;
  note?: string;
  image?: PaymentRemarkImage;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  /** When set, dialog edits an existing payment instead of creating one. */
  initial?: PaymentDialogInitial | null;
  onSubmit: (input: {
    amount: number;
    paidDate: string;
    note?: string;
    image?: File;
    clearImage?: boolean;
  }) => Promise<void>;
};

export function CrmRecordPaymentDialog({
  open,
  onOpenChange,
  accountName,
  initial,
  onSubmit,
}: Props) {
  const isEdit = Boolean(initial);
  const today = new Date().toISOString().slice(0, 10);
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(today);
  const [note, setNote] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [clearExistingImage, setClearExistingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  function clearPickedImage() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImage(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setAmount(String(initial.amount));
      setPaidDate(initial.paidDate.slice(0, 10));
      setNote(initial.note ?? "");
      setExistingImageUrl(initial.image?.url ?? null);
      setClearExistingImage(false);
    } else {
      setAmount("");
      setPaidDate(today);
      setNote("");
      setExistingImageUrl(null);
      setClearExistingImage(false);
    }
    clearPickedImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens / edit target changes
  }, [open, initial?.id, today]);

  function onPickImage(file: File | null) {
    if (!file) {
      clearPickedImage();
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
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setClearExistingImage(false);
  }

  function removeImage() {
    clearPickedImage();
    if (existingImageUrl) {
      setExistingImageUrl(null);
      setClearExistingImage(true);
    }
  }

  const shownPreview = previewUrl ?? existingImageUrl;

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
        clearImage: isEdit ? clearExistingImage && !image : undefined,
      });
      toast.success(isEdit ? "Payment updated" : "Payment recorded");
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isEdit
            ? "Failed to update payment"
            : "Failed to record payment",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEdit
          ? `Update payment — ${accountName}`
          : `Record payment — ${accountName}`
      }
      onSubmit={() => void handleSave()}
      submitDisabled={saving}
      submitLabel={isEdit ? "Save changes" : "Save payment"}
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
              {shownPreview ? "Change image" : "Add image"}
            </Button>
            {shownPreview ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-muted-foreground"
                onClick={removeImage}
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
          {shownPreview ? (
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              <img
                src={shownPreview}
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
