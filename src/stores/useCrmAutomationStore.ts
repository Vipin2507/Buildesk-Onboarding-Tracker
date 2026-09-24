import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationLog,
  AutomationRule,
  AutomationSettings,
  WahaConfig,
} from "@/types/automation";
import { nowIso } from "@/types";
import {
  DEFAULT_CRM_AUTOMATION_ENDPOINTS,
  DEFAULT_CRM_AUTOMATION_RULES,
  DEFAULT_CRM_AUTOMATION_SETTINGS,
  DEFAULT_CRM_HEALTH_CONFIG,
  DEFAULT_CRM_WAHA_CONFIG,
  crmAutomationRulesDifferFromMerge,
  mergeCrmAutomationEndpoints,
  mergeCrmAutomationRules,
} from "@/data/crm-automation-defaults";
import { createPersistedStore, touch } from "./persist";
import {
  clearAutomationLogsOnServer,
  syncAutomationLogToServer,
} from "@/lib/automation-log-sync";

function flushAutomationToggles() {
  void import("@/lib/config-persistence").then(({ flushAutomationConfigPersistence }) => {
    flushAutomationConfigPersistence();
  });
}

type AutomationState = {
  settings: AutomationSettings;
  endpoints: AutomationEndpoint[];
  waha: WahaConfig;
  healthCheck: AutomationHealthConfig;
  rules: AutomationRule[];
  logs: AutomationLog[];
  seeded: boolean;
  ensureDefaults: () => void;
  setSettings: (partial: Partial<AutomationSettings>) => void;
  restoreDefaultSettings: () => void;
  setEndpointUrl: (channel: AutomationEndpoint["channel"], webhookUrl: string) => void;
  setEndpointEnabled: (channel: AutomationEndpoint["channel"], isEnabled: boolean) => void;
  restoreDefaultEndpoints: () => void;
  setWahaConfig: (partial: Partial<WahaConfig>) => void;
  restoreDefaultWaha: () => void;
  setWahaHealth: (check: NonNullable<WahaConfig["lastHealthCheck"]>) => void;
  setHealthCheckUrl: (webhookUrl: string) => void;
  setHealthCheckMethod: (httpMethod: AutomationHealthConfig["httpMethod"]) => void;
  restoreDefaultHealth: () => void;
  setEndpointHealth: (
    channel: AutomationEndpoint["channel"],
    check: NonNullable<AutomationEndpoint["lastHealthCheck"]>,
  ) => void;
  setHealthCheckResult: (check: NonNullable<AutomationHealthConfig["lastHealthCheck"]>) => void;
  addRule: (data: Omit<AutomationRule, "id" | "createdAt" | "updatedAt">) => AutomationRule;
  updateRule: (id: string, data: Partial<AutomationRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string, isActive: boolean) => void;
  upsertLog: (log: AutomationLog) => void;
  clearLogs: () => void;
};

function ruleId() {
  return `CAR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

type CrmAutomationSnapshot = {
  settings?: AutomationSettings;
  endpoints?: AutomationEndpoint[];
  waha?: WahaConfig;
  healthCheck?: AutomationHealthConfig;
  rules?: AutomationRule[];
  logs?: AutomationLog[];
};

export const useCrmAutomationStore = createPersistedStore<AutomationState>(
  "crm-automation-v1",
  (set, get) => ({
    settings: DEFAULT_CRM_AUTOMATION_SETTINGS,
    endpoints: DEFAULT_CRM_AUTOMATION_ENDPOINTS,
    waha: DEFAULT_CRM_WAHA_CONFIG,
    healthCheck: DEFAULT_CRM_HEALTH_CONFIG,
    rules: DEFAULT_CRM_AUTOMATION_RULES,
    logs: [],
    seeded: true,

    ensureDefaults: () => {
      const s = get();
      const needsWaha = !s.waha?.apiUrl;
      const needsProvider = s.endpoints.some((e) => !e.provider);
      const needsSettings = !s.settings?.n8nWebhookBase;
      const usesLegacyCrmSegment =
        s.endpoints.some((e) => e.webhookUrl.includes("buildesk-crm-")) ||
        s.healthCheck?.webhookUrl?.includes("buildesk-crm-");

      const existingRules = s.rules.length > 0 ? s.rules : DEFAULT_CRM_AUTOMATION_RULES;
      const mergedRules = mergeCrmAutomationRules(existingRules);
      const rulesNeedUpdate = crmAutomationRulesDifferFromMerge(existingRules);
      const mergedEndpoints = mergeCrmAutomationEndpoints(
        s.endpoints.length > 0 ? s.endpoints : DEFAULT_CRM_AUTOMATION_ENDPOINTS,
        DEFAULT_CRM_AUTOMATION_ENDPOINTS,
        { replaceLegacyUrls: usesLegacyCrmSegment },
      );
      const endpointsNeedMeta =
        needsProvider ||
        !s.seeded ||
        usesLegacyCrmSegment ||
        s.endpoints.length === 0 ||
        DEFAULT_CRM_AUTOMATION_ENDPOINTS.some((seed) => !s.endpoints.some((e) => e.channel === seed.channel));

      if (
        s.seeded &&
        s.rules.length > 0 &&
        !needsWaha &&
        !needsSettings &&
        !rulesNeedUpdate &&
        !endpointsNeedMeta
      ) {
        return;
      }

      set({
        settings: s.settings?.n8nWebhookBase
          ? s.settings
          : {
              ...DEFAULT_CRM_AUTOMATION_SETTINGS,
              automationsEnabled: s.settings?.automationsEnabled ?? true,
            },
        endpoints: mergedEndpoints,
        waha: s.waha?.apiUrl
          ? {
              ...s.waha,
              apiUrl: s.waha.apiUrl,
              apiKey: s.waha.apiKey || DEFAULT_CRM_WAHA_CONFIG.apiKey,
              sessionName: s.waha.sessionName || DEFAULT_CRM_WAHA_CONFIG.sessionName,
              isEnabled: s.waha.isEnabled,
            }
          : {
              ...DEFAULT_CRM_WAHA_CONFIG,
              isEnabled: s.waha?.isEnabled ?? DEFAULT_CRM_WAHA_CONFIG.isEnabled,
            },
        healthCheck:
          usesLegacyCrmSegment || !s.healthCheck?.webhookUrl
            ? { ...DEFAULT_CRM_HEALTH_CONFIG }
            : s.healthCheck,
        rules: mergedRules,
        seeded: true,
      });
    },

    setSettings: (partial) => {
      set((s) => ({
        settings: {
          ...s.settings,
          ...partial,
          n8nWebhookBase: partial.n8nWebhookBase?.trim() ?? s.settings.n8nWebhookBase,
        },
      }));
      if (partial.automationsEnabled !== undefined) {
        flushAutomationToggles();
      }
    },

    restoreDefaultSettings: () => {
      set({ settings: { ...DEFAULT_CRM_AUTOMATION_SETTINGS } });
    },

    setEndpointUrl: (channel, webhookUrl) => {
      set((s) => ({
        endpoints: s.endpoints.map((e) =>
          e.channel === channel ? { ...e, webhookUrl: webhookUrl.trim() } : e,
        ),
      }));
    },

    setEndpointEnabled: (channel, isEnabled) => {
      set((s) => ({
        endpoints: s.endpoints.map((e) => (e.channel === channel ? { ...e, isEnabled } : e)),
        waha: channel === "whatsapp" ? { ...s.waha, isEnabled } : s.waha,
      }));
      flushAutomationToggles();
    },

    restoreDefaultEndpoints: () => {
      set({ endpoints: DEFAULT_CRM_AUTOMATION_ENDPOINTS.map((e: AutomationEndpoint) => ({ ...e })) });
    },

    setWahaConfig: (partial) => {
      set((s) => ({
        waha: {
          ...s.waha,
          ...partial,
          apiUrl: partial.apiUrl?.trim() ?? s.waha.apiUrl,
          apiKey: partial.apiKey?.trim() ?? s.waha.apiKey,
          sessionName: partial.sessionName?.trim() ?? s.waha.sessionName,
        },
        endpoints:
          partial.isEnabled !== undefined
            ? s.endpoints.map((e) =>
                e.channel === "whatsapp" ? { ...e, isEnabled: partial.isEnabled! } : e,
              )
            : s.endpoints,
      }));
    },

    restoreDefaultWaha: () => {
      set({ waha: { ...DEFAULT_CRM_WAHA_CONFIG } });
    },

    setWahaHealth: (check) => {
      set((s) => ({
        waha: { ...s.waha, lastHealthCheck: check },
        endpoints: s.endpoints.map((e) =>
          e.channel === "whatsapp" ? { ...e, lastHealthCheck: check } : e,
        ),
      }));
    },

    setHealthCheckUrl: (webhookUrl) => {
      set((s) => ({
        healthCheck: { ...s.healthCheck, webhookUrl: webhookUrl.trim() },
      }));
    },

    setHealthCheckMethod: (httpMethod) => {
      set((s) => ({ healthCheck: { ...s.healthCheck, httpMethod } }));
    },

    restoreDefaultHealth: () => {
      set({ healthCheck: { ...DEFAULT_CRM_HEALTH_CONFIG } });
    },

    setEndpointHealth: (channel, check) => {
      set((s) => ({
        endpoints: s.endpoints.map((e) =>
          e.channel === channel ? { ...e, lastHealthCheck: check } : e,
        ),
      }));
    },

    setHealthCheckResult: (check) => {
      set((s) => ({ healthCheck: { ...s.healthCheck, lastHealthCheck: check } }));
    },

    addRule: (data) => {
      const now = nowIso();
      const rule: AutomationRule = {
        ...data,
        id: ruleId(),
        createdAt: now,
        updatedAt: now,
      };
      set((s) => ({ rules: [rule, ...s.rules] }));
      return rule;
    },

    updateRule: (id, data) => {
      set((s) => ({
        rules: s.rules.map((r) => (r.id === id ? touch({ ...r, ...data }) : r)),
      }));
    },

    deleteRule: (id) => {
      set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }));
    },

    toggleRule: (id, isActive) => {
      set((s) => {
        const exists = s.rules.some((r) => r.id === id);
        if (exists) {
          return {
            rules: s.rules.map((r) => (r.id === id ? touch({ ...r, isActive }) : r)),
          };
        }
        // Panel may show a seed-merged rule that isn't in the store yet — upsert so the toggle sticks.
        const seed = DEFAULT_CRM_AUTOMATION_RULES.find((r) => r.id === id);
        if (!seed) return s;
        return { rules: [...s.rules, touch({ ...seed, isActive })] };
      });
      flushAutomationToggles();
    },

    upsertLog: (log) => {
      set((s) => {
        const idx = s.logs.findIndex((l) => l.id === log.id);
        if (idx >= 0) {
          const next = [...s.logs];
          next[idx] = log;
          return { logs: next };
        }
        return { logs: [log, ...s.logs].slice(0, 500) };
      });
      syncAutomationLogToServer("crm-automation", log);
    },

    clearLogs: () => {
      set({ logs: [] });
      clearAutomationLogsOnServer("crm-automation");
    },
  }),
);

/** Hydrate automation state from server app_config snapshot. */
export function hydrateCrmAutomationFromServer(snapshot: CrmAutomationSnapshot | null | undefined) {
  if (!snapshot || typeof snapshot !== "object") return;
  const patch: Partial<AutomationState> = {};
  if (snapshot.settings) {
    patch.settings = {
      ...DEFAULT_CRM_AUTOMATION_SETTINGS,
      ...snapshot.settings,
      automationsEnabled: snapshot.settings.automationsEnabled ?? true,
    };
  }
  if (Array.isArray(snapshot.endpoints) && snapshot.endpoints.length > 0) {
    patch.endpoints = mergeCrmAutomationEndpoints(snapshot.endpoints).map((e) => ({
      ...e,
      isEnabled: typeof e.isEnabled === "boolean" ? e.isEnabled : true,
    }));
  }
  if (snapshot.waha) {
    patch.waha = {
      ...DEFAULT_CRM_WAHA_CONFIG,
      ...snapshot.waha,
      isEnabled:
        typeof snapshot.waha.isEnabled === "boolean"
          ? snapshot.waha.isEnabled
          : DEFAULT_CRM_WAHA_CONFIG.isEnabled,
    };
  }
  if (snapshot.healthCheck) patch.healthCheck = snapshot.healthCheck;
  if (Array.isArray(snapshot.rules)) {
    patch.rules = mergeCrmAutomationRules(snapshot.rules).map((r) => ({
      ...r,
      // Coerce so a missing field never flips the Switch into an uncontrolled/default state.
      isActive: typeof r.isActive === "boolean" ? r.isActive : true,
    }));
  }
  // Logs are loaded separately from SQLite via getAutomationLogs.
  if (Object.keys(patch).length === 0) return;
  useCrmAutomationStore.setState((s) => ({
    ...s,
    ...patch,
    seeded: true,
  }));
}
