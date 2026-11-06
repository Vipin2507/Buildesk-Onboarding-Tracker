export const CRM_WHATSAPP_BROADCAST_RECIPIENT_LIMIT = 50;
export const CRM_WHATSAPP_BROADCAST_GAP_MS = 30 * 60 * 1000;

export function broadcastScheduleConflict<T extends { id?: string; status: string; scheduledAt: string }>(
  scheduledAtMs: number,
  existing: T[],
  ignoreId?: string,
): T | null {
  if (!Number.isFinite(scheduledAtMs)) return null;
  for (const row of existing) {
    if (ignoreId && row.id === ignoreId) continue;
    if (row.status !== "pending" && row.status !== "running") continue;
    const other = Date.parse(row.scheduledAt);
    if (!Number.isFinite(other)) continue;
    if (Math.abs(scheduledAtMs - other) < CRM_WHATSAPP_BROADCAST_GAP_MS) return row;
  }
  return null;
}
