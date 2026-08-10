import type {
  CrmMasterFieldDef,
  CrmMasterModuleDef,
  CrmMasterPicklist,
  CrmMasterPlatformSettings,
} from "@/types/crm-master";
import { newId, nowIso } from "@/types/common";
import {
  CRM_SEED_ACCOUNT_FIELDS,
  CRM_SEED_MODULES,
  CRM_SEED_PICKLISTS,
  CRM_SEED_PLATFORM,
  CRM_SEED_PROJECT_FIELDS,
} from "@/data/crm-master-seed";
import { createPersistedStore, touch } from "./persist";

type CrmMasterState = {
  platform: CrmMasterPlatformSettings;
  accountFields: CrmMasterFieldDef[];
  projectFields: CrmMasterFieldDef[];
  picklists: CrmMasterPicklist[];
  modules: CrmMasterModuleDef[];

  updatePlatform: (data: Partial<CrmMasterPlatformSettings>) => void;

  addAccountField: (data: Omit<CrmMasterFieldDef, "id" | "createdAt" | "updatedAt">) => void;
  updateAccountField: (id: string, data: Partial<CrmMasterFieldDef>) => void;
  deleteAccountField: (id: string) => void;

  addProjectField: (data: Omit<CrmMasterFieldDef, "id" | "createdAt" | "updatedAt">) => void;
  updateProjectField: (id: string, data: Partial<CrmMasterFieldDef>) => void;
  deleteProjectField: (id: string) => void;

  addPicklist: (data: Omit<CrmMasterPicklist, "id" | "createdAt" | "updatedAt">) => void;
  updatePicklist: (id: string, data: Partial<CrmMasterPicklist>) => void;
  deletePicklist: (id: string) => void;

  updateModule: (id: string, data: Partial<CrmMasterModuleDef>) => void;

  resetAll: () => void;
};

function seedState() {
  return {
    platform: { ...CRM_SEED_PLATFORM },
    accountFields: CRM_SEED_ACCOUNT_FIELDS.map((f) => ({ ...f })),
    projectFields: CRM_SEED_PROJECT_FIELDS.map((f) => ({ ...f })),
    picklists: CRM_SEED_PICKLISTS.map((p) => ({ ...p, values: [...p.values] })),
    modules: CRM_SEED_MODULES.map((m) => ({ ...m })),
  };
}

export const useCrmMasterStore = createPersistedStore<CrmMasterState>(
  "crm-master-config-v1",
  (set) => ({
    ...seedState(),

    updatePlatform: (data) => {
      set((s) => ({ platform: { ...s.platform, ...data } }));
    },

    addAccountField: (data) => {
      const now = nowIso();
      const field: CrmMasterFieldDef = { ...data, id: newId(), createdAt: now, updatedAt: now };
      set((s) => ({ accountFields: [...s.accountFields, field] }));
    },
    updateAccountField: (id, data) => {
      set((s) => ({
        accountFields: s.accountFields.map((f) => (f.id === id ? touch({ ...f, ...data }) : f)),
      }));
    },
    deleteAccountField: (id) => {
      set((s) => ({ accountFields: s.accountFields.filter((f) => f.id !== id) }));
    },

    addProjectField: (data) => {
      const now = nowIso();
      const field: CrmMasterFieldDef = { ...data, id: newId(), createdAt: now, updatedAt: now };
      set((s) => ({ projectFields: [...s.projectFields, field] }));
    },
    updateProjectField: (id, data) => {
      set((s) => ({
        projectFields: s.projectFields.map((f) => (f.id === id ? touch({ ...f, ...data }) : f)),
      }));
    },
    deleteProjectField: (id) => {
      set((s) => ({ projectFields: s.projectFields.filter((f) => f.id !== id) }));
    },

    addPicklist: (data) => {
      const now = nowIso();
      const picklist: CrmMasterPicklist = { ...data, id: newId(), createdAt: now, updatedAt: now };
      set((s) => ({ picklists: [...s.picklists, picklist] }));
    },
    updatePicklist: (id, data) => {
      set((s) => ({
        picklists: s.picklists.map((p) => (p.id === id ? touch({ ...p, ...data }) : p)),
      }));
    },
    deletePicklist: (id) => {
      set((s) => ({ picklists: s.picklists.filter((p) => p.id !== id) }));
    },

    updateModule: (id, data) => {
      set((s) => ({
        modules: s.modules.map((m) => (m.id === id ? touch({ ...m, ...data }) : m)),
      }));
    },

    resetAll: () => {
      set(seedState());
    },
  }),
);

export function getCrmPicklistValues(key: string): string[] {
  return useCrmMasterStore.getState().picklists.find((p) => p.key === key)?.values ?? [];
}
