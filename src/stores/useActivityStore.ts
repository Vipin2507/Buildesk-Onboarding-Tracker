import type { ActivityEntry, ActivityKind } from "@/types";
import { newId, nowIso } from "@/types";
import { seedActivity } from "@/data/seed";
import { createPersistedStore } from "./persist";

type ActivityState = {
  activities: ActivityEntry[];
  addActivity: (entry: {
    who: string;
    what: string;
    kind?: ActivityKind;
    companyId?: string;
    projectId?: string;
  }) => void;
  getByCompany: (companyId: string) => ActivityEntry[];
  getByProject: (projectId: string) => ActivityEntry[];
  getRecent: (limit?: number) => ActivityEntry[];
};

export const useActivityStore = createPersistedStore<ActivityState>("activity", (set, get) => ({
  activities: seedActivity,

  addActivity: (entry) => {
    const now = nowIso();
    const activity: ActivityEntry = {
      id: newId(),
      who: entry.who,
      what: entry.what,
      kind: entry.kind ?? "info",
      companyId: entry.companyId,
      projectId: entry.projectId,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ activities: [activity, ...s.activities] }));
  },

  getByCompany: (companyId) =>
    get().activities.filter((a) => a.companyId === companyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  getByProject: (projectId) =>
    get().activities.filter((a) => a.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  getRecent: (limit = 10) =>
    [...get().activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
}));

export function logActivity(entry: Parameters<ActivityState["addActivity"]>[0]) {
  useActivityStore.getState().addActivity(entry);
}
