import type { DocumentTemplate, DocumentStatus } from "@/types";
import { newId, nowIso } from "@/types";
import { logActivity } from "./useActivityStore";
import { recordAttachment } from "./useNotesAttachmentsStore";
import { createStore, touch } from "./persist";
import { useProjectStore } from "./useProjectStore";
import { mutateDocument } from "@/lib/api";
import { serverSync } from "@/lib/sync";

const STATUS_ORDER: DocumentStatus[] = ["Draft", "Approved", "Uploaded", "Tested", "Live"];

type DocumentState = {
  templates: DocumentTemplate[];
  addTemplate: (data: Omit<DocumentTemplate, "id" | "createdAt" | "updatedAt">) => void;
  updateTemplate: (id: string, data: Partial<DocumentTemplate>) => void;
  deleteTemplate: (id: string) => void;
  advanceStatus: (id: string) => void;
  uploadTemplate: (id: string, fileName: string) => void;
};

export const useDocumentStore = createStore<DocumentState>((set, get) => ({
  templates: [],

  addTemplate: (data) => {
    const t: DocumentTemplate = { ...data, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
    set((s) => ({ templates: [...s.templates, t] }));
    logActivity({ who: "You", what: `Added template ${t.name}`, kind: "success", projectId: data.projectId });
    serverSync("createDoc", () =>
      mutateDocument({ data: { action: "create", id: t.id, values: { ...data } } }),
    );
  },

  updateTemplate: (id, data) => {
    set((s) => ({ templates: s.templates.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)) }));
    serverSync("updateDoc", () => mutateDocument({ data: { action: "update", id, values: data } }));
  },

  deleteTemplate: (id) => {
    const t = get().templates.find((x) => x.id === id);
    set((s) => ({ templates: s.templates.filter((x) => x.id !== id) }));
    if (t) {
      logActivity({ who: "You", what: `Deleted template ${t.name}`, kind: "warning" });
      serverSync("deleteDoc", () => mutateDocument({ data: { action: "delete", id } }));
    }
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
    serverSync("advanceDoc", () =>
      mutateDocument({ data: { action: "update", id, values: { status: next } } }),
    );
  },

  uploadTemplate: (id, fileName) => {
    const t = get().templates.find((x) => x.id === id);
    set((s) => ({
      templates: s.templates.map((x) =>
        x.id === id ? touch({ ...x, fileName, status: "Uploaded" as const }) : x,
      ),
    }));
    logActivity({ who: "You", what: `Uploaded ${fileName}`, kind: "success", projectId: t?.projectId });
    serverSync("uploadDoc", () =>
      mutateDocument({ data: { action: "update", id, values: { fileName, status: "Uploaded" } } }),
    );
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
