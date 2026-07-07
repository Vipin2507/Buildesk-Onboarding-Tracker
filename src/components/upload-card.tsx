import { useState } from "react";
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
}: {
  title: string;
  description?: string;
  sampleName?: string;
  onUpload?: (fileName: string) => void;
  fileName?: string;
  uploadedAt?: string;
  recordCount?: number;
  onRemove?: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  function fakeUpload(name: string) {
    setUploading(true);
    setProgress(0);
    const start = Date.now();
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / 1200) * 100);
      setProgress(p);
      if (p < 100) requestAnimationFrame(tick);
      else {
        setUploading(false);
        onUpload?.(name);
        toast.success(`${name} uploaded successfully`, { description: recordCount ? `${recordCount} records validated.` : "Validation passed with 0 errors." });
      }
    };
    requestAnimationFrame(tick);
  }

  return (
    <div className="card-soft p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-accent-foreground">
          <Download className="h-4 w-4" /> Sample
        </Button>
      </div>

      {!fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            fakeUpload(f?.name ?? sampleName);
          }}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-all",
            drag ? "border-accent bg-accent/10 scale-[1.01]" : "border-border bg-muted/40",
          )}
        >
          <motion.div animate={{ y: drag ? -4 : 0 }} className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <UploadCloud className="h-6 w-6" />
          </motion.div>
          <div className="text-sm text-foreground">
            <span className="font-medium">Drop file here</span> or{" "}
            <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => fakeUpload(sampleName)}>browse</button>
          </div>
          <p className="text-xs text-muted-foreground">Accepts .xlsx, .xls, .csv up to 10MB</p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-success" />
            <div>
              <div className="text-sm font-medium">{fileName}</div>
              <div className="text-xs text-muted-foreground">
                Uploaded {uploadedAt ? new Date(uploadedAt).toLocaleString() : ""}
                {recordCount != null && ` · ${recordCount} records`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              <Check className="h-3 w-3" /> Verified
            </div>
            {onRemove && (
              <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {uploading && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Uploading…</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const UPLOAD_TYPE_MAP: Record<string, UploadType> = {
  "Unit Configuration": "unit",
  "Customer Data": "customer",
  "Booking Data": "booking",
  "Payment Data": "payment",
};
