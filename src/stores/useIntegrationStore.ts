import type { Integration, Trigger } from "@/types";
import { newId, nowIso } from "@/types";
import { logActivity } from "./useActivityStore";
import { createStore, touch } from "./persist";
import { mutateIntegration } from "@/lib/api";
import { serverSync } from "@/lib/sync";

type IntegrationState = {
  integrations: Integration[];
  triggers: Trigger[];

  toggleIntegration: (id: string, field: "connected" | "tested") => void;
  addTrigger: (data: Omit<Trigger, "id" | "createdAt" | "updatedAt">) => void;
  updateTrigger: (id: string, data: Partial<Trigger>) => void;
  deleteTrigger: (id: string) => void;
  toggleTrigger: (id: string) => void;
};

export const useIntegrationStore = createStore<IntegrationState>((set, get) => ({
  integrations: [],
  triggers: [],

  toggleIntegration: (id, field) => {
    const integration = get().integrations.find((i) => i.id === id);
    if (!integration) return;
    const next = !integration[field];
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? touch({ ...i, [field]: next }) : i,
      ),
    }));
    logActivity({
      who: "You",
      what: `${integration.name} ${field} ${next ? "enabled" : "disabled"}`,
      kind: "info",
      projectId: integration.projectId,
    });
    serverSync("toggleIntegration", () =>
      mutateIntegration({
        data: { kind: "integration", action: "update", id, values: { [field]: next } },
      }),
    );
  },

  addTrigger: (data) => {
    const t: Trigger = { ...data, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
    set((s) => ({ triggers: [...s.triggers, t] }));
    logActivity({ who: "You", what: `Added trigger ${t.name}`, kind: "success" });
    serverSync("addTrigger", () =>
      mutateIntegration({ data: { kind: "trigger", action: "create", id: t.id, values: { ...data } } }),
    );
  },

  updateTrigger: (id, data) => {
    set((s) => ({ triggers: s.triggers.map((t) => (t.id === id ? touch({ ...t, ...data }) : t)) }));
    serverSync("updateTrigger", () =>
      mutateIntegration({ data: { kind: "trigger", action: "update", id, values: data } }),
    );
  },

  deleteTrigger: (id) => {
    set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) }));
    serverSync("deleteTrigger", () =>
      mutateIntegration({ data: { kind: "trigger", action: "delete", id } }),
    );
  },

  toggleTrigger: (id) => {
    const current = get().triggers.find((t) => t.id === id);
    if (!current) return;
    const active = !current.active;
    set((s) => ({
      triggers: s.triggers.map((t) => (t.id === id ? touch({ ...t, active }) : t)),
    }));
    serverSync("toggleTrigger", () =>
      mutateIntegration({ data: { kind: "trigger", action: "update", id, values: { active } } }),
    );
  },
}));
