import { useRef, useState } from "react";
import { Download, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCrmAccountDocuments,
  useDeleteCrmAccountDocument,
  useUpdateCrmAccountDocument,
  useUploadCrmAccountDocument,
} from "@/hooks/use-crm-account-documents";
import { cn, formatDateTime } from "@/lib/utils";
import {
  CRM_ACCOUNT_DOCUMENT_MAX_BYTES,
  crmAccountDocumentRejectReason,
  crmAccountDocumentTypeLabel,
  formatCrmAccountDocumentSize,
  type CrmAccountDocument,
} from "@/types/crm-account-document";

type Props = {
  accountId: string;
};

export function CrmAccountDocumentsTab({ accountId }: Props) {
  const documentsQuery = useCrmAccountDocuments(accountId);
  const upload = useUploadCrmAccountDocument(accountId);
  const update = useUpdateCrmAccountDocument(accountId);
  const remove = useDeleteCrmAccountDocument(accountId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signOffInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CrmAccountDocument | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const documents = documentsQuery.data ?? [];
  const signOff = documents.find((doc) => doc.kind === "signoff") ?? null;
  const files = documents.filter((doc) => doc.kind === "file");

  async function uploadFile(file: File, kind: "file" | "signoff") {
    const rejected = crmAccountDocumentRejectReason(file.name, file.size);
    if (rejected) {
      toast.error(rejected);
      return;
    }
    try {
      await upload.mutateAsync({
        file,
        kind,
        title: kind === "file" ? title.trim() || undefined : "Sign off",
      });
      if (kind === "file") setTitle("");
      toast.success(kind === "signoff" ? "Sign-off document saved" : "Document added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function saveTitle(doc: CrmAccountDocument) {
    const next = editingTitle.trim();
    setEditingId(null);
    if (next === (doc.title ?? "")) return;
    try {
      await update.mutateAsync({ id: doc.id, title: next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename document");
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Sign-off document</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Upload the customer sign-off. Replacing it keeps a single current file.
            </p>
          </div>
          <span
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium",
              signOff
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {signOff ? "Sign off done" : "Sign off not done"}
          </span>
        </div>
        {signOff ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 px-2.5 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{signOff.fileName}</p>
              <p className="text-[11px] text-muted-foreground">
                {crmAccountDocumentTypeLabel(signOff.mimeType, signOff.fileName)} ·{" "}
                {formatCrmAccountDocumentSize(signOff.sizeBytes)} · {formatDateTime(signOff.uploadedAt)} ·{" "}
                {signOff.uploadedBy}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                <a href={signOff.url} download={signOff.fileName}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={upload.isPending}
                onClick={() => signOffInputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove sign-off document"
                onClick={() => setDeleteTarget(signOff)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            className="mt-3 h-8 gap-1 text-xs"
            disabled={upload.isPending}
            onClick={() => signOffInputRef.current?.click()}
          >
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload sign off
          </Button>
        )}
        <input
          ref={signOffInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void uploadFile(file, "signoff");
          }}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Documents</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Excel, PDF, images, zip, and other customer files. Up to{" "}
              {Math.round(CRM_ACCOUNT_DOCUMENT_MAX_BYTES / 1024 / 1024)}MB each.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Label (optional)"
            className="h-8 max-w-xs text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Add document
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadFile(file, "file");
            }}
          />
        </div>

        {documentsQuery.isLoading ? (
          <p className="mt-3 text-xs text-muted-foreground">Loading documents…</p>
        ) : files.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No documents yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Document</th>
                  <th className="px-2 py-1.5 text-left font-medium">Type</th>
                  <th className="px-2 py-1.5 text-left font-medium">Added</th>
                  <th className="px-2 py-1.5 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {files.map((doc) => (
                  <tr key={doc.id} className="border-t border-border/70">
                    <td className="px-2 py-1.5">
                      <div className="flex min-w-0 items-start gap-1.5">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          {editingId === doc.id ? (
                            <Input
                              autoFocus
                              value={editingTitle}
                              onChange={(event) => setEditingTitle(event.target.value)}
                              onBlur={() => void saveTitle(doc)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void saveTitle(doc);
                                if (event.key === "Escape") setEditingId(null);
                              }}
                              className="h-7 text-xs"
                            />
                          ) : (
                            <p className="truncate font-medium">{doc.title || doc.fileName}</p>
                          )}
                          <p className="truncate text-[11px] text-muted-foreground">
                            {doc.fileName} · {formatCrmAccountDocumentSize(doc.sizeBytes)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {crmAccountDocumentTypeLabel(doc.mimeType, doc.fileName)}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {formatDateTime(doc.uploadedAt)}
                      <span className="block">{doc.uploadedBy}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground"
                          aria-label="Rename document"
                          onClick={() => {
                            setEditingId(doc.id);
                            setEditingTitle(doc.title ?? "");
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                          <a href={doc.url} download={doc.fileName} aria-label="Download document">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          aria-label="Delete document"
                          onClick={() => setDeleteTarget(doc)}
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
      </section>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget?.kind === "signoff" ? "Remove sign-off document?" : "Delete document?"}
        description={
          deleteTarget
            ? `${deleteTarget.fileName} will be removed from this account.`
            : undefined
        }
        confirmLabel={remove.isPending ? "Deleting…" : "Delete"}
        onConfirm={() => {
          if (!deleteTarget) return;
          void remove
            .mutateAsync(deleteTarget.id)
            .then(() => {
              toast.success(deleteTarget.kind === "signoff" ? "Sign-off removed" : "Document deleted");
              setDeleteTarget(null);
            })
            .catch((error) => {
              toast.error(error instanceof Error ? error.message : "Could not delete document");
            });
        }}
      />
    </div>
  );
}
