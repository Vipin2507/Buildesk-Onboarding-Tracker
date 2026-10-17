import type { CrmOnboardingTargetBucket, CrmOnboardingTargetSettings } from "@/types/crm-master";

/** YYYY-MM-DD for calendar-day math (local). */
export function todayYmd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmd(value: string | undefined | null): Date | null {
  if (!value) return null;
  const ymd = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole calendar days between start and today (0 on start day). */
export function calendarDaysBetween(startYmd: string, endYmd: string): number | null {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function accountOnboardingStartYmd(account: {
  startDate?: string | null;
  createdAt?: string | null;
}): string | null {
  const start = account.startDate?.trim().slice(0, 10);
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) return start;
  const created = account.createdAt?.trim().slice(0, 10);
  if (created && /^\d{4}-\d{2}-\d{2}$/.test(created)) return created;
  return null;
}

export function daysSinceOnboardingStart(
  account: { startDate?: string | null; createdAt?: string | null },
  today = todayYmd(),
): number | null {
  const start = accountOnboardingStartYmd(account);
  if (!start) return null;
  return calendarDaysBetween(start, today);
}

/** First active bucket whose [dayFrom, dayTo] contains daysSince (inclusive). */
export function resolveOnboardingTargetBucket(
  settings: CrmOnboardingTargetSettings,
  daysSince: number,
): CrmOnboardingTargetBucket | null {
  if (daysSince < 0) return null;
  if (daysSince > settings.targetDays) return null;
  const active = settings.buckets
    .filter((b) => b.active)
    .slice()
    .sort((a, b) => a.order - b.order || a.dayFrom - b.dayFrom);
  return (
    active.find((b) => daysSince >= b.dayFrom && daysSince <= b.dayTo) ?? null
  );
}

export function isOnboardingBehindTarget(
  progressPercent: number,
  bucket: CrmOnboardingTargetBucket,
): boolean {
  return progressPercent < bucket.minProgressPercent;
}

export function onboardingTargetBucketLabel(bucket: CrmOnboardingTargetBucket): string {
  return `Day ${bucket.dayFrom}–${bucket.dayTo} · ${bucket.minProgressPercent}%`;
}
