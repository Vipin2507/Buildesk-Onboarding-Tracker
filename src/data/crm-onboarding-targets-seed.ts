import type {
  CrmOnboardingTargetBucket,
  CrmOnboardingTargetSettings,
} from "@/types/crm-master";

const DEFAULT_REMARK =
  "If The Overall % is Less than this, Push Whats app message notification to Support 1 & 2 & Admin";

/** Default 45-day onboarding target buckets (Master → Onboarding targets). */
export function seedCrmOnboardingTargetSettings(): CrmOnboardingTargetSettings {
  const buckets: CrmOnboardingTargetBucket[] = [
    {
      id: "days-0-5",
      dayFrom: 0,
      dayTo: 5,
      minProgressPercent: 30,
      remarks: DEFAULT_REMARK,
      active: true,
      order: 1,
    },
    {
      id: "days-6-20",
      dayFrom: 6,
      dayTo: 20,
      minProgressPercent: 50,
      remarks: DEFAULT_REMARK,
      active: true,
      order: 2,
    },
    {
      id: "days-21-35",
      dayFrom: 21,
      dayTo: 35,
      minProgressPercent: 75,
      remarks: DEFAULT_REMARK,
      active: true,
      order: 3,
    },
    {
      id: "days-36-45",
      dayFrom: 36,
      dayTo: 45,
      minProgressPercent: 100,
      remarks: DEFAULT_REMARK,
      active: true,
      order: 4,
    },
  ];
  return { targetDays: 45, buckets };
}

export function normalizeCrmOnboardingTargetSettings(
  raw: unknown,
): CrmOnboardingTargetSettings {
  const seed = seedCrmOnboardingTargetSettings();
  if (!raw || typeof raw !== "object") return seed;

  const obj = raw as Partial<CrmOnboardingTargetSettings> & {
    buckets?: unknown;
  };
  const targetDays =
    typeof obj.targetDays === "number" && obj.targetDays > 0
      ? Math.round(obj.targetDays)
      : seed.targetDays;

  const list = Array.isArray(obj.buckets) ? obj.buckets : seed.buckets;
  const buckets = list
    .map((item, index): CrmOnboardingTargetBucket | null => {
      if (!item || typeof item !== "object") return null;
      const b = item as Partial<CrmOnboardingTargetBucket>;
      const dayFrom = Number(b.dayFrom);
      const dayTo = Number(b.dayTo);
      const minProgressPercent = Number(b.minProgressPercent);
      if (!Number.isFinite(dayFrom) || !Number.isFinite(dayTo)) return null;
      if (!Number.isFinite(minProgressPercent)) return null;
      const id =
        String(b.id ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-|-$/g, "") || `days-${dayFrom}-${dayTo}`;
      return {
        id,
        dayFrom: Math.max(0, Math.round(dayFrom)),
        dayTo: Math.max(0, Math.round(dayTo)),
        minProgressPercent: Math.min(100, Math.max(0, Math.round(minProgressPercent))),
        remarks: String(b.remarks ?? "").trim() || DEFAULT_REMARK,
        active: b.active !== false,
        order: typeof b.order === "number" ? b.order : index + 1,
      };
    })
    .filter((b): b is CrmOnboardingTargetBucket => Boolean(b))
    .map((b) => ({
      ...b,
      dayTo: Math.max(b.dayFrom, b.dayTo),
    }))
    .sort((a, b) => a.order - b.order || a.dayFrom - b.dayFrom);

  return {
    targetDays,
    buckets: buckets.length > 0 ? buckets : seed.buckets,
  };
}
