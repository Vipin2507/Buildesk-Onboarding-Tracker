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

/** Default executive weekly hours (Mon–Sat 10:30–18:00). */
export function seedCrmBookingHostHours(): CrmBookingHostHoursDef[] {
  return [1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    startTime: "10:30",
    endTime: "18:00",
    enabled: true,
  }));
}

function defaultHostHour(weekday: number): CrmBookingHostHoursDef {
  return {
    weekday,
    startTime: "10:30",
    endTime: "18:00",
    enabled: weekday >= 1 && weekday <= 6,
  };
}

/** Upgrade legacy Mon–Fri 10:00–17:00 rows saved before the Sat / 10:30–18:00 defaults. */
function upgradeHostHour(row: CrmBookingHostHoursDef): CrmBookingHostHoursDef {
  const startTime = String(row.startTime || "10:30").slice(0, 5);
  const endTime = String(row.endTime || "18:00").slice(0, 5);
  if (startTime === "10:00" && endTime === "17:00") {
    return { ...row, startTime: "10:30", endTime: "18:00" };
  }
  return { ...row, startTime, endTime };
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
    byDay.set(weekday, upgradeHostHour({
      weekday,
      startTime: String(row.startTime || "10:30").slice(0, 5),
      endTime: String(row.endTime || "18:00").slice(0, 5),
      enabled: row.enabled !== false,
    }));
  }
  // Ensure all weekdays present for the editor.
  for (let d = 0; d <= 6; d++) {
    if (!byDay.has(d)) {
      byDay.set(d, defaultHostHour(d));
    }
  }
  return [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
}
