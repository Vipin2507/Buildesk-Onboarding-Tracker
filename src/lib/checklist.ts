import type { OnboardingChecklistItem } from "@/types";

export type ChecklistPhase = "collected" | "uploaded" | "live";

const PHASE_ORDER: ChecklistPhase[] = ["collected", "uploaded", "live"];

/** Item is done for go-live gates (fully checked through or marked N/A). */
export function isChecklistItemComplete(item: OnboardingChecklistItem) {
  if (item.notApplicable) return true;
  return item.collected && item.uploaded && item.live;
}

/** Fully done among applicable work only — N/A does not count as done. */
export function isChecklistItemFullyDone(item: OnboardingChecklistItem) {
  if (item.notApplicable) return false;
  return item.collected && item.uploaded && item.live;
}

/** Applicable item counts for UI fractions (e.g. 0/3 when one of four is N/A). */
export function countApplicableChecklist(items: OnboardingChecklistItem[]) {
  const applicable = items.filter((i) => !i.notApplicable);
  const done = applicable.filter((i) => i.collected && i.uploaded && i.live).length;
  return { done, total: applicable.length, na: items.length - applicable.length };
}

/** Progress % excluding N/A items from the denominator; all-N/A → 100. */
export function calcChecklistProgress(items: OnboardingChecklistItem[]) {
  const applicable = items.filter((i) => !i.notApplicable);
  if (items.length === 0) return 0;
  if (applicable.length === 0) return 100;
  const total = applicable.length * 3;
  const done = applicable.reduce(
    (sum, i) => sum + (i.collected ? 1 : 0) + (i.uploaded ? 1 : 0) + (i.live ? 1 : 0),
    0,
  );
  return Math.round((done / total) * 100);
}

/** Whether a phase button may be toggled given sequential collected → uploaded → live. */
export function canToggleChecklistPhase(item: OnboardingChecklistItem, phase: ChecklistPhase) {
  if (item.notApplicable) return false;
  const on = item[phase];
  if (on) {
    // Always allow turning off (cascades clear later phases)
    return true;
  }
  if (phase === "collected") return true;
  if (phase === "uploaded") return item.collected;
  return item.collected && item.uploaded;
}

/**
 * Apply a sequential phase toggle.
 * Turning on requires prior phases; turning off clears this and later phases.
 */
export function applyChecklistPhaseToggle(
  item: OnboardingChecklistItem,
  phase: ChecklistPhase,
): OnboardingChecklistItem | null {
  if (item.notApplicable) return null;
  if (!canToggleChecklistPhase(item, phase)) return null;

  const turningOn = !item[phase];
  if (turningOn) {
    return { ...item, [phase]: true };
  }

  const idx = PHASE_ORDER.indexOf(phase);
  const next = { ...item };
  for (let i = idx; i < PHASE_ORDER.length; i++) {
    next[PHASE_ORDER[i]] = false;
  }
  return next;
}
