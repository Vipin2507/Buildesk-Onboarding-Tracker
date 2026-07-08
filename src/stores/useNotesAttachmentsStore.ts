import type { AttachmentCategory, CompanyAttachment, CompanyNote } from "@/types";
import { newId, nowIso } from "@/types";
import { seedAttachments, seedNotes } from "@/data/seed";
import { createPersistedStore, touch } from "./persist";
import { logActivity } from "./useActivityStore";

type NotesAttachmentsState = {
  notes: CompanyNote[];
  attachments: CompanyAttachment[];

  addNote: (data: {
    companyId: string;
    body: string;
    author: string;
    projectId?: string;
    pinned?: boolean;
  }) => CompanyNote;
  updateNote: (id: string, data: Partial<Pick<CompanyNote, "body" | "pinned">>) => void;
  deleteNote: (id: string) => void;

  addAttachment: (data: {
    companyId: string;
    fileName: string;
    purpose: string;
    category: AttachmentCategory;
    uploadedBy: string;
    projectId?: string;
    context?: string;
    recordCount?: number;
    uploadedAt?: string;
  }) => CompanyAttachment;
  deleteAttachment: (id: string) => void;

  getNotesByCompany: (companyId: string) => CompanyNote[];
  getAttachmentsByCompany: (companyId: string) => CompanyAttachment[];
};

export const useNotesAttachmentsStore = createPersistedStore<NotesAttachmentsState>(
  "notes-attachments-v1",
  (set, get) => ({
    notes: seedNotes,
    attachments: seedAttachments,

    addNote: ({ companyId, body, author, projectId, pinned }) => {
      const now = nowIso();
      const note: CompanyNote = {
        id: newId(),
        companyId,
        body: body.trim(),
        author,
        projectId,
        pinned: pinned ?? false,
        createdAt: now,
        updatedAt: now,
      };
      set((s) => ({ notes: [note, ...s.notes] }));
      logActivity({
        who: author,
        what: `Added note: ${note.body.slice(0, 80)}${note.body.length > 80 ? "…" : ""}`,
        kind: "info",
        companyId,
        projectId,
      });
      return note;
    },

    updateNote: (id, data) => {
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? touch({ ...n, ...data }) : n)),
      }));
    },

    deleteNote: (id) => {
      const note = get().notes.find((n) => n.id === id);
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      if (note) {
        logActivity({
          who: "You",
          what: "Deleted a note",
          kind: "warning",
          companyId: note.companyId,
          projectId: note.projectId,
        });
      }
    },

    addAttachment: ({
      companyId,
      fileName,
      purpose,
      category,
      uploadedBy,
      projectId,
      context,
      recordCount,
      uploadedAt,
    }) => {
      const now = uploadedAt ?? nowIso();
      const attachment: CompanyAttachment = {
        id: newId(),
        companyId,
        fileName,
        purpose,
        category,
        uploadedBy,
        projectId,
        context,
        recordCount,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      set((s) => ({ attachments: [attachment, ...s.attachments] }));
      return attachment;
    },

    deleteAttachment: (id) => {
      const a = get().attachments.find((x) => x.id === id);
      set((s) => ({ attachments: s.attachments.filter((x) => x.id !== id) }));
      if (a) {
        logActivity({
          who: "You",
          what: `Removed attachment ${a.fileName}`,
          kind: "warning",
          companyId: a.companyId,
          projectId: a.projectId,
        });
      }
    },

    getNotesByCompany: (companyId) =>
      get()
        .notes.filter((n) => n.companyId === companyId)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.createdAt.localeCompare(a.createdAt);
        }),

    getAttachmentsByCompany: (companyId) =>
      get()
        .attachments.filter((a) => a.companyId === companyId)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
  }),
);

/** Fire-and-forget helper so upload flows can record docs without importing the hook. */
export function recordAttachment(
  entry: Parameters<NotesAttachmentsState["addAttachment"]>[0],
) {
  return useNotesAttachmentsStore.getState().addAttachment(entry);
}
