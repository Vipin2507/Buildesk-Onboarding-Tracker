/** Format DPR start/end stored as wall clock or UTC ISO. */
export function formatDprTime(value?: string | null): string {
  if (!value?.trim()) return "—";
  const v = value.trim();
  const wallClock = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !v.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(v);
  if (wallClock) {
    return v.slice(11, 16);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatDprTimeRange(start?: string | null, end?: string | null): string {
  const s = formatDprTime(start);
  if (!end?.trim()) return s;
  const e = formatDprTime(end);
  return e === "—" ? s : `${s} – ${e}`;
}
