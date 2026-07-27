import type {
  AutomationEndpoint,
  AutomationHealthConfig,
  AutomationLog,
  AutomationRule,
} from "@/types/automation";
import { nowIso } from "@/types";
import {
  DEFAULT_AUTOMATION_ENDPOINTS,
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_HEALTH_CONFIG,
} from "@/data/automationDefaults";
import { createPersistedStore, touch } from "./persist";

type AutomationState = {
  endpoints: AutomationEndpoint[];
  healthCheck: AutomationHealthConfig;
  rules: AutomationRule[];
  logs: AutomationLog[];
  seeded: boolean;
  ensureDefaults: () => void;
  setEndpointUrl: (channel: AutomationEndpoint["channel"], webhookUrl: string) => void;
  setEndpointEnabled: (channel: AutomationEndpoint["channel"], isEnabled: boolean) => void;
  restoreDefaultEndpoints: () => void;
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
  return `AR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useAutomationStore = createPersistedStore<AutomationState>(
  "automation-v1",
  (set, get) => ({
    endpoints: DEFAULT_AUTOMATION_ENDPOINTS,
    healthCheck: DEFAULT_HEALTH_CONFIG,
    rules: DEFAULT_AUTOMATION_RULES,
    logs: [],
    seeded: true,

    ensureDefaults: () => {
      if (get().seeded && get().rules.length > 0) return;
      set({
        endpoints: DEFAULT_AUTOMATION_ENDPOINTS,
        healthCheck: DEFAULT_HEALTH_CONFIG,
        rules: DEFAULT_AUTOMATION_RULES,
        seeded: true,
      });
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
      }));
    },

    restoreDefaultEndpoints: () => {
      set({ endpoints: DEFAULT_AUTOMATION_ENDPOINTS.map((e: AutomationEndpoint) => ({ ...e })) });
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
      set({ healthCheck: { ...DEFAULT_HEALTH_CONFIG } });
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
      set((s) => ({
        rules: s.rules.map((r) => (r.id === id ? touch({ ...r, isActive }) : r)),
      }));
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
    },

    clearLogs: () => set({ logs: [] }),
  }),
);
