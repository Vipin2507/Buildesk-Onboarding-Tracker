import type { Integration, Trigger } from "@/types";
import { newId, nowIso } from "@/types";
import { seedIntegrations, seedTriggers } from "@/data/seed";
import { logActivity } from "./useActivityStore";
import { createPersistedStore, touch } from "./persist";

type IntegrationState = {
  integrations: Integration[];
  triggers: Trigger[];

  toggleIntegration: (id: string, field: "connected" | "tested") => void;
  addTrigger: (data: Omit<Trigger, "id" | "createdAt" | "updatedAt">) => void;
  updateTrigger: (id: string, data: Partial<Trigger>) => void;
  deleteTrigger: (id: string) => void;
  toggleTrigger: (id: string) => void;
};

export const useIntegrationStore = createPersistedStore<IntegrationState>("integrations", (set, get) => ({
  integrations: seedIntegrations,
  triggers: seedTriggers,

  toggleIntegration: (id, field) => {
    const integration = get().integrations.find((i) => i.id === id);
    if (!integration) return;
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? touch({ ...i, [field]: !i[field] }) : i,
      ),
    }));
    logActivity({
      who: "You",
      what: `${integration.name} ${field} ${!integration[field] ? "enabled" : "disabled"}`,
      kind: "info",
      projectId: integration.projectId,
    });
  },

  addTrigger: (data) => {
    const t: Trigger = { ...data, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
    set((s) => ({ triggers: [...s.triggers, t] }));
    logActivity({ who: "You", what: `Added trigger ${t.name}`, kind: "success" });
  },

  updateTrigger: (id, data) => {
    set((s) => ({ triggers: s.triggers.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)) }));
  },

  deleteTrigger: (id) => {
    set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) }));
  },

  toggleTrigger: (id) => {
    set((s) => ({
      triggers: s.triggers.map((t) => (t.id === id ? touch({ ...t, active: !t.active }) : t)),
    }));
  },
}));
