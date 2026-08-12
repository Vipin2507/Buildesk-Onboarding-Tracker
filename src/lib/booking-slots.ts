import type { BookingSlot } from "@/types/booking";

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Wall-clock now in an IANA timezone as YYYY-MM-DDTHH:mm:ss (matches slot format). */
export function localWallClockIso(timezone: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(date)
      .replace(" ", "T");
  } catch {
    return date.toISOString().slice(0, 19);
  }
}

/** Browser-local wall clock for portal UI filtering. */
export function browserWallClockIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

/** Build ISO-ish local datetime string YYYY-MM-DDTHH:mm:00 for a calendar day + minutes. */
function atLocalMinutes(ymd: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${ymd}T${pad(h)}:${pad(m)}:00`;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export type AvailabilityWindow = {
  weekday: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

export type BusyRange = {
  startsAt: string;
  endsAt: string;
};

/**
 * Generate open slots for [fromYmd, toYmd] inclusive using weekly windows.
 * Times are treated as wall-clock in the host timezone (stored without offset).
 */
export function computeOpenSlots(input: {
  fromYmd: string;
  toYmd: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  windows: AvailabilityWindow[];
  busy: BusyRange[];
  /** Wall-clock now in host timezone (YYYY-MM-DDTHH:mm:ss). Defaults to UTC slice. */
  nowIso?: string;
}): BookingSlot[] {
  const duration = Math.max(5, input.durationMinutes);
  const bufferBefore = input.bufferBeforeMinutes ?? 0;
  const bufferAfter = input.bufferAfterMinutes ?? 0;
  const now = input.nowIso ?? new Date().toISOString().slice(0, 19);
  const activeWindows = input.windows.filter((w) => w.isActive !== false);
  if (activeWindows.length === 0) return [];

  const slots: BookingSlot[] = [];
  const from = new Date(`${input.fromYmd}T00:00:00`);
  const to = new Date(`${input.toYmd}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekday = d.getDay();
    const dayWindows = activeWindows.filter((w) => w.weekday === weekday);
    for (const win of dayWindows) {
      const startMin = parseHm(win.startTime);
      const endMin = parseHm(win.endTime);
      for (let cursor = startMin; cursor + duration <= endMin; cursor += duration) {
        const startsAt = atLocalMinutes(ymd, cursor);
        const endsAt = atLocalMinutes(ymd, cursor + duration);
        if (startsAt <= now) continue;

        const blockStart = atLocalMinutes(ymd, Math.max(0, cursor - bufferBefore));
        const blockEnd = atLocalMinutes(ymd, cursor + duration + bufferAfter);
        const conflict = input.busy.some((b) =>
          overlaps(blockStart, blockEnd, b.startsAt.slice(0, 19), b.endsAt.slice(0, 19)),
        );
        if (conflict) continue;
        slots.push({ startsAt, endsAt });
      }
    }
  }

  return slots;
}
