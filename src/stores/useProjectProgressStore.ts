import type { ProjectManualProgress, ProjectProgressMilestoneKey } from "@/types";
import { nowIso } from "@/types";
import { PROJECT_PROGRESS_MILESTONES } from "@/types/project";
import { createStore, touch } from "./persist";
import { logActivity } from "./useActivityStore";
import { upsertProjectProgress } from "@/lib/api";
import { serverSync } from "@/lib/sync";

function emptyProgress(projectId: string): ProjectManualProgress {
  return {
    projectId,
    checks: {},
    notApplicable: {},
    remarks: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function isMilestoneDone(progress: ProjectManualProgress, key: ProjectProgressMilestoneKey) {
  return Boolean(progress.notApplicable[key] || progress.checks[key]);
}

type ProjectProgressState = {
  byProjectId: Record<string, ProjectManualProgress>;
  ensure: (projectId: string) => ProjectManualProgress;
  get: (projectId: string) => ProjectManualProgress;
  toggleCheck: (projectId: string, key: ProjectProgressMilestoneKey) => void;
  setCheck: (projectId: string, key: ProjectProgressMilestoneKey, value: boolean) => void;
  toggleNotApplicable: (projectId: string, key: ProjectProgressMilestoneKey) => void;
  updateMeta: (
    projectId: string,
    data: Partial<Pick<ProjectManualProgress, "contactPerson" | "contactNumber" | "remarks">>,
  ) => void;
  markAll: (projectId: string, value: boolean) => void;
  removeProject: (projectId: string) => void;
  calcPercent: (projectId: string) => number;
};

function syncProgress(projectId: string, extra?: { markAll?: boolean }) {
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
          notApplicable: progress.notApplicable as Record<string, boolean>,
          ...(extra?.markAll !== undefined ? { markAll: extra.markAll } : {}),
        },
      }),
    );
  });
}

export const useProjectProgressStore = createStore<ProjectProgressState>((set, get) => ({
    byProjectId: {},

    ensure: (projectId) => {
      const existing = get().byProjectId[projectId];
      if (existing) {
        if (!existing.notApplicable) {
          const normalized = { ...existing, notApplicable: {} };
          set((s) => ({ byProjectId: { ...s.byProjectId, [projectId]: normalized } }));
          return normalized;
        }
        return existing;
      }
      const created = emptyProgress(projectId);
      set((s) => ({ byProjectId: { ...s.byProjectId, [projectId]: created } }));
      return created;
    },

    get: (projectId) => {
      const p = get().byProjectId[projectId] ?? emptyProgress(projectId);
      return { ...p, notApplicable: p.notApplicable ?? {} };
    },

    toggleCheck: (projectId, key) => {
      get().ensure(projectId);
      const current = get().byProjectId[projectId] ?? emptyProgress(projectId);
      if (current.notApplicable?.[key]) return;
      set((s) => {
        const cur = s.byProjectId[projectId] ?? emptyProgress(projectId);
        const next = !cur.checks[key];
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({
              ...cur,
              notApplicable: cur.notApplicable ?? {},
              checks: { ...cur.checks, [key]: next },
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
        if (current.notApplicable?.[key]) return s;
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({
              ...current,
              notApplicable: current.notApplicable ?? {},
              checks: { ...current.checks, [key]: value },
            }),
          },
        };
      });
      syncProgress(projectId);
    },

    toggleNotApplicable: (projectId, key) => {
      get().ensure(projectId);
      set((s) => {
        const current = s.byProjectId[projectId] ?? emptyProgress(projectId);
        const na = current.notApplicable ?? {};
        const nextNa = !na[key];
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({
              ...current,
              notApplicable: { ...na, [key]: nextNa },
              checks: nextNa ? { ...current.checks, [key]: false } : current.checks,
            }),
          },
        };
      });
      const milestone = PROJECT_PROGRESS_MILESTONES.find((m) => m.key === key);
      const nowNa = Boolean(get().byProjectId[projectId]?.notApplicable?.[key]);
      logActivity({
        who: "You",
        what: nowNa
          ? `Marked "${milestone?.label ?? key}" as not applicable`
          : `Cleared N/A on "${milestone?.label ?? key}"`,
        kind: "info",
        projectId,
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
            [projectId]: touch({
              ...current,
              notApplicable: current.notApplicable ?? {},
              ...data,
            }),
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
      const notApplicable = Object.fromEntries(
        PROJECT_PROGRESS_MILESTONES.map((m) => [m.key, false]),
      ) as Record<ProjectProgressMilestoneKey, boolean>;
      set((s) => {
        const current = s.byProjectId[projectId] ?? emptyProgress(projectId);
        return {
          byProjectId: {
            ...s.byProjectId,
            [projectId]: touch({ ...current, checks, notApplicable }),
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
      const na = progress.notApplicable ?? {};
      const applicable = PROJECT_PROGRESS_MILESTONES.filter((m) => !na[m.key]);
      if (applicable.length === 0) return 100;
      const done = applicable.filter((m) => progress.checks[m.key]).length;
      return Math.round((done / applicable.length) * 100);
    },
  }),
);

export { isMilestoneDone };
