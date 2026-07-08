import type {
  MasterChecklistItemDef,
  MasterFieldDef,
  MasterIntegrationDef,
  MasterModuleDef,
  MasterPicklist,
  MasterPlatformSettings,
  MasterTemplateDef,
  MasterTriggerDef,
  MasterWorkflowStepDef,
} from "@/types";
import { newId, nowIso } from "@/types";
import {
  SEED_CHECKLIST,
  SEED_COMPANY_FIELDS,
  SEED_INTEGRATIONS,
  SEED_MODULES,
  SEED_PICKLISTS,
  SEED_PLATFORM,
  SEED_PROJECT_FIELDS,
  SEED_TEMPLATES,
  SEED_TRIGGERS,
  SEED_WORKFLOW_STEPS,
} from "@/data/master-seed";
import { createPersistedStore, touch } from "./persist";
import { logActivity } from "./useActivityStore";

type MasterState = {
  platform: MasterPlatformSettings;
  companyFields: MasterFieldDef[];
  projectFields: MasterFieldDef[];
  picklists: MasterPicklist[];
  workflowSteps: MasterWorkflowStepDef[];
  checklistItems: MasterChecklistItemDef[];
  templates: MasterTemplateDef[];
  modules: MasterModuleDef[];
  integrations: MasterIntegrationDef[];
  triggers: MasterTriggerDef[];

  updatePlatform: (data: Partial<MasterPlatformSettings>) => void;

  addCompanyField: (data: Omit<MasterFieldDef, "id" | "createdAt" | "updatedAt">) => void;
  updateCompanyField: (id: string, data: Partial<MasterFieldDef>) => void;
  deleteCompanyField: (id: string) => void;
  reorderCompanyFields: (orderedIds: string[]) => void;

  addProjectField: (data: Omit<MasterFieldDef, "id" | "createdAt" | "updatedAt">) => void;
  updateProjectField: (id: string, data: Partial<MasterFieldDef>) => void;
  deleteProjectField: (id: string) => void;

  addPicklist: (data: Omit<MasterPicklist, "id" | "createdAt" | "updatedAt">) => void;
  updatePicklist: (id: string, data: Partial<MasterPicklist>) => void;
  deletePicklist: (id: string) => void;

  addWorkflowStep: (data: Omit<MasterWorkflowStepDef, "id" | "createdAt" | "updatedAt">) => void;
  updateWorkflowStep: (id: string, data: Partial<MasterWorkflowStepDef>) => void;
  deleteWorkflowStep: (id: string) => void;
  moveWorkflowStep: (id: string, direction: "up" | "down") => void;

  addChecklistItem: (data: Omit<MasterChecklistItemDef, "id" | "createdAt" | "updatedAt">) => void;
  updateChecklistItem: (id: string, data: Partial<MasterChecklistItemDef>) => void;
  deleteChecklistItem: (id: string) => void;

  addTemplate: (data: Omit<MasterTemplateDef, "id" | "createdAt" | "updatedAt">) => void;
  updateTemplate: (id: string, data: Partial<MasterTemplateDef>) => void;
  deleteTemplate: (id: string) => void;

  updateModule: (id: string, data: Partial<MasterModuleDef>) => void;

  addIntegration: (data: Omit<MasterIntegrationDef, "id" | "createdAt" | "updatedAt">) => void;
  updateIntegration: (id: string, data: Partial<MasterIntegrationDef>) => void;
  deleteIntegration: (id: string) => void;

  addTrigger: (data: Omit<MasterTriggerDef, "id" | "createdAt" | "updatedAt">) => void;
  updateTrigger: (id: string, data: Partial<MasterTriggerDef>) => void;
  deleteTrigger: (id: string) => void;

  resetSection: (section: MasterResetSection) => void;
  resetAll: () => void;
};

export type MasterResetSection =
  | "platform"
  | "companyFields"
  | "projectFields"
  | "picklists"
  | "workflowSteps"
  | "checklistItems"
  | "templates"
  | "modules"
  | "integrations"
  | "triggers";

function withId<T extends object>(data: T) {
  const now = nowIso();
  return { ...data, id: newId(), createdAt: now, updatedAt: now };
}

function reorderByIds<T extends { id: string; order: number; updatedAt: string }>(
  items: T[],
  orderedIds: string[],
): T[] {
  const map = new Map(items.map((i) => [i.id, i]));
  const next: T[] = [];
  orderedIds.forEach((id, idx) => {
    const item = map.get(id);
    if (!item) return;
    next.push(touch({ ...item, order: idx + 1 }));
  });
  return next;
}

function moveItem<T extends { id: string; order: number; updatedAt: string }>(
  items: T[],
  id: string,
  direction: "up" | "down",
): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((x) => x.id === id);
  if (idx < 0) return items;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return items;
  const a = sorted[idx];
  const b = sorted[swapWith];
  const orderA = a.order;
  sorted[idx] = touch({ ...a, order: b.order });
  sorted[swapWith] = touch({ ...b, order: orderA });
  return sorted;
}

const INITIAL: Pick<
  MasterState,
  | "platform"
  | "companyFields"
  | "projectFields"
  | "picklists"
  | "workflowSteps"
  | "checklistItems"
  | "templates"
  | "modules"
  | "integrations"
  | "triggers"
> = {
  platform: SEED_PLATFORM,
  companyFields: SEED_COMPANY_FIELDS,
  projectFields: SEED_PROJECT_FIELDS,
  picklists: SEED_PICKLISTS,
  workflowSteps: SEED_WORKFLOW_STEPS,
  checklistItems: SEED_CHECKLIST,
  templates: SEED_TEMPLATES,
  modules: SEED_MODULES,
  integrations: SEED_INTEGRATIONS,
  triggers: SEED_TRIGGERS,
};

export const useMasterStore = createPersistedStore<MasterState>("master-config-v1", (set, get) => ({
  ...INITIAL,

  updatePlatform: (data) => {
    set((s) => ({ platform: { ...s.platform, ...data } }));
    logActivity({ who: "You", what: "Updated master platform settings", kind: "info" });
  },

  addCompanyField: (data) => {
    set((s) => ({ companyFields: [...s.companyFields, withId(data)] }));
    logActivity({ who: "You", what: `Added company field ${data.label}`, kind: "success" });
  },
  updateCompanyField: (id, data) => {
    set((s) => ({
      companyFields: s.companyFields.map((f) => (f.id === id ? touch({ ...f, ...data }) : f)),
    }));
  },
  deleteCompanyField: (id) => {
    const f = get().companyFields.find((x) => x.id === id);
    set((s) => ({ companyFields: s.companyFields.filter((x) => x.id !== id) }));
    if (f) logActivity({ who: "You", what: `Deleted company field ${f.label}`, kind: "warning" });
  },
  reorderCompanyFields: (orderedIds) => {
    set((s) => ({ companyFields: reorderByIds(s.companyFields, orderedIds) }));
  },

  addProjectField: (data) => {
    set((s) => ({ projectFields: [...s.projectFields, withId(data)] }));
    logActivity({ who: "You", what: `Added project field ${data.label}`, kind: "success" });
  },
  updateProjectField: (id, data) => {
    set((s) => ({
      projectFields: s.projectFields.map((f) => (f.id === id ? touch({ ...f, ...data }) : f)),
    }));
  },
  deleteProjectField: (id) => {
    const f = get().projectFields.find((x) => x.id === id);
    set((s) => ({ projectFields: s.projectFields.filter((x) => x.id !== id) }));
    if (f) logActivity({ who: "You", what: `Deleted project field ${f.label}`, kind: "warning" });
  },

  addPicklist: (data) => {
    set((s) => ({ picklists: [...s.picklists, withId(data)] }));
    logActivity({ who: "You", what: `Added picklist ${data.label}`, kind: "success" });
  },
  updatePicklist: (id, data) => {
    set((s) => ({
      picklists: s.picklists.map((p) => (p.id === id ? touch({ ...p, ...data }) : p)),
    }));
  },
  deletePicklist: (id) => {
    const p = get().picklists.find((x) => x.id === id);
    set((s) => ({ picklists: s.picklists.filter((x) => x.id !== id) }));
    if (p) logActivity({ who: "You", what: `Deleted picklist ${p.label}`, kind: "warning" });
  },

  addWorkflowStep: (data) => {
    set((s) => ({ workflowSteps: [...s.workflowSteps, withId(data)] }));
    logActivity({ who: "You", what: `Added workflow step ${data.label}`, kind: "success" });
  },
  updateWorkflowStep: (id, data) => {
    set((s) => ({
      workflowSteps: s.workflowSteps.map((w) => (w.id === id ? touch({ ...w, ...data }) : w)),
    }));
  },
  deleteWorkflowStep: (id) => {
    const w = get().workflowSteps.find((x) => x.id === id);
    set((s) => ({ workflowSteps: s.workflowSteps.filter((x) => x.id !== id) }));
    if (w) logActivity({ who: "You", what: `Deleted workflow step ${w.label}`, kind: "warning" });
  },
  moveWorkflowStep: (id, direction) => {
    set((s) => ({ workflowSteps: moveItem(s.workflowSteps, id, direction) }));
  },

  addChecklistItem: (data) => {
    set((s) => ({ checklistItems: [...s.checklistItems, withId(data)] }));
  },
  updateChecklistItem: (id, data) => {
    set((s) => ({
      checklistItems: s.checklistItems.map((c) => (c.id === id ? touch({ ...c, ...data }) : c)),
    }));
  },
  deleteChecklistItem: (id) => {
    set((s) => ({ checklistItems: s.checklistItems.filter((c) => c.id !== id) }));
  },

  addTemplate: (data) => {
    set((s) => ({ templates: [...s.templates, withId(data)] }));
    logActivity({ who: "You", what: `Added template ${data.name}`, kind: "success" });
  },
  updateTemplate: (id, data) => {
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)),
    }));
  },
  deleteTemplate: (id) => {
    const t = get().templates.find((x) => x.id === id);
    set((s) => ({ templates: s.templates.filter((x) => x.id !== id) }));
    if (t) logActivity({ who: "You", what: `Deleted template ${t.name}`, kind: "warning" });
  },

  updateModule: (id, data) => {
    set((s) => ({
      modules: s.modules.map((m) => (m.id === id ? touch({ ...m, ...data }) : m)),
    }));
  },

  addIntegration: (data) => {
    set((s) => ({ integrations: [...s.integrations, withId(data)] }));
  },
  updateIntegration: (id, data) => {
    set((s) => ({
      integrations: s.integrations.map((i) => (i.id === id ? touch({ ...i, ...data }) : i)),
    }));
  },
  deleteIntegration: (id) => {
    set((s) => ({ integrations: s.integrations.filter((i) => i.id !== id) }));
  },

  addTrigger: (data) => {
    set((s) => ({ triggers: [...s.triggers, withId(data)] }));
  },
  updateTrigger: (id, data) => {
    set((s) => ({
      triggers: s.triggers.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)),
    }));
  },
  deleteTrigger: (id) => {
    set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) }));
  },

  resetSection: (section) => {
    const map: Record<MasterResetSection, Partial<typeof INITIAL>> = {
      platform: { platform: SEED_PLATFORM },
      companyFields: { companyFields: SEED_COMPANY_FIELDS },
      projectFields: { projectFields: SEED_PROJECT_FIELDS },
      picklists: { picklists: SEED_PICKLISTS },
      workflowSteps: { workflowSteps: SEED_WORKFLOW_STEPS },
      checklistItems: { checklistItems: SEED_CHECKLIST },
      templates: { templates: SEED_TEMPLATES },
      modules: { modules: SEED_MODULES },
      integrations: { integrations: SEED_INTEGRATIONS },
      triggers: { triggers: SEED_TRIGGERS },
    };
    set(map[section]);
    logActivity({ who: "You", what: `Reset master section: ${section}`, kind: "warning" });
  },

  resetAll: () => {
    set({ ...INITIAL });
    logActivity({ who: "You", what: "Reset all master configuration to defaults", kind: "warning" });
  },
}));

/** Enabled Post Sales step defs for new projects (Master-driven). */
export function getEnabledWorkflowStepDefs() {
  return [...useMasterStore.getState().workflowSteps]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
}

export function getPicklistValues(key: string): string[] {
  return useMasterStore.getState().picklists.find((p) => p.key === key)?.values ?? [];
}
