import type {
  CrmBookingCallTypeDef,
  CrmBookingHostHoursDef,
  CrmImplementationStageDef,
  CrmMasterFieldDef,
  CrmMasterModuleDef,
  CrmMasterModuleKind,
  CrmMasterModuleWorkflowStepDef,
  CrmMasterPicklist,
  CrmMasterPlatformSettings,
  CrmMigrationFieldDef,
  CrmOnboardingTargetSettings,
  CrmTicketReplyTemplateDef,
  CrmTrainingFieldDef,
  CrmWhatsappTemplateDef,
} from "@/types/crm-master";
import {
  normalizeCrmOnboardingTargetSettings,
  seedCrmOnboardingTargetSettings,
} from "@/data/crm-onboarding-targets-seed";
import type { AcademyTutorial } from "@/types/buildesk-academy";
import { newId, nowIso } from "@/types/common";
import {
  CRM_SEED_ACCOUNT_FIELDS,
  CRM_SEED_MODULES,
  CRM_SEED_PICKLISTS,
  CRM_SEED_PLATFORM,
  CRM_SEED_PROJECT_FIELDS,
} from "@/data/crm-master-seed";
import {
  normalizeCrmImplementationStage,
  normalizeCrmImplementationStages,
  seedCrmImplementationStages,
} from "@/lib/crm-implementation-stages";
import {
  CRM_INTEGRATION_MODULES,
  CRM_PRODUCT_MODULES,
  registerCrmMasterModuleLookup,
  seedCrmMigrationFields,
  seedCrmModuleProviders,
  seedCrmTrainingFields,
  seedWorkflowStepsForModuleKey,
  type CrmTrainingTrack,
} from "@/data/crm-onboarding-defaults";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";
import {
  normalizeCrmBookingCallTypes,
  normalizeCrmBookingHostHours,
  seedCrmBookingCallTypes,
  seedCrmBookingHostHours,
} from "@/data/crm-booking-defaults";
import { mergeAcademySeedTranscripts, normalizeAcademyTutorials, seedAcademyTutorials } from "@/lib/academy-catalog";
import {
  normalizeCrmWhatsappTemplates,
  seedCrmWhatsappTemplates,
} from "@/lib/crm-whatsapp-templates";
import {
  normalizeCrmTicketReplyTemplates,
  seedCrmTicketReplyTemplates,
} from "@/lib/crm-ticket-reply-templates";
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
  /** Account implementation pipeline stages (editable in Master). */
  implementationStages: CrmImplementationStageDef[];
  /** Buildesk Academy tutorials shown in the client portal (editable in Master). */
  academyTutorials: AcademyTutorial[];
  /** WhatsApp chat templates for account group composer (editable in Master). */
  whatsappTemplates: CrmWhatsappTemplateDef[];
  /** Design / support ticket reply templates for conversation composer (editable in Master). */
  ticketReplyTemplates: CrmTicketReplyTemplateDef[];
  /** 45-day onboarding SLA buckets (synced to Automation → Onboarding SLA). */
  onboardingTargets: CrmOnboardingTargetSettings;

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

  addModule: (
    data: Omit<CrmMasterModuleDef, "id" | "createdAt" | "updatedAt" | "builtIn" | "order"> & {
      order?: number;
    },
  ) => void;
  updateModule: (id: string, data: Partial<CrmMasterModuleDef>) => void;
  deleteModule: (id: string) => void;
  reorderModule: (id: string, direction: "up" | "down") => void;
  setModuleProviders: (moduleKey: string, providers: string[]) => void;
  setMigrationFields: (fields: CrmMigrationFieldDef[]) => void;
  setTrainingFields: (track: CrmTrainingTrack, fields: CrmTrainingFieldDef[]) => void;
  setBookingCallTypes: (fields: CrmBookingCallTypeDef[]) => void;
  setBookingHostHours: (hours: CrmBookingHostHoursDef[]) => void;
  setImplementationStages: (stages: CrmImplementationStageDef[]) => void;
  setAcademyTutorials: (tutorials: AcademyTutorial[]) => void;
  setWhatsappTemplates: (templates: CrmWhatsappTemplateDef[]) => void;
  setTicketReplyTemplates: (templates: CrmTicketReplyTemplateDef[]) => void;
  setOnboardingTargets: (settings: CrmOnboardingTargetSettings) => void;

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
    implementationStages: seedCrmImplementationStages(),
    academyTutorials: seedAcademyTutorials(),
    whatsappTemplates: seedCrmWhatsappTemplates(),
    ticketReplyTemplates: seedCrmTicketReplyTemplates(),
    onboardingTargets: seedCrmOnboardingTargetSettings(),
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

const BUILT_IN_MODULE_KEYS = new Set(CRM_PRODUCT_MODULES.map((m) => m.key));
const BUILT_IN_INTEGRATION_KEYS = new Set(CRM_INTEGRATION_MODULES.map((m) => m.key));

function defaultKindForKey(key: string): CrmMasterModuleKind {
  const seed = CRM_SEED_MODULES.find((m) => m.key === key);
  if (seed) return seed.kind;
  if (BUILT_IN_INTEGRATION_KEYS.has(key as CrmProductModuleKey)) return "integration";
  if (key.endsWith("-integration")) return "integration";
  return "core";
}

function normalizeWorkflowSteps(
  steps: CrmMasterModuleWorkflowStepDef[] | undefined,
  fallbackKey?: string,
): CrmMasterModuleWorkflowStepDef[] {
  if (Array.isArray(steps) && steps.length > 0) {
    return steps
      .map((s) => ({
        key: String(s.key ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, ""),
        label: String(s.label ?? "").trim(),
        kind: s.kind ?? "date",
      }))
      .filter((s) => s.key && s.label);
  }
  if (fallbackKey) return seedWorkflowStepsForModuleKey(fallbackKey as CrmProductModuleKey);
  return [
    { key: "requirement", label: "Requirement gathering", kind: "date" },
    { key: "configuration", label: "Configuration", kind: "date" },
    { key: "uat", label: "UAT / Testing", kind: "date" },
    { key: "go_live", label: "Go-Live", kind: "date" },
    { key: "remarks", label: "Remarks", kind: "remarks" },
  ];
}

function slugifyModuleKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Merge built-in catalog with Master-custom modules; preserve labels, kind, workflow, enabled. */
function normalizeMasterModules(
  existing: CrmMasterModuleDef[] | undefined,
): CrmMasterModuleDef[] {
  const byKey = new Map((existing ?? []).map((m) => [m.key, m]));
  const now = nowIso();
  const builtIns: CrmMasterModuleDef[] = CRM_PRODUCT_MODULES.map((def, i) => {
    const prev = byKey.get(def.key);
    const kind = prev?.kind ?? defaultKindForKey(def.key);
    if (prev) {
      return {
        ...prev,
        key: def.key,
        label: String(prev.label ?? def.label).trim() || def.label,
        description:
          String(prev.description ?? "").trim() || `${def.label} product module`,
        enabled: prev.enabled !== false,
        order: typeof prev.order === "number" ? prev.order : i + 1,
        kind,
        builtIn: true,
        workflowSteps: normalizeWorkflowSteps(prev.workflowSteps, def.key),
      };
    }
    return {
      id: newId(),
      key: def.key,
      label: def.label,
      description: `${def.label} product module`,
      enabled: true,
      order: i + 1,
      kind: defaultKindForKey(def.key),
      builtIn: true,
      workflowSteps: normalizeWorkflowSteps(undefined, def.key),
      createdAt: now,
      updatedAt: now,
    };
  });

  const custom: CrmMasterModuleDef[] = (existing ?? [])
    .filter((m) => m.key && !BUILT_IN_MODULE_KEYS.has(m.key as CrmProductModuleKey))
    .map((prev, i): CrmMasterModuleDef => {
      const kind: CrmMasterModuleKind =
        prev.kind === "integration" ? "integration" : "core";
      return {
        id: prev.id || newId(),
        key: slugifyModuleKey(prev.key),
        label: String(prev.label ?? "").trim() || prev.key,
        description: String(prev.description ?? "").trim() || "Custom module",
        enabled: prev.enabled !== false,
        order: typeof prev.order === "number" ? prev.order : builtIns.length + i + 1,
        kind,
        builtIn: false,
        workflowSteps: normalizeWorkflowSteps(prev.workflowSteps),
        createdAt: prev.createdAt ?? now,
        updatedAt: prev.updatedAt ?? now,
      };
    })
    .filter((m) => m.key && m.label);

  return [...builtIns, ...custom].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
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

    addModule: (data) => {
      const now = nowIso();
      const key = slugifyModuleKey(data.key);
      if (!key || !data.label.trim()) return;
      set((s) => {
        const modules = normalizeMasterModules(s.modules);
        if (modules.some((m) => m.key === key)) return s;
        const maxOrder = modules.reduce((n, m) => Math.max(n, m.order), 0);
        const next: CrmMasterModuleDef = {
          id: newId(),
          key,
          label: data.label.trim(),
          description: (data.description ?? "").trim() || `${data.label.trim()} product module`,
          enabled: data.enabled !== false,
          order: data.order ?? maxOrder + 1,
          kind: data.kind === "integration" ? "integration" : "core",
          builtIn: false,
          workflowSteps: normalizeWorkflowSteps(data.workflowSteps),
          createdAt: now,
          updatedAt: now,
        };
        return { modules: [...modules, next] };
      });
    },

    updateModule: (id, data) => {
      set((s) => ({
        modules: normalizeMasterModules(s.modules).map((m) => {
          if (m.id !== id) return m;
          const patch: Partial<CrmMasterModuleDef> = { ...data };
          // Built-in keys are stable; custom keys may be renamed carefully.
          if (m.builtIn) {
            delete patch.key;
            delete patch.builtIn;
          } else if (typeof patch.key === "string") {
            patch.key = slugifyModuleKey(patch.key);
          }
          if (patch.workflowSteps) {
            patch.workflowSteps = normalizeWorkflowSteps(patch.workflowSteps);
          }
          if (patch.kind && patch.kind !== "core" && patch.kind !== "integration") {
            delete patch.kind;
          }
          return touch({ ...m, ...patch });
        }),
      }));
    },

    deleteModule: (id) => {
      set((s) => {
        const modules = normalizeMasterModules(s.modules);
        const target = modules.find((m) => m.id === id);
        if (!target || target.builtIn) return s;
        return { modules: modules.filter((m) => m.id !== id) };
      });
    },

    reorderModule: (id, direction) => {
      set((s) => {
        const modules = normalizeMasterModules(s.modules).slice().sort((a, b) => a.order - b.order);
        const index = modules.findIndex((m) => m.id === id);
        if (index < 0) return s;
        const swapWith = direction === "up" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= modules.length) return s;
        const a = modules[index]!;
        const b = modules[swapWith]!;
        const orderA = a.order;
        modules[index] = touch({ ...a, order: b.order });
        modules[swapWith] = touch({ ...b, order: orderA });
        return { modules };
      });
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

    setImplementationStages: (stages) => {
      set({ implementationStages: normalizeCrmImplementationStages(stages) });
    },

    setAcademyTutorials: (tutorials) => {
      set({ academyTutorials: normalizeAcademyTutorials(tutorials) });
    },

    setWhatsappTemplates: (templates) => {
      set({ whatsappTemplates: normalizeCrmWhatsappTemplates(templates) });
    },

    setTicketReplyTemplates: (templates) => {
      set({ ticketReplyTemplates: normalizeCrmTicketReplyTemplates(templates) });
      if (typeof window !== "undefined") {
        void import("@/lib/config-persistence").then((m) =>
          m.scheduleCrmMasterConfigPersistence(),
        );
      }
    },

    setOnboardingTargets: (settings) => {
      set({ onboardingTargets: normalizeCrmOnboardingTargetSettings(settings) });
      if (typeof window !== "undefined") {
        void import("@/lib/config-persistence").then((m) =>
          m.scheduleCrmMasterConfigPersistence(),
        );
      }
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
  const needsModules =
    modules.length !== state.modules.length ||
    modules.some((m, i) => {
      const prev = state.modules[i];
      return (
        !prev ||
        m.key !== prev.key ||
        m.kind !== prev.kind ||
        m.builtIn !== prev.builtIn ||
        !Array.isArray(prev.workflowSteps)
      );
    });
  const needsProviders =
    Object.keys(moduleProviders).length !== Object.keys(state.moduleProviders ?? {}).length;
  if (needsModules || needsProviders) {
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

export function getCrmMasterAcademyTutorials(): AcademyTutorial[] {
  const state = useCrmMasterStore.getState();
  const current = state.academyTutorials;
  const seed = seedAcademyTutorials();
  // Migrate older demo seeds to the production Buildesk Academy catalog once.
  const hasCurrentCatalog =
    Array.isArray(current) &&
    current.some((t) => String(t.youtubeUrl ?? "").includes("pxn5pte7PIU"));
  if (!Array.isArray(current) || current.length === 0 || !hasCurrentCatalog) {
    useCrmMasterStore.setState({ academyTutorials: seed });
    return seed;
  }
  const normalized = normalizeAcademyTutorials(current);
  const { tutorials, changed } = mergeAcademySeedTranscripts(normalized);
  if (changed) {
    useCrmMasterStore.setState({ academyTutorials: tutorials });
  }
  return tutorials;
}

/** WhatsApp templates for Master + account chat picker (seeds when missing/empty). */
export function getCrmMasterWhatsappTemplates(): CrmWhatsappTemplateDef[] {
  const current = useCrmMasterStore.getState().whatsappTemplates;
  if (!Array.isArray(current) || current.length === 0) {
    const seed = seedCrmWhatsappTemplates();
    useCrmMasterStore.setState({ whatsappTemplates: seed });
    return seed;
  }
  return normalizeCrmWhatsappTemplates(current);
}

export function listActiveCrmWhatsappTemplates(): CrmWhatsappTemplateDef[] {
  return getCrmMasterWhatsappTemplates().filter((t) => t.active);
}

/** Ticket reply templates for Master + design ticket conversation picker. */
export function getCrmMasterTicketReplyTemplates(): CrmTicketReplyTemplateDef[] {
  const current = useCrmMasterStore.getState().ticketReplyTemplates;
  if (!Array.isArray(current) || current.length === 0) {
    const seed = seedCrmTicketReplyTemplates();
    useCrmMasterStore.setState({ ticketReplyTemplates: seed });
    return seed;
  }
  return normalizeCrmTicketReplyTemplates(current);
}

export function listActiveCrmTicketReplyTemplates(): CrmTicketReplyTemplateDef[] {
  return getCrmMasterTicketReplyTemplates().filter((t) => t.active);
}

/** Onboarding SLA targets (Master + Automation rules page). Seeds when missing. */
export function getCrmMasterOnboardingTargets(): CrmOnboardingTargetSettings {
  const current = useCrmMasterStore.getState().onboardingTargets;
  if (!current || !Array.isArray(current.buckets) || current.buckets.length === 0) {
    const seed = seedCrmOnboardingTargetSettings();
    useCrmMasterStore.setState({ onboardingTargets: seed });
    return seed;
  }
  return normalizeCrmOnboardingTargetSettings(current);
}

/** Enabled modules from Master catalog (labels + order from Master → Modules). */
export function getCrmMasterProductModuleCatalog(): { key: string; label: string }[] {
  ensureCrmMasterModulesCatalog();
  return normalizeMasterModules(useCrmMasterStore.getState().modules)
    .filter((m) => m.enabled)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((m) => ({ key: m.key, label: m.label }));
}

export function getCrmMasterModulesList(): CrmMasterModuleDef[] {
  ensureCrmMasterModulesCatalog();
  return normalizeMasterModules(useCrmMasterStore.getState().modules);
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
    implementationStages: s.implementationStages,
    academyTutorials: s.academyTutorials,
    whatsappTemplates: s.whatsappTemplates,
    ticketReplyTemplates: s.ticketReplyTemplates,
    onboardingTargets: s.onboardingTargets,
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
    ...(Array.isArray(raw.implementationStages)
      ? {
          implementationStages: normalizeCrmImplementationStages(
            raw.implementationStages as CrmImplementationStageDef[],
          ),
        }
      : {}),
    ...(Array.isArray(raw.academyTutorials)
      ? {
          academyTutorials: normalizeAcademyTutorials(
            raw.academyTutorials as AcademyTutorial[],
          ),
        }
      : {}),
    ...(Array.isArray(raw.whatsappTemplates)
      ? {
          whatsappTemplates: normalizeCrmWhatsappTemplates(
            raw.whatsappTemplates as CrmWhatsappTemplateDef[],
          ),
        }
      : {}),
    ...(Array.isArray(raw.ticketReplyTemplates)
      ? {
          ticketReplyTemplates: normalizeCrmTicketReplyTemplates(
            raw.ticketReplyTemplates as CrmTicketReplyTemplateDef[],
          ),
        }
      : {}),
    ...(raw.onboardingTargets && typeof raw.onboardingTargets === "object"
      ? {
          onboardingTargets: normalizeCrmOnboardingTargetSettings(raw.onboardingTargets),
        }
      : {}),
  }));
  // Older crm-master snapshots omit WhatsApp templates — seed once so Master + chat stay in sync.
  if (!Array.isArray(useCrmMasterStore.getState().whatsappTemplates) ||
      useCrmMasterStore.getState().whatsappTemplates.length === 0) {
    useCrmMasterStore.setState({ whatsappTemplates: seedCrmWhatsappTemplates() });
  }
  if (
    !Array.isArray(useCrmMasterStore.getState().ticketReplyTemplates) ||
    useCrmMasterStore.getState().ticketReplyTemplates.length === 0
  ) {
    useCrmMasterStore.setState({ ticketReplyTemplates: seedCrmTicketReplyTemplates() });
  }
  if (
    !useCrmMasterStore.getState().onboardingTargets ||
    !Array.isArray(useCrmMasterStore.getState().onboardingTargets.buckets) ||
    useCrmMasterStore.getState().onboardingTargets.buckets.length === 0
  ) {
    useCrmMasterStore.setState({ onboardingTargets: seedCrmOnboardingTargetSettings() });
  }
  ensureCrmMasterModulesCatalog();
}

export function getCrmMasterImplementationStages(): CrmImplementationStageDef[] {
  const stored = useCrmMasterStore.getState().implementationStages;
  return normalizeCrmImplementationStages(stored);
}

export function listActiveCrmImplementationStages(): CrmImplementationStageDef[] {
  return getCrmMasterImplementationStages().filter((s) => s.active);
}

export function resolveCrmStageLabel(stage: string | undefined): string {
  const normalized = normalizeCrmImplementationStage(stage);
  const match = getCrmMasterImplementationStages().find((s) => s.key === normalized);
  return match?.label ?? normalized.replace(/_/g, " ");
}

registerCrmMasterModuleLookup((key) => {
  const mod = normalizeMasterModules(useCrmMasterStore.getState().modules).find((m) => m.key === key);
  if (!mod) return undefined;
  return { kind: mod.kind, workflowSteps: mod.workflowSteps };
});
