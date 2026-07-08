import type { DocumentTemplate, DocumentStatus } from "@/types";
import { newId, nowIso } from "@/types";
import { seedDocuments } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { recordAttachment } from "./useNotesAttachmentsStore";
import { createPersistedStore, touch } from "./persist";
import { useProjectStore } from "./useProjectStore";

const STATUS_ORDER: DocumentStatus[] = ["Draft", "Approved", "Uploaded", "Tested", "Live"];

type DocumentState = {
  templates: DocumentTemplate[];
  addTemplate: (data: Omit<DocumentTemplate, "id" | "createdAt" | "updatedAt">) => void;
  updateTemplate: (id: string, data: Partial<DocumentTemplate>) => void;
  deleteTemplate: (id: string) => void;
  advanceStatus: (id: string) => void;
  uploadTemplate: (id: string, fileName: string) => void;
};

export const useDocumentStore = createPersistedStore<DocumentState>("documents", (set, get) => ({
  templates: seedDocuments,

  addTemplate: (data) => {
    const t: DocumentTemplate = { ...data, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
    set((s) => ({ templates: [...s.templates, t] }));
    logActivity({ who: "You", what: `Added template ${t.name}`, kind: "success", projectId: data.projectId });
  },

  updateTemplate: (id, data) => {
    set((s) => ({ templates: s.templates.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)) }));
  },

  deleteTemplate: (id) => {
    const t = get().templates.find((x) => x.id === id);
    set((s) => ({ templates: s.templates.filter((x) => x.id !== id) }));
    if (t) logActivity({ who: "You", what: `Deleted template ${t.name}`, kind: "warning" });
  },

  advanceStatus: (id) => {
    const t = get().templates.find((x) => x.id === id);
    if (!t) return;
    const idx = STATUS_ORDER.indexOf(t.status);
    const next = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
    set((s) => ({
      templates: s.templates.map((x) => (x.id === id ? touch({ ...x, status: next }) : x)),
    }));
    logActivity({ who: "You", what: `${t.name} advanced to ${next}`, kind: "info", projectId: t.projectId });
  },

  uploadTemplate: (id, fileName) => {
    const t = get().templates.find((x) => x.id === id);
    set((s) => ({
      templates: s.templates.map((x) =>
        x.id === id ? touch({ ...x, fileName, status: "Uploaded" as const }) : x,
      ),
    }));
    logActivity({ who: "You", what: `Uploaded ${fileName}`, kind: "success", projectId: t?.projectId });
    if (t?.projectId) {
      const project = useProjectStore.getState().projects.find((p) => p.id === t.projectId);
      if (project) {
        recordAttachment({
          companyId: project.companyId,
          projectId: t.projectId,
          fileName,
          purpose: t.name,
          category: "document-template",
          context: `Documents · ${project.name}`,
          uploadedBy: "You",
        });
      }
    }
  },
}));
