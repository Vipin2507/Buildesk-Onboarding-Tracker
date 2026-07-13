import type { OnboardingChecklistItem } from "@/types";

/** Item is done for progress / go-live (checked through or marked N/A). */
export function isChecklistItemComplete(item: OnboardingChecklistItem) {
  if (item.notApplicable) return true;
  return item.collected && item.uploaded && item.live;
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
