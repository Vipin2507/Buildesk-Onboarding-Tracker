import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileSpreadsheet, Check, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UploadType } from "@/types";

export function UploadCard({
  title,
  description,
  sampleName = "sample.xlsx",
  onUpload,
  fileName,
  uploadedAt,
  recordCount,
  onRemove,
  onReplaceRequest,
  variant = "card",
  disabled = false,
  hideSample = false,
  acceptHint = "Accepts .xlsx, .xls, .csv up to 10MB",
  toastOnComplete = true,
}: {
  title?: string;
  description?: string;
  sampleName?: string;
  onUpload?: (fileName: string) => void;
  fileName?: string;
  uploadedAt?: string;
  recordCount?: number;
  onRemove?: () => void;
  /** When a file already exists, call this instead of uploading (parent can confirm, then call onUpload). */
  onReplaceRequest?: (fileName: string) => void;
  variant?: "card" | "embedded";
  disabled?: boolean;
  hideSample?: boolean;
  acceptHint?: string;
  toastOnComplete?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const embedded = variant === "embedded";

  function requestUpload(name: string) {
    if (disabled || uploading) return;
    if (fileName && onReplaceRequest) {
      onReplaceRequest(name);
      return;
    }
    runFakeUpload(name);
  }

  function runFakeUpload(name: string) {
    setUploading(true);
    setProgress(0);
    const start = Date.now();
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / 1200) * 100);
      setProgress(p);
      if (p < 100) {
        requestAnimationFrame(tick);
        return;
      }
      setUploading(false);
      onUpload?.(name);
      if (toastOnComplete) {
        toast.success(`${name} uploaded successfully`, {
          description: "Validation passed with 0 errors.",
        });
      }
    };
    requestAnimationFrame(tick);
  }

  const dropZone = (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        requestUpload(f?.name ?? sampleName);
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all",
        embedded ? "p-4" : "p-8",
        disabled
          ? "cursor-not-allowed border-muted bg-muted/20 opacity-60"
          : drag
            ? "scale-[1.01] border-primary bg-primary/10"
            : "border-border bg-muted/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) requestUpload(f.name);
          e.target.value = "";
        }}
      />
      <motion.div
        animate={{ y: drag && !disabled ? -4 : 0 }}
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/15 text-primary",
          embedded ? "h-9 w-9" : "h-12 w-12",
        )}
      >
        <UploadCloud className={embedded ? "h-4 w-4" : "h-6 w-6"} />
      </motion.div>
      <div className={cn("text-center text-foreground", embedded ? "text-xs" : "text-sm")}>
        {disabled ? (
          <span className="text-muted-foreground">Upload locked until template is ready</span>
        ) : (
          <>
            <span className="font-medium">Drop file here</span> or{" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => (inputRef.current ? inputRef.current.click() : requestUpload(sampleName))}
            >
              browse
            </button>
          </>
        )}
      </div>
      {!disabled && <p className="text-[11px] text-muted-foreground">{acceptHint}</p>}
    </div>
  );

  const fileRow = fileName ? (
    <div className={cn("flex items-center justify-between gap-2 rounded-lg border bg-muted/40", embedded ? "p-2.5" : "p-3")}>
      <div className="flex min-w-0 items-center gap-2">
        <FileSpreadsheet className={cn("shrink-0 text-success", embedded ? "h-4 w-4" : "h-5 w-5")} />
        <div className="min-w-0">
          <div className={cn("truncate font-medium", embedded ? "text-xs" : "text-sm")}>{fileName}</div>
          <div className="text-[11px] text-muted-foreground">
            {uploadedAt ? new Date(uploadedAt).toLocaleString() : "Uploaded"}
            {recordCount != null && ` · ${recordCount} records`}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
          <Check className="h-3 w-3" /> Verified
        </div>
        {!disabled && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => requestUpload(sampleName.replace(/(\.\w+)$/, "-v2$1"))}
          >
            Re-upload
          </Button>
        )}
        {onRemove && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  ) : null;

  const progressBar = (
    <AnimatePresence>
      {uploading && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Uploading…</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const body = (
    <>
      {!embedded && (title || description || !hideSample) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-semibold text-foreground">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {!hideSample && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
              <Download className="h-4 w-4" /> Sample
            </Button>
          )}
        </div>
      )}
      {fileName && !uploading ? fileRow : dropZone}
      {progressBar}
    </>
  );

  if (embedded) return <div className="w-full">{body}</div>;
  return <div className="card-soft p-5">{body}</div>;
}

export const UPLOAD_TYPE_MAP: Record<string, UploadType> = {
  "Unit Configuration": "unit",
  "Customer Data": "customer",
  "Booking Data": "booking",
  "Payment Data": "payment",
};
