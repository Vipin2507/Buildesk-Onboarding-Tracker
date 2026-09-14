import { useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDeleteProjectFile,
  useProjectFiles,
  useUploadProjectFile,
} from "@/hooks/use-project-files";
import { cn, formatDateTime } from "@/lib/utils";
import {
  formatProjectFileSize,
  PROJECT_FILE_CATEGORIES,
  PROJECT_FILE_CATEGORY_LABEL,
  PROJECT_FILE_MAX_UPLOAD_BYTES,
  projectFileTypeLabel,
  type ProjectFile,
  type ProjectFileCategory,
} from "@/types/project-file";

type Props = {
  projectId: string;
};

export function ProjectFilesPanel({ projectId }: Props) {
  const { data: files = [], isLoading, isError, refetch } = useProjectFiles(projectId);
  const uploadMutation = useUploadProjectFile(projectId);
  const deleteMutation = useDeleteProjectFile(projectId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<ProjectFileCategory>("other");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => {
      if (filterCategory !== "all" && file.category !== filterCategory) return false;
      if (!q) return true;
      return (
        file.fileName.toLowerCase().includes(q) ||
        (file.purpose ?? "").toLowerCase().includes(q) ||
        (file.notes ?? "").toLowerCase().includes(q) ||
        file.uploadedBy.toLowerCase().includes(q) ||
        PROJECT_FILE_CATEGORY_LABEL[file.category].toLowerCase().includes(q)
      );
    });
  }, [files, filterCategory, search]);

  async function uploadFiles(fileList: FileList | File[]) {
    const list = Array.from(fileList);
    if (!list.length) return;

    for (const file of list) {
      if (file.size > PROJECT_FILE_MAX_UPLOAD_BYTES) {
        toast.error(`"${file.name}" exceeds ${Math.round(PROJECT_FILE_MAX_UPLOAD_BYTES / 1024 / 1024)}MB`);
        continue;
      }
      try {
        await uploadMutation.mutateAsync({
          file,
          category,
          purpose: purpose.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("File uploaded", { description: file.name });
      } catch (error) {
        toast.error("Upload failed", {
          description: error instanceof Error ? error.message : file.name,
        });
      }
    }

    setPurpose("");
    setNotes("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDownload(file: ProjectFile) {
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleOpen(file: ProjectFile) {
    window.open(file.url, "_blank", "noopener,noreferrer");
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("File deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Delete failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="card-soft overflow-hidden">
        <div className="border-b border-border px-3 py-2.5">
          <h3 className="text-xs font-semibold text-muted-foreground">Project files</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Store agreements, configs, exports, and handover packs for this project. Open or download
            anytime.
          </p>
        </div>

        <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
            }}
          >
            <Upload className="mb-2 h-5 w-5 text-primary/70" />
            <p className="text-sm font-medium">Drop files here</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Up to {Math.round(PROJECT_FILE_MAX_UPLOAD_BYTES / 1024 / 1024)}MB each
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3 gap-1.5"
              disabled={uploadMutation.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Choose files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Type
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectFileCategory)}
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
              >
                {PROJECT_FILE_CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {PROJECT_FILE_CATEGORY_LABEL[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Purpose
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Signed agreement"
                className="mt-1 h-8 text-xs"
              />
            </label>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Notes
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context"
                className="mt-1 h-8 text-xs"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {PROJECT_FILE_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {PROJECT_FILE_CATEGORY_LABEL[key]}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-muted-foreground">
            {filtered.length} of {files.length}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading files…
          </div>
        ) : isError ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-destructive">Could not load files</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={files.length === 0 ? "No files yet" : "No matching files"}
              description={
                files.length === 0
                  ? "Upload project documents so the team can find and download them later."
                  : "Try a different search or type filter."
              }
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5 p-2.5 md:hidden">
              {filtered.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onOpen={() => handleOpen(file)}
                  onDownload={() => handleDownload(file)}
                  onDelete={() => setDeleteId(file.id)}
                />
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[48rem] text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">File</th>
                    <th className="w-28 px-2 py-2 font-medium">Type</th>
                    <th className="w-36 px-2 py-2 font-medium">Category</th>
                    <th className="w-20 px-2 py-2 font-medium">Size</th>
                    <th className="w-40 px-2 py-2 font-medium">Uploaded</th>
                    <th className="w-28 px-2 py-2 font-medium">By</th>
                    <th className="w-28 px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((file) => (
                    <tr key={file.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{file.fileName}</div>
                            {file.purpose ? (
                              <div className="truncate text-[10px] text-muted-foreground">
                                {file.purpose}
                              </div>
                            ) : null}
                            {file.notes ? (
                              <div className="truncate text-[10px] text-muted-foreground">
                                {file.notes}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {projectFileTypeLabel(file.mimeType, file.fileName)}
                      </td>
                      <td className="px-2 py-2">{PROJECT_FILE_CATEGORY_LABEL[file.category]}</td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">
                        {formatProjectFileSize(file.sizeBytes)}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {formatDateTime(file.uploadedAt)}
                      </td>
                      <td className="px-2 py-2">{file.uploadedBy}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleOpen(file)}
                            aria-label={`Open ${file.fileName}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleDownload(file)}
                            aria-label={`Download ${file.fileName}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(file.id)}
                            aria-label={`Delete ${file.fileName}`}
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
          </>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete file?"
        description="This permanently removes the file from the project."
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function FileCard({
  file,
  onOpen,
  onDownload,
  onDelete,
}: {
  file: ProjectFile;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{file.fileName}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {PROJECT_FILE_CATEGORY_LABEL[file.category]} ·{" "}
            {projectFileTypeLabel(file.mimeType, file.fileName)} ·{" "}
            {formatProjectFileSize(file.sizeBytes)}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {formatDateTime(file.uploadedAt)} · {file.uploadedBy}
          </div>
          {file.purpose ? (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{file.purpose}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onOpen}>
          <Eye className="h-3 w-3" /> Open
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onDownload}>
          <Download className="h-3 w-3" /> Download
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px] text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
      </div>
    </div>
  );
}
