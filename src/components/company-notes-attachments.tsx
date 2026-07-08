import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Pencil,
  Pin,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDeleteDialog } from "@/components/entity-form-modal";
import {
  useNotesAttachmentsStore,
  useCurrentUser,
  useProjectStore,
  usePostSalesStore,
} from "@/stores";
import { ATTACHMENT_CATEGORY_LABEL, type AttachmentCategory, type CompanyAttachment } from "@/types";
import { downloadAttachmentFile, downloadNoteFile } from "@/lib/download-file";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const MANUAL_PURPOSES: { purpose: string; category: AttachmentCategory }[] = [
  { purpose: "Unit configuration", category: "unit" },
  { purpose: "Customer data", category: "customer" },
  { purpose: "Booking data", category: "booking" },
  { purpose: "Payment data", category: "payment" },
  { purpose: "Agreement / contract", category: "other" },
  { purpose: "Kickoff deck", category: "other" },
  { purpose: "Other document", category: "other" },
];

export function CompanyNotesAttachmentsTab({ companyId }: { companyId: string }) {
  const currentUser = useCurrentUser();
  const allNotes = useNotesAttachmentsStore((s) => s.notes);
  const allAttachments = useNotesAttachmentsStore((s) => s.attachments);
  const addNote = useNotesAttachmentsStore((s) => s.addNote);
  const deleteNote = useNotesAttachmentsStore((s) => s.deleteNote);
  const updateNote = useNotesAttachmentsStore((s) => s.updateNote);
  const addAttachment = useNotesAttachmentsStore((s) => s.addAttachment);
  const deleteAttachment = useNotesAttachmentsStore((s) => s.deleteAttachment);
  const onboardingProjects = useProjectStore((s) => s.projects);
  const postSalesProjects = usePostSalesStore((s) => s.projects);

  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteAttachId, setDeleteAttachId] = useState<string | null>(null);
  const [purposeFilter, setPurposeFilter] = useState<string>("All");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualPurpose, setManualPurpose] = useState(MANUAL_PURPOSES[0].purpose);
  const [manualFileName, setManualFileName] = useState("");

  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => n.companyId === companyId)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [allNotes, companyId],
  );

  const attachments = useMemo(
    () =>
      allAttachments
        .filter((a) => a.companyId === companyId)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [allAttachments, companyId],
  );

  const purposes = useMemo(() => {
    const set = new Set(attachments.map((a) => a.purpose));
    return ["All", ...Array.from(set).sort()];
  }, [attachments]);

  const filteredAttachments =
    purposeFilter === "All"
      ? attachments
      : attachments.filter((a) => a.purpose === purposeFilter);

  function projectLabel(projectId?: string) {
    if (!projectId) return null;
    const onboarding = onboardingProjects.find((p) => p.id === projectId);
    if (onboarding) return onboarding.name;
    const ps = postSalesProjects.find((p) => p.id === projectId);
    if (ps) return `${ps.projectNumber} · ${ps.projectName}`;
    return projectId;
  }

  function handleAddNote() {
    const body = noteBody.trim();
    if (!body) {
      toast.error("Write a note first");
      return;
    }
    addNote({
      companyId,
      body,
      author: currentUser?.name ?? "You",
    });
    setNoteBody("");
    toast.success("Note added");
  }

  function startEditNote(id: string, body: string) {
    setEditingNoteId(id);
    setEditingBody(body);
  }

  function saveEditNote() {
    if (!editingNoteId) return;
    const body = editingBody.trim();
    if (!body) {
      toast.error("Note cannot be empty");
      return;
    }
    updateNote(editingNoteId, { body });
    setEditingNoteId(null);
    setEditingBody("");
    toast.success("Note updated");
  }

  function handleDownload(a: CompanyAttachment) {
    downloadAttachmentFile(a);
    toast.success("Download started", { description: a.fileName });
  }

  function handleManualUpload() {
    const fileName = manualFileName.trim() || `${manualPurpose.toLowerCase().replace(/\s+/g, "_")}.xlsx`;
    const meta = MANUAL_PURPOSES.find((p) => p.purpose === manualPurpose) ?? MANUAL_PURPOSES[0];
    addAttachment({
      companyId,
      fileName,
      purpose: meta.purpose,
      category: meta.category,
      uploadedBy: currentUser?.name ?? "You",
      context: "Manual upload from Notes & Attachments",
      recordCount: 10 + Math.floor(Math.random() * 80),
    });
    setManualFileName("");
    setUploadOpen(false);
    toast.success("Attachment added", { description: meta.purpose });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card-soft flex flex-col p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Notes</h3>
            <p className="text-xs text-muted-foreground">Internal notes about this customer</p>
          </div>
          <Pill>{notes.length}</Pill>
        </div>

        <div className="mb-4 rounded-lg border bg-muted/20 p-3">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a note for the team…"
            className="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleAddNote}>
              <Plus className="h-3.5 w-3.5" /> Add Note
            </Button>
          </div>
        </div>

        {notes.length === 0 ? (
          <EmptyState title="No notes yet" description="Capture kickoff decisions, preferences, and follow-ups here." />
        ) : (
          <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {notes.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  n.pinned ? "border-primary/40 bg-primary/5" : "bg-card hover:bg-muted/30",
                )}
              >
                {editingNoteId === n.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      className="min-h-[72px] w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                      <Button size="sm" onClick={saveEditNote}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Download note"
                          onClick={() => {
                            downloadNoteFile(n);
                            toast.success("Note downloaded");
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Edit"
                          onClick={() => startEditNote(n.id, n.body)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title={n.pinned ? "Unpin" : "Pin"}
                          onClick={() => updateNote(n.id, { pinned: !n.pinned })}
                        >
                          <Pin className={cn("h-3.5 w-3.5", n.pinned && "fill-current text-primary")} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setDeleteNoteId(n.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {n.author} · {formatDateTime(n.createdAt)}
                      {n.projectId && <> · {projectLabel(n.projectId)}</>}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-soft flex flex-col p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Attachments</h3>
            <p className="text-xs text-muted-foreground">
              Every uploaded document with purpose, date & time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill>{attachments.length}</Pill>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setUploadOpen((v) => !v)}>
              <Upload className="h-3.5 w-3.5" /> Add File
            </Button>
          </div>
        </div>

        {uploadOpen && (
          <div className="mb-4 space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
            <label className="block text-xs font-medium">
              Purpose / reason for upload
              <select
                value={manualPurpose}
                onChange={(e) => setManualPurpose(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {MANUAL_PURPOSES.map((p) => (
                  <option key={p.purpose} value={p.purpose}>{p.purpose}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              File name
              <input
                value={manualFileName}
                onChange={(e) => setManualFileName(e.target.value)}
                placeholder="e.g. unit_config_v2.xlsx"
                className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleManualUpload}>Upload</Button>
            </div>
          </div>
        )}

        {purposes.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {purposes.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPurposeFilter(p)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  purposeFilter === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-muted",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {filteredAttachments.length === 0 ? (
          <EmptyState
            title="No attachments yet"
            description="Files from Post Sales, data migration, and manual uploads appear here."
          />
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {filteredAttachments.map((a) => (
              <li
                key={a.id}
                className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
              >
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.fileName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone="accent">{a.purpose}</Pill>
                    <span className="text-[11px] text-muted-foreground">
                      {ATTACHMENT_CATEGORY_LABEL[a.category]}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(a.uploadedAt)} · by {a.uploadedBy}
                    {a.recordCount != null && ` · ${a.recordCount} records`}
                  </div>
                  {a.context && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.context}</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Download"
                    onClick={() => handleDownload(a)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Remove"
                    onClick={() => setDeleteAttachId(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDeleteDialog
        open={!!deleteNoteId}
        onOpenChange={(open) => !open && setDeleteNoteId(null)}
        title="Delete note?"
        description="This note will be removed permanently."
        onConfirm={() => {
          if (deleteNoteId) deleteNote(deleteNoteId);
          setDeleteNoteId(null);
          toast.success("Note deleted");
        }}
      />
      <ConfirmDeleteDialog
        open={!!deleteAttachId}
        onOpenChange={(open) => !open && setDeleteAttachId(null)}
        title="Remove attachment?"
        description="This removes the document from the company register (prototype)."
        onConfirm={() => {
          if (deleteAttachId) deleteAttachment(deleteAttachId);
          setDeleteAttachId(null);
          toast.success("Attachment removed");
        }}
      />
    </div>
  );
}
