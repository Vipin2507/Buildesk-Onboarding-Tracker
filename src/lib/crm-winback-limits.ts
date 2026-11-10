export const CRM_WINBACK_WAVE_LIMIT = 50;
export const CRM_WINBACK_GAP_MS = 30 * 60 * 1000;

export function winbackScheduleConflict<T extends { id?: string; status: string; scheduledAt?: string | null }>(
  scheduledAtMs: number,
  existing: T[],
  ignoreId?: string,
): T | null {
  if (!Number.isFinite(scheduledAtMs)) return null;
  for (const row of existing) {
    if (ignoreId && row.id === ignoreId) continue;
    if (row.status !== "scheduled" && row.status !== "running") continue;
    const other = Date.parse(row.scheduledAt ?? "");
    if (!Number.isFinite(other)) continue;
    if (Math.abs(scheduledAtMs - other) < CRM_WINBACK_GAP_MS) return row;
  }
  return null;
}
