import type { CrmBookingCallTypeDef, CrmBookingHostHoursDef } from "@/types/crm-master";

/** Default portal call types — durations drive open slot length. */
export function seedCrmBookingCallTypes(): CrmBookingCallTypeDef[] {
  return [
    {
      key: "query",
      label: "Query",
      durationMinutes: 15,
      allowsCustomDuration: false,
      isActive: true,
      order: 1,
    },
    {
      key: "training",
      label: "Training",
      durationMinutes: 30,
      allowsCustomDuration: false,
      isActive: true,
      order: 2,
    },
    {
      key: "other",
      label: "Other (please specify)",
      durationMinutes: 30,
      allowsCustomDuration: true,
      isActive: true,
      order: 3,
    },
  ];
}

/** Default executive weekly hours (Mon–Fri 10:00–17:00). */
export function seedCrmBookingHostHours(): CrmBookingHostHoursDef[] {
  return [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startTime: "10:00",
    endTime: "17:00",
    enabled: true,
  }));
}

export function normalizeCrmBookingCallTypes(
  existing: CrmBookingCallTypeDef[] | undefined,
): CrmBookingCallTypeDef[] {
  if (!Array.isArray(existing) || existing.length === 0) return seedCrmBookingCallTypes();
  return existing
    .map((f, index) => ({
      key: String(f.key ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      label: String(f.label ?? "").trim(),
      durationMinutes: Math.max(5, Number(f.durationMinutes) || 30),
      allowsCustomDuration: Boolean(f.allowsCustomDuration),
      isActive: f.isActive !== false,
      order: Number.isFinite(f.order) ? Number(f.order) : index + 1,
    }))
    .filter((f) => f.key && f.label)
    .sort((a, b) => a.order - b.order);
}

export function normalizeCrmBookingHostHours(
  existing: CrmBookingHostHoursDef[] | undefined,
): CrmBookingHostHoursDef[] {
  if (!Array.isArray(existing) || existing.length === 0) return seedCrmBookingHostHours();
  const byDay = new Map<number, CrmBookingHostHoursDef>();
  for (const row of existing) {
    const weekday = Number(row.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    byDay.set(weekday, {
      weekday,
      startTime: String(row.startTime || "10:00").slice(0, 5),
      endTime: String(row.endTime || "17:00").slice(0, 5),
      enabled: row.enabled !== false,
    });
  }
  // Ensure all weekdays present for the editor.
  for (let d = 0; d <= 6; d++) {
    if (!byDay.has(d)) {
      byDay.set(d, {
        weekday: d,
        startTime: "10:00",
        endTime: "17:00",
        enabled: d >= 1 && d <= 5,
      });
    }
  }
  return [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
}
