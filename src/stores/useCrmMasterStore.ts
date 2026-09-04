import type {
  CrmBookingCallTypeDef,
  CrmBookingHostHoursDef,
  CrmMasterFieldDef,
  CrmMasterModuleDef,
  CrmMasterPicklist,
  CrmMasterPlatformSettings,
  CrmMigrationFieldDef,
  CrmTrainingFieldDef,
} from "@/types/crm-master";
import { newId, nowIso } from "@/types/common";
import {
  CRM_SEED_ACCOUNT_FIELDS,
  CRM_SEED_MODULES,
  CRM_SEED_PICKLISTS,
  CRM_SEED_PLATFORM,
  CRM_SEED_PROJECT_FIELDS,
} from "@/data/crm-master-seed";
import {
  seedCrmMigrationFields,
  seedCrmModuleProviders,
  seedCrmTrainingFields,
  CRM_CORE_MODULES,
  CRM_INTEGRATION_MODULES,
  CRM_PRODUCT_MODULES,
  type CrmTrainingTrack,
} from "@/data/crm-onboarding-defaults";
import {
  normalizeCrmBookingCallTypes,
  normalizeCrmBookingHostHours,
  seedCrmBookingCallTypes,
  seedCrmBookingHostHours,
} from "@/data/crm-booking-defaults";
import { createPersistedStore, touch } from "./persist";

type CrmMasterState = {
  platform: CrmMasterPlatformSettings;
  accountFields: CrmMasterFieldDef[];
  projectFields: CrmMasterFieldDef[];
  picklists: CrmMasterPicklist[];
  modules: CrmMasterModuleDef[];
  /** Integration module key → provider display names (editable in Master). */
  moduleProviders: Record<string, string[]>;
  /** Migration checklist fields shown on CRM accounts (editable in Master). */
  migrationFields: CrmMigrationFieldDef[];
  /** Training catalog for developer accounts (editable in Master). */
  trainingFieldsDeveloper: CrmTrainingFieldDef[];
  /** Training catalog for broker / CP accounts (editable in Master). */
  trainingFieldsBroker: CrmTrainingFieldDef[];
  /** Portal booking call types (duration drives slots). */
  bookingCallTypes: CrmBookingCallTypeDef[];
  /** Default executive weekly hours for booking availability. */
  bookingHostHours: CrmBookingHostHoursDef[];

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
  setMigrationFields: (fields: CrmMigrationFieldDef[]) => void;
  setTrainingFields: (track: CrmTrainingTrack, fields: CrmTrainingFieldDef[]) => void;
  setBookingCallTypes: (fields: CrmBookingCallTypeDef[]) => void;
  setBookingHostHours: (hours: CrmBookingHostHoursDef[]) => void;

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
    migrationFields: seedCrmMigrationFields(),
    trainingFieldsDeveloper: seedCrmTrainingFields("developer"),
    trainingFieldsBroker: seedCrmTrainingFields("broker_cp"),
    bookingCallTypes: seedCrmBookingCallTypes(),
    bookingHostHours: seedCrmBookingHostHours(),
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
    if (Array.isArray(values)) {
      out[key] = values.map((v) => String(v).trim()).filter(Boolean);
    }
  }
  return out;
}

function normalizeMasterModules(
  existing: CrmMasterModuleDef[] | undefined,
): CrmMasterModuleDef[] {
  const byKey = new Map((existing ?? []).map((m) => [m.key, m]));
  const now = nowIso();
  return CRM_PRODUCT_MODULES.map((def, i) => {
    const prev = byKey.get(def.key);
    if (prev) {
      return { ...prev, label: def.label, order: i + 1 };
    }
    return {
      id: newId(),
      key: def.key,
      label: def.label,
      description: `${def.label} product module`,
      enabled: true,
      order: i + 1,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function normalizeCrmMigrationFields(
  existing: CrmMigrationFieldDef[] | undefined,
): CrmMigrationFieldDef[] {
  if (!Array.isArray(existing)) return seedCrmMigrationFields();
  return existing
    .map((f) => ({
      key: String(f.key ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      label: String(f.label ?? "").trim(),
      category: String(f.category ?? "").trim() || "CRM data",
    }))
    .filter((f) => f.key && f.label);
}

function normalizeCrmTrainingFields(
  track: CrmTrainingTrack,
  existing: CrmTrainingFieldDef[] | undefined,
): CrmTrainingFieldDef[] {
  if (!Array.isArray(existing)) return seedCrmTrainingFields(track);
  return existing
    .map((f) => ({
      key: String(f.key ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      label: String(f.label ?? "").trim(),
      category: String(f.category ?? "").trim() || "Custom",
    }))
    .filter((f) => f.key && f.label);
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
        modules: normalizeMasterModules(s.modules).map((m) =>
          m.id === id ? touch({ ...m, ...data }) : m,
        ),
      }));
    },

    setModuleProviders: (moduleKey, providers) => {
      set((s) => ({
        modules: normalizeMasterModules(s.modules),
        moduleProviders: {
          ...normalizeModuleProviders(s.moduleProviders),
          [moduleKey]: providers.map((p) => p.trim()).filter(Boolean),
        },
      }));
      if (typeof window !== "undefined") {
        void import("@/lib/config-persistence").then((m) =>
          m.scheduleCrmMasterConfigPersistence(),
        );
      }
    },

    setMigrationFields: (fields) => {
      set({ migrationFields: normalizeCrmMigrationFields(fields) });
    },

    setTrainingFields: (track, fields) => {
      const normalized = normalizeCrmTrainingFields(track, fields);
      if (track === "broker_cp") {
        set({ trainingFieldsBroker: normalized });
      } else {
        set({ trainingFieldsDeveloper: normalized });
      }
    },

    setBookingCallTypes: (fields) => {
      set({ bookingCallTypes: normalizeCrmBookingCallTypes(fields) });
    },

    setBookingHostHours: (hours) => {
      set({ bookingHostHours: normalizeCrmBookingHostHours(hours) });
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

/** Ensures newly catalogued CRM product modules appear in Master → Modules. */
export function ensureCrmMasterModulesCatalog() {
  const state = useCrmMasterStore.getState();
  const modules = normalizeMasterModules(state.modules);
  const moduleProviders = normalizeModuleProviders(state.moduleProviders);
  if (
    modules.length !== state.modules.length ||
    modules.some((m, i) => m.key !== state.modules[i]?.key) ||
    Object.keys(moduleProviders).length !== Object.keys(state.moduleProviders ?? {}).length
  ) {
    useCrmMasterStore.setState({ modules, moduleProviders });
  }
}

/** Safe read for older persisted snapshots missing migrationFields. */
export function getCrmMasterMigrationFields(): CrmMigrationFieldDef[] {
  return normalizeCrmMigrationFields(useCrmMasterStore.getState().migrationFields);
}

/** Safe read for older persisted snapshots missing training field catalogs. */
export function getCrmMasterTrainingFields(track: CrmTrainingTrack): CrmTrainingFieldDef[] {
  const state = useCrmMasterStore.getState();
  return normalizeCrmTrainingFields(
    track,
    track === "broker_cp" ? state.trainingFieldsBroker : state.trainingFieldsDeveloper,
  );
}

export function getCrmMasterBookingCallTypes(): CrmBookingCallTypeDef[] {
  return normalizeCrmBookingCallTypes(useCrmMasterStore.getState().bookingCallTypes);
}

export function getCrmMasterBookingHostHours(): CrmBookingHostHoursDef[] {
  return normalizeCrmBookingHostHours(useCrmMasterStore.getState().bookingHostHours);
}

/** Core modules are always available; integrations respect Master → Integrations toggles. */
export function getCrmMasterProductModuleCatalog(): { key: string; label: string }[] {
  ensureCrmMasterModulesCatalog();
  const byKey = new Map(
    normalizeMasterModules(useCrmMasterStore.getState().modules).map((m) => [m.key, m]),
  );
  const core = CRM_CORE_MODULES.map((m) => ({ key: m.key, label: m.label }));
  const integrations = CRM_INTEGRATION_MODULES.filter(
    (m) => byKey.get(m.key)?.enabled !== false,
  ).map((m) => ({ key: m.key, label: m.label }));
  return [...core, ...integrations];
}

export function crmMasterSnapshot() {
  const s = useCrmMasterStore.getState();
  return {
    platform: s.platform,
    accountFields: s.accountFields,
    projectFields: s.projectFields,
    picklists: s.picklists,
    modules: s.modules,
    moduleProviders: s.moduleProviders,
    migrationFields: s.migrationFields,
    trainingFieldsDeveloper: s.trainingFieldsDeveloper,
    trainingFieldsBroker: s.trainingFieldsBroker,
    bookingCallTypes: s.bookingCallTypes,
    bookingHostHours: s.bookingHostHours,
  };
}

export function hydrateCrmMasterFromServer(raw: Record<string, unknown>) {
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return;
  useCrmMasterStore.setState((s) => ({
    ...s,
    ...(raw.platform && typeof raw.platform === "object"
      ? { platform: normalizePlatform({ ...s.platform, ...(raw.platform as object) }) }
      : {}),
    ...(Array.isArray(raw.accountFields) ? { accountFields: raw.accountFields as CrmMasterFieldDef[] } : {}),
    ...(Array.isArray(raw.projectFields) ? { projectFields: raw.projectFields as CrmMasterFieldDef[] } : {}),
    ...(Array.isArray(raw.picklists) ? { picklists: raw.picklists as CrmMasterPicklist[] } : {}),
    ...(Array.isArray(raw.modules) ? { modules: normalizeMasterModules(raw.modules as CrmMasterModuleDef[]) } : {}),
    ...(raw.moduleProviders && typeof raw.moduleProviders === "object"
      ? { moduleProviders: normalizeModuleProviders(raw.moduleProviders as Record<string, string[]>) }
      : {}),
    ...(Array.isArray(raw.migrationFields)
      ? { migrationFields: normalizeCrmMigrationFields(raw.migrationFields as CrmMigrationFieldDef[]) }
      : {}),
    ...(Array.isArray(raw.trainingFieldsDeveloper)
      ? {
          trainingFieldsDeveloper: normalizeCrmTrainingFields(
            "developer",
            raw.trainingFieldsDeveloper as CrmTrainingFieldDef[],
          ),
        }
      : {}),
    ...(Array.isArray(raw.trainingFieldsBroker)
      ? {
          trainingFieldsBroker: normalizeCrmTrainingFields(
            "broker_cp",
            raw.trainingFieldsBroker as CrmTrainingFieldDef[],
          ),
        }
      : {}),
    ...(Array.isArray(raw.bookingCallTypes)
      ? { bookingCallTypes: normalizeCrmBookingCallTypes(raw.bookingCallTypes as CrmBookingCallTypeDef[]) }
      : {}),
    ...(Array.isArray(raw.bookingHostHours)
      ? { bookingHostHours: normalizeCrmBookingHostHours(raw.bookingHostHours as CrmBookingHostHoursDef[]) }
      : {}),
  }));
  ensureCrmMasterModulesCatalog();
}
