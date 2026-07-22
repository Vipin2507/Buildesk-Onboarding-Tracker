import type { OnboardingChecklistItem } from "@/types";
import { nowIso } from "@/types";

export type ChecklistPhase = "collected" | "uploaded" | "live";

const PHASE_ORDER: ChecklistPhase[] = ["collected", "uploaded", "live"];

const PHASE_AT: Record<ChecklistPhase, "collectedAt" | "uploadedAt" | "liveAt"> = {
  collected: "collectedAt",
  uploaded: "uploadedAt",
  live: "liveAt",
};

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
 * Optional `at` (YYYY-MM-DD or ISO) stamps the phase date when turning on.
 */
export function applyChecklistPhaseToggle(
  item: OnboardingChecklistItem,
  phase: ChecklistPhase,
  at?: string,
): OnboardingChecklistItem | null {
  if (item.notApplicable) return null;
  if (!canToggleChecklistPhase(item, phase)) return null;

  const turningOn = !item[phase];
  if (turningOn) {
    return {
      ...item,
      [phase]: true,
      [PHASE_AT[phase]]: normalizePhaseAt(at),
    };
  }

  const idx = PHASE_ORDER.indexOf(phase);
  const next = { ...item };
  for (let i = idx; i < PHASE_ORDER.length; i++) {
    const p = PHASE_ORDER[i]!;
    next[p] = false;
    next[PHASE_AT[p]] = undefined;
  }
  return next;
}

/** Normalize a picked calendar date (or ISO) for checklist phase timestamps. */
export function normalizePhaseAt(at?: string, fallback = nowIso()) {
  const raw = at?.trim();
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;
  return fallback;
}

/** Update only the timestamp for an already-completed phase. */
export function applyChecklistPhaseDate(
  item: OnboardingChecklistItem,
  phase: ChecklistPhase,
  at: string,
): OnboardingChecklistItem | null {
  if (item.notApplicable || !item[phase]) return null;
  return {
    ...item,
    [PHASE_AT[phase]]: normalizePhaseAt(at),
  };
}

/** YYYY-MM-DD for date picker value from a stored phase timestamp. */
export function phaseAtToYmd(at?: string) {
  if (!at) return "";
  return at.slice(0, 10);
}

export type ChecklistPhaseBucket =
  | "awaiting_collection"
  | "awaiting_upload"
  | "awaiting_live"
  | "complete";

/** Current blocking phase for an applicable checklist item. */
export function getChecklistPhaseBucket(item: OnboardingChecklistItem): ChecklistPhaseBucket | null {
  if (item.notApplicable) return null;
  if (item.collected && item.uploaded && item.live) return "complete";
  if (item.uploaded) return "awaiting_live";
  if (item.collected) return "awaiting_upload";
  return "awaiting_collection";
}

export function matchesChecklistPhaseBucket(
  item: OnboardingChecklistItem,
  bucket: ChecklistPhaseBucket,
) {
  return getChecklistPhaseBucket(item) === bucket;
}

export function summarizeChecklistPhases(items: OnboardingChecklistItem[]) {
  const applicable = items.filter((i) => !i.notApplicable);
  const awaitingCollection = applicable.filter((i) => !i.collected).length;
  const awaitingUpload = applicable.filter((i) => i.collected && !i.uploaded).length;
  const awaitingLive = applicable.filter((i) => i.uploaded && !i.live).length;
  const complete = applicable.filter((i) => i.collected && i.uploaded && i.live).length;
  const totalSteps = applicable.length * 3;
  const completedSteps = applicable.reduce(
    (sum, i) => sum + (i.collected ? 1 : 0) + (i.uploaded ? 1 : 0) + (i.live ? 1 : 0),
    0,
  );
  return {
    applicable: applicable.length,
    awaitingCollection,
    awaitingUpload,
    awaitingLive,
    complete,
    totalSteps,
    completedSteps,
    progressPercent: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 100,
  };
}

/** Stamp phase dates when setting absolute checklist state (e.g. progress sync). */
export function stampChecklistPhaseDates(
  prev: OnboardingChecklistItem,
  next: Pick<OnboardingChecklistItem, "collected" | "uploaded" | "live" | "notApplicable">,
  now = nowIso(),
): Pick<OnboardingChecklistItem, "collectedAt" | "uploadedAt" | "liveAt"> {
  if (next.notApplicable) {
    return { collectedAt: undefined, uploadedAt: undefined, liveAt: undefined };
  }
  return {
    collectedAt: next.collected ? prev.collectedAt ?? now : undefined,
    uploadedAt: next.uploaded ? prev.uploadedAt ?? now : undefined,
    liveAt: next.live ? prev.liveAt ?? now : undefined,
  };
}
