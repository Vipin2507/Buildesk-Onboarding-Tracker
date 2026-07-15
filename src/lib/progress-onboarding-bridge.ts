import {
  setChecklistState as apiSetChecklistState,
  upsertProjectProgress,
} from "@/lib/api";
import {
  computeChecklistPatchFromProgress,
  isProgressChecklistSyncing,
  milestonesForChecklistItem,
  withProgressChecklistSyncLock,
} from "@/lib/progress-checklist-sync";
import { serverSync } from "@/lib/sync";
import { touch } from "@/stores/persist";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useProjectProgressStore } from "@/stores/useProjectProgressStore";
import type { ProjectProgressMilestoneKey } from "@/types";
import { nowIso } from "@/types";

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
  });
}

/** Soft reverse: completing a checklist row checks its mapped Progress milestones. */
export function syncProgressFromChecklistItem(
  projectId: string,
  section: string,
  label: string,
  fullyDone: boolean,
) {
  if (!fullyDone || isProgressChecklistSyncing()) return;
  const keys = milestonesForChecklistItem(section, label);
  if (keys.length === 0) return;

  withProgressChecklistSyncLock(() => {
    useProjectProgressStore.getState().ensure(projectId);
    const current = useProjectProgressStore.getState().byProjectId[projectId];
    if (!current) return;
    let changed = false;
    const checks = { ...current.checks };
    for (const key of keys) {
      if (current.notApplicable?.[key]) continue;
      if (!checks[key]) {
        checks[key] = true;
        changed = true;
      }
    }
    if (!changed) return;
    useProjectProgressStore.setState((s) => ({
      byProjectId: {
        ...s.byProjectId,
        [projectId]: touch({
          ...current,
          checks,
          notApplicable: current.notApplicable ?? {},
        }),
      },
    }));
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
          notApplicable: (progress.notApplicable ?? {}) as Record<string, boolean>,
        },
      }),
    );
  });
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
  });
  queueMicrotask(() => syncChecklistFromProgress(projectId));
}
