import {
  setChecklistState as apiSetChecklistState,
  upsertProjectProgress,
} from "@/lib/api";
import {
  computeChecklistPatchFromProgress,
  computeProgressPatchFromChecklist,
  isProgressChecklistSyncing,
  withProgressChecklistSyncLock,
} from "@/lib/progress-checklist-sync";
import { serverSync } from "@/lib/sync";
import { touch } from "@/stores/persist";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useProjectProgressStore } from "@/stores/useProjectProgressStore";
import type { ProjectProgressMilestoneKey } from "@/types";
import { nowIso } from "@/types";

function persistProgress(
  projectId: string,
  progress: {
    contactPerson?: string;
    contactNumber?: string;
    remarks: string;
    checks: Partial<Record<ProjectProgressMilestoneKey, boolean>>;
    notApplicable: Partial<Record<ProjectProgressMilestoneKey, boolean>>;
  },
) {
  serverSync("projectProgress", () =>
    upsertProjectProgress({
      data: {
        projectId,
        contactPerson: progress.contactPerson,
        contactNumber: progress.contactNumber,
        remarks: progress.remarks,
        checks: progress.checks as Record<string, boolean>,
        notApplicable: (progress.notApplicable ?? {}) as Record<string, boolean>,
      },
    }),
  );
}

function persistChecklistPatches(
  patched: ReturnType<typeof computeChecklistPatchFromProgress>,
) {
  for (const item of patched) {
    serverSync("setChecklistState", () =>
      apiSetChecklistState({
        data: {
          id: item.id,
          collected: item.collected,
          uploaded: item.uploaded,
          live: item.live,
          notApplicable: item.notApplicable,
        },
      }),
    );
  }
}

/** Progress Tracker → Onboarding checklist (overlapping rows only). */
export function syncChecklistFromProgress(projectId: string) {
  if (isProgressChecklistSyncing()) return;
  withProgressChecklistSyncLock(() => {
    const progress = useProjectProgressStore.getState().get(projectId);
    const items = useOnboardingStore
      .getState()
      .checklistItems.filter((i) => i.projectId === projectId);
    const patched = computeChecklistPatchFromProgress(
      items,
      progress.checks,
      progress.notApplicable ?? {},
    );
    if (patched.length === 0) return;

    const byId = new Map(patched.map((p) => [p.id, p]));
    useOnboardingStore.setState((s) => ({
      checklistItems: s.checklistItems.map((i) => byId.get(i.id) ?? i),
    }));
    persistChecklistPatches(patched);
  });
}

/**
 * Mark all milestones complete also finishes the full onboarding checklist
 * (including training / go-live rows not mapped to milestones).
 * Clearing milestones reopens mapped checklist rows only.
 */
export function syncMarkAllToChecklist(projectId: string, complete: boolean) {
  if (isProgressChecklistSyncing()) return;
  withProgressChecklistSyncLock(() => {
    if (complete) {
      useOnboardingStore.getState().completeAllChecklistForProject(projectId, "System");
      return;
    }
    const progress = useProjectProgressStore.getState().get(projectId);
    const items = useOnboardingStore
      .getState()
      .checklistItems.filter((i) => i.projectId === projectId);
    const patched = computeChecklistPatchFromProgress(
      items,
      progress.checks,
      progress.notApplicable ?? {},
    );
    if (patched.length === 0) return;
    const byId = new Map(patched.map((p) => [p.id, p]));
    useOnboardingStore.setState((s) => ({
      checklistItems: s.checklistItems.map((i) => byId.get(i.id) ?? i),
    }));
    persistChecklistPatches(patched);
  });
}

/**
 * Soft reverse: checklist changes update mapped Progress milestones.
 * Shared milestones (e.g. existingDataUpload) require all mapped rows complete.
 */
export function syncProgressFromChecklist(projectId: string) {
  if (isProgressChecklistSyncing()) return;
  withProgressChecklistSyncLock(() => {
    useProjectProgressStore.getState().ensure(projectId);
    const current = useProjectProgressStore.getState().byProjectId[projectId];
    if (!current) return;
    const items = useOnboardingStore
      .getState()
      .checklistItems.filter((i) => i.projectId === projectId);
    const patch = computeProgressPatchFromChecklist(
      items,
      current.checks,
      current.notApplicable ?? {},
    );
    if (!patch.changed) return;
    useProjectProgressStore.setState((s) => ({
      byProjectId: {
        ...s.byProjectId,
        [projectId]: touch({
          ...current,
          checks: patch.checks,
          notApplicable: patch.notApplicable,
        }),
      },
    }));
    const progress = useProjectProgressStore.getState().byProjectId[projectId];
    if (!progress) return;
    persistProgress(projectId, progress);
  });
}

/** @deprecated Prefer syncProgressFromChecklist — kept for call-site compatibility. */
export function syncProgressFromChecklistItem(
  projectId: string,
  _section: string,
  _label: string,
  _fullyDone: boolean,
) {
  syncProgressFromChecklist(projectId);
}

/**
 * Align both sides when opening a project:
 * 1) Checklist completions bump Progress
 * 2) Progress state wins and rewrites mapped Checklist rows
 */
export function reconcileProgressAndChecklist(projectId: string) {
  if (isProgressChecklistSyncing()) return;
  syncProgressFromChecklist(projectId);
  queueMicrotask(() => syncChecklistFromProgress(projectId));
}

/** After Go Live, ensure Close-out client sign-off is checked on Progress Tracker. */
export function markClientSignOffOnProgress(projectId: string) {
  if (isProgressChecklistSyncing()) return;
  withProgressChecklistSyncLock(() => {
    const key: ProjectProgressMilestoneKey = "clientSignOff";
    useProjectProgressStore.getState().ensure(projectId);
    const current = useProjectProgressStore.getState().byProjectId[projectId];
    if (!current || current.notApplicable?.[key] || current.checks[key]) return;
    useProjectProgressStore.setState((s) => ({
      byProjectId: {
        ...s.byProjectId,
        [projectId]: touch({
          ...current,
          checks: { ...current.checks, [key]: true },
          notApplicable: current.notApplicable ?? {},
          updatedAt: nowIso(),
        }),
      },
    }));
    const progress = useProjectProgressStore.getState().byProjectId[projectId];
    if (!progress) return;
    persistProgress(projectId, progress);
  });
  queueMicrotask(() => syncChecklistFromProgress(projectId));
}
