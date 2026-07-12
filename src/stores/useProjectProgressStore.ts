import type { ProjectManualProgress, ProjectProgressMilestoneKey } from "@/types";
import { nowIso } from "@/types";
import { PROJECT_PROGRESS_MILESTONES } from "@/types/project";
import { createPersistedStore, touch } from "./persist";
import { logActivity } from "./useActivityStore";
import { upsertProjectProgress } from "@/lib/api";
import { serverSync } from "@/lib/sync";

function emptyProgress(projectId: string): ProjectManualProgress {
  return {
    projectId,
    checks: {},
    remarks: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

type ProjectProgressState = {
  byProjectId: Record<string, ProjectManualProgress>;
  ensure: (projectId: string) => ProjectManualProgress;
  get: (projectId: string) => ProjectManualProgress;
  toggleCheck: (projectId: string, key: ProjectProgressMilestoneKey) => void;
  setCheck: (projectId: string, key: ProjectProgressMilestoneKey, value: boolean) => void;
  updateMeta: (
    projectId: string,
    data: Partial<Pick<ProjectManualProgress, "contactPerson" | "contactNumber" | "remarks">>,
  ) => void;
  markAll: (projectId: string, value: boolean) => void;
  removeProject: (projectId: string) => void;
  calcPercent: (projectId: string) => number;
};

function syncProgress(projectId: string, extra?: { markAll?: boolean }) {
  // Read after local set via microtask so state is current
  queueMicrotask(() => {
    const progress = useProjectProgressStore.getState().byProjectId[projectId];
    if (!progress) return;
    serverSync("projectProgress", () =>
      upsertProjectProgress({
        data: {
          projectId,
          contactPerson: progress.contactPerson,
          contactNumber: progress.contactNumber,
          remarks: progress.remarks,
          checks: progress.checks as Record<string, boolean>,
          ...(extra?.markAll !== undefined ? { markAll: extra.markAll } : {}),
        },
      }),
    );
  });
}

export const useProjectProgressStore = createPersistedStore<ProjectProgressState>(
  "project-manual-progress-v3",
  (set, get) => ({
    byProjectId: {},

    ensure: (projectId) => {
      const existing = get().byProjectId[projectId];
      if (existing) return existing;
      const created = emptyProgress(projectId);
      set((s) => ({ byProjectId: { ...s.byProjectId, [projectId]: created } }));
      return created;
    },

    get: (projectId) => get().byProjectId[projectId] ?? emptyProgress(projectId),

    toggleCheck: (projectId, key) => {
      get().ensure(projectId);
      set((s) => {
        const current = s.byProjectId[projectId] ?? emptyProgress(projectId);
        const next = !current.checks[key];
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({
              ...current,
              checks: { ...current.checks, [key]: next },
            }),
          },
        };
      });
      const milestone = PROJECT_PROGRESS_MILESTONES.find((m) => m.key === key);
      logActivity({
        who: "You",
        what: `${get().byProjectId[projectId]?.checks[key] ? "Checked" : "Unchecked"} ${milestone?.label ?? key}`,
        kind: "info",
        projectId,
      });
      syncProgress(projectId);
    },

    setCheck: (projectId, key, value) => {
      get().ensure(projectId);
      set((s) => {
        const current = s.byProjectId[projectId] ?? emptyProgress(projectId);
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({
              ...current,
              checks: { ...current.checks, [key]: value },
            }),
          },
        };
      });
      syncProgress(projectId);
    },

    updateMeta: (projectId, data) => {
      get().ensure(projectId);
      set((s) => {
        const current = s.byProjectId[projectId] ?? emptyProgress(projectId);
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({ ...current, ...data }),
          },
        };
      });
      syncProgress(projectId);
    },

    markAll: (projectId, value) => {
      get().ensure(projectId);
      const checks = Object.fromEntries(
        PROJECT_PROGRESS_MILESTONES.map((m) => [m.key, value]),
      ) as Record<ProjectProgressMilestoneKey, boolean>;
      set((s) => {
        const current = s.byProjectId[projectId] ?? emptyProgress(projectId);
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({ ...current, checks }),
          },
        };
      });
      logActivity({
        who: "You",
        what: value ? "Marked all progress milestones complete" : "Cleared all progress milestones",
        kind: value ? "success" : "warning",
        projectId,
      });
      syncProgress(projectId, { markAll: value });
    },

    removeProject: (projectId) => {
      set((s) => {
        const next = { ...s.byProjectId };
        delete next[projectId];
        return { byProjectId: next };
      });
    },

    calcPercent: (projectId) => {
      const progress = get().byProjectId[projectId];
      if (!progress) return 0;
      const total = PROJECT_PROGRESS_MILESTONES.length;
      const done = PROJECT_PROGRESS_MILESTONES.filter((m) => progress.checks[m.key]).length;
      return Math.round((done / total) * 100);
    },
  }),
);
