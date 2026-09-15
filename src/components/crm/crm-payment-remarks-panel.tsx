import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCrmPaymentRemark,
  useCrmPaymentRemarks,
  useDeleteCrmPaymentRemark,
} from "@/hooks/use-crm-payments";
import { cn, formatDateTime } from "@/lib/utils";
import {
  isPaymentRemarkImageMime,
  PAYMENT_REMARK_MAX_IMAGE_BYTES,
  type PaymentRemark,
} from "@/types/payment-remark";

type Props = {
  accountId: string;
};

export function CrmPaymentRemarksPanel({ accountId }: Props) {
  const remarksQuery = useCrmPaymentRemarks(accountId, true);
  const createRemark = useCreateCrmPaymentRemark(accountId);
  const deleteRemark = useDeleteCrmPaymentRemark(accountId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const remarks = remarksQuery.data ?? [];

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

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
    const text = body.trim();
    if (!text) {
      toast.error("Enter a remark");
      return;
    }
    try {
      await createRemark.mutateAsync({ body: text, image: image ?? undefined });
      setBody("");
      clearImage();
      toast.success("Remark saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save remark");
    }
  }

  async function handleDelete(remark: PaymentRemark) {
    try {
      await deleteRemark.mutateAsync(remark.id);
      toast.success("Remark deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete remark");
    }
  }

  return (
    <div className="min-w-0 md:col-span-2">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Remarks
      </h4>

      <div className="rounded-md border border-border bg-card p-2.5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Add a collection remark…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
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
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-3 w-3" />
            {image ? "Change image" : "Add image"}
          </Button>
          {image ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
              onClick={clearImage}
            >
              <X className="h-3 w-3" />
              Remove image
            </Button>
          ) : null}
          <div className="ml-auto">
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1 px-2.5 text-[11px]"
              disabled={createRemark.isPending}
              onClick={() => void handleSave()}
            >
              {createRemark.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Save remark
            </Button>
          </div>
        </div>
        {previewUrl ? (
          <div className="mt-2 overflow-hidden rounded-md border border-border">
            <img
              src={previewUrl}
              alt="Remark attachment preview"
              className="max-h-40 w-full object-contain bg-muted/30"
            />
          </div>
        ) : null}
      </div>

      {remarksQuery.isLoading ? (
        <p className="mt-2 py-2 text-xs text-muted-foreground">Loading remarks…</p>
      ) : remarks.length === 0 ? (
        <p className="mt-2 py-2 text-xs text-muted-foreground">
          No remarks yet. Add follow-up notes with an optional image.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {remarks.map((remark) => (
            <li
              key={remark.id}
              className={cn(
                "rounded-md border border-border bg-card px-2.5 py-2",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground">{remark.createdByName}</span>
                    {" · "}
                    {formatDateTime(remark.createdAt)}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{remark.body}</p>
                  {remark.image ? (
                    <a
                      href={remark.image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block overflow-hidden rounded-md border border-border"
                    >
                      <img
                        src={remark.image.url}
                        alt={remark.image.fileName}
                        className="max-h-48 w-full object-contain bg-muted/20"
                      />
                    </a>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  disabled={deleteRemark.isPending}
                  onClick={() => void handleDelete(remark)}
                  aria-label="Delete remark"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
