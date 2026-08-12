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
import { seedCrmModuleProviders } from "@/data/crm-onboarding-defaults";
import { createPersistedStore, touch } from "./persist";

type CrmMasterState = {
  platform: CrmMasterPlatformSettings;
  accountFields: CrmMasterFieldDef[];
  projectFields: CrmMasterFieldDef[];
  picklists: CrmMasterPicklist[];
  modules: CrmMasterModuleDef[];
  /** Integration module key → provider display names (editable in Master). */
  moduleProviders: Record<string, string[]>;

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
  setModuleProviders: (moduleKey: string, providers: string[]) => void;

  resetAll: () => void;
};

function seedState() {
  return {
    platform: { ...CRM_SEED_PLATFORM },
    accountFields: CRM_SEED_ACCOUNT_FIELDS.map((f) => ({ ...f })),
    projectFields: CRM_SEED_PROJECT_FIELDS.map((f) => ({ ...f })),
    picklists: CRM_SEED_PICKLISTS.map((p) => ({ ...p, values: [...p.values] })),
    modules: CRM_SEED_MODULES.map((m) => ({ ...m })),
    moduleProviders: seedCrmModuleProviders(),
  };
}

function normalizePlatform(platform: CrmMasterPlatformSettings): CrmMasterPlatformSettings {
  return {
    ...CRM_SEED_PLATFORM,
    ...platform,
    supportPhone: platform.supportPhone ?? CRM_SEED_PLATFORM.supportPhone,
    locale: platform.locale ?? CRM_SEED_PLATFORM.locale,
    brandPrimary: platform.brandPrimary ?? CRM_SEED_PLATFORM.brandPrimary,
    registeredAddress: platform.registeredAddress ?? CRM_SEED_PLATFORM.registeredAddress,
  };
}

function normalizeModuleProviders(
  existing: Record<string, string[]> | undefined,
): Record<string, string[]> {
  const seed = seedCrmModuleProviders();
  if (!existing || typeof existing !== "object") return seed;
  const out: Record<string, string[]> = { ...seed };
  for (const [key, values] of Object.entries(existing)) {
    if (Array.isArray(values) && values.length > 0) {
      out[key] = values.map((v) => String(v).trim()).filter(Boolean);
    }
  }
  return out;
}

export const useCrmMasterStore = createPersistedStore<CrmMasterState>(
  "crm-master-config-v1",
  (set) => ({
    ...seedState(),

    updatePlatform: (data) => {
      set((s) => ({ platform: normalizePlatform({ ...s.platform, ...data }) }));
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

    setModuleProviders: (moduleKey, providers) => {
      set((s) => ({
        moduleProviders: {
          ...normalizeModuleProviders(s.moduleProviders),
          [moduleKey]: providers.map((p) => p.trim()).filter(Boolean),
        },
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

/** Safe read for older persisted snapshots missing moduleProviders. */
export function getCrmMasterModuleProviders(): Record<string, string[]> {
  return normalizeModuleProviders(useCrmMasterStore.getState().moduleProviders);
}
