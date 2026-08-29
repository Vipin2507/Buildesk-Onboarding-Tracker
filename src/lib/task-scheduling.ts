import { browserWallClockIso, localWallClockIso } from "@/lib/booking-slots";
import type { FollowUpTaskStatus, FollowUpTaskType } from "@/types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse HH:mm to minutes since midnight. */
export function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0);
}

/** Format minutes since midnight as HH:mm. */
export function formatHm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${pad(h)}:${pad(m)}`;
}

/** Build wall-clock ISO range from date + times. */
export function buildTaskScheduleWindow(input: {
  dueDate: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
}): { startsAt: string; endsAt: string; durationMinutes: number; startTime: string; endTime: string } | null {
  const date = input.dueDate.slice(0, 10);
  const startTime = input.startTime.slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) return null;

  const startMin = parseHm(startTime);
  let endMin: number;
  let endTime: string;

  if (input.endTime?.trim()) {
    endTime = input.endTime.slice(0, 5);
    endMin = parseHm(endTime);
  } else if (input.durationMinutes && input.durationMinutes > 0) {
    endMin = startMin + input.durationMinutes;
    endTime = formatHm(endMin);
  } else {
    return null;
  }

  if (endMin <= startMin) return null;

  const durationMinutes = endMin - startMin;
  return {
    startsAt: `${date}T${startTime}:00`,
    endsAt: `${date}T${endTime}:00`,
    durationMinutes,
    startTime,
    endTime,
  };
}

export function calcEndTimeFromDuration(startTime: string, durationMinutes: number): string {
  return formatHm(parseHm(startTime.slice(0, 5)) + durationMinutes);
}

export function calcDurationFromTimes(startTime: string, endTime: string): number {
  return parseHm(endTime.slice(0, 5)) - parseHm(startTime.slice(0, 5));
}

export function scheduleRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Display e.g. "03:00 PM – 04:00 PM" from HH:mm strings. */
export function formatTimeRange12h(startTime?: string, endTime?: string): string {
  if (!startTime) return "—";
  const fmt = (hm: string) => {
    const [hStr, mStr] = hm.slice(0, 5).split(":");
    let h = Number(hStr);
    const m = mStr ?? "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };
  if (!endTime) return fmt(startTime);
  return `${fmt(startTime)} – ${fmt(endTime)}`;
}

export function taskHasSchedule(task: {
  startsAt?: string;
  endsAt?: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
}): boolean {
  if (task.startsAt && task.endsAt) return true;
  return Boolean(task.dueDate && task.startTime && task.endTime);
}

export function resolveTaskAssigneeIds(task: {
  assigneeUserIds?: string[];
  assigneeUserId?: string;
}): string[] {
  if (task.assigneeUserIds?.length) return task.assigneeUserIds;
  if (task.assigneeUserId) return [task.assigneeUserId];
  return [];
}

export type ScheduleConflict = {
  kind: "task" | "booking";
  title: string;
  startsAt: string;
  endsAt: string;
  userId?: string;
};

export function formatScheduleConflictMessage(conflict: ScheduleConflict): string {
  const start = conflict.startsAt.slice(11, 16);
  const end = conflict.endsAt.slice(11, 16);
  const label = conflict.kind === "booking" ? "meeting" : "task";
  return `Time slot unavailable: This user already has a ${label} scheduled from ${formatTimeRange12h(start, end)} (${conflict.title}).`;
}

export function isScheduledTaskType(taskType?: FollowUpTaskType): boolean {
  return Boolean(taskType);
}

export function resolveTaskExtraTimeMinutes(task: { extraTimeMinutes?: number | null }): number {
  const extra = task.extraTimeMinutes ?? 0;
  return extra > 0 ? extra : 0;
}

export function resolveTaskTotalDurationMinutes(task: {
  durationMinutes?: number | null;
  extraTimeMinutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
}): number | undefined {
  const base = resolveTaskDurationMinutes(task);
  if (!base) return undefined;
  return base + resolveTaskExtraTimeMinutes(task);
}

/** Row/cell display for planned + extra duration. */
export function formatTaskDurationDisplay(task: {
  durationMinutes?: number | null;
  extraTimeMinutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  const base = resolveTaskDurationMinutes(task);
  const extra = resolveTaskExtraTimeMinutes(task);
  if (!base && !extra) return "—";
  const total = (base ?? 0) + extra;
  if (extra > 0 && base) {
    return `${formatDurationMinutes(total)} (+${formatDurationMinutes(extra)})`;
  }
  return formatDurationMinutes(total);
}

/** Rebuild end time / ISO window when extra minutes are added to a scheduled task. */
export function buildTaskScheduleWithExtra(input: {
  dueDate?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  extraTimeMinutes?: number | null;
}) {
  const dueDate = input.dueDate?.slice(0, 10);
  const startTime = input.startTime?.slice(0, 5);
  const baseDuration = input.durationMinutes ?? 0;
  const extra = resolveTaskExtraTimeMinutes(input);
  const totalDuration = baseDuration + extra;
  if (!dueDate || !startTime || totalDuration <= 0) return null;
  const window = buildTaskScheduleWindow({
    dueDate,
    startTime,
    durationMinutes: totalDuration,
  });
  if (!window) return null;
  return {
    ...window,
    durationMinutes: baseDuration > 0 ? baseDuration : window.durationMinutes - extra,
    extraTimeMinutes: extra,
  };
}

export function resolveTaskDurationMinutes(task: {
  durationMinutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
}): number | undefined {
  if (task.durationMinutes && task.durationMinutes > 0) return task.durationMinutes;
  if (task.startTime && task.endTime) {
    const mins = calcDurationFromTimes(task.startTime, task.endTime);
    return mins > 0 ? mins : undefined;
  }
  return undefined;
}

/** Display e.g. "45m", "1h 30m", or "—". */
export function formatDurationMinutes(mins?: number | null): string {
  if (!mins || mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Wall-clock now for comparing against task startsAt / endsAt (YYYY-MM-DDTHH:mm:ss). */
export function taskWallClockNow(timezone?: string): string {
  return timezone ? localWallClockIso(timezone) : browserWallClockIso();
}

/** Subtract minutes from a wall-clock ISO string (YYYY-MM-DDTHH:mm:ss). */
export function subtractWallClockMinutes(iso: string, minutes: number): string {
  const clean = iso.slice(0, 19);
  const [datePart, timePart] = clean.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi, s = 0] = (timePart ?? "00:00:00").split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, s);
  dt.setMinutes(dt.getMinutes() - minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

/** Effective schedule bounds including extra time when present. */
export function resolveTaskScheduleIsoBounds(task: {
  startsAt?: string | null;
  endsAt?: string | null;
  dueDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  extraTimeMinutes?: number | null;
}): { startsAt: string; endsAt: string } | null {
  const extra = resolveTaskExtraTimeMinutes(task);
  const baseDuration = resolveTaskDurationMinutes(task);

  if (task.startsAt && task.endsAt) {
    if (extra > 0 && task.dueDate && task.startTime && baseDuration) {
      const extended = buildTaskScheduleWithExtra({
        dueDate: task.dueDate,
        startTime: task.startTime,
        durationMinutes: baseDuration,
        extraTimeMinutes: extra,
      });
      if (extended) {
        return { startsAt: extended.startsAt, endsAt: extended.endsAt };
      }
    }
    return {
      startsAt: task.startsAt.slice(0, 19),
      endsAt: task.endsAt.slice(0, 19),
    };
  }

  if (!task.dueDate || !task.startTime) return null;
  const totalDuration = (baseDuration ?? 0) + extra;
  const window = buildTaskScheduleWindow({
    dueDate: task.dueDate,
    startTime: task.startTime,
    endTime: task.endTime ?? undefined,
    durationMinutes: totalDuration > 0 ? totalDuration : undefined,
  });
  if (!window) return null;
  return { startsAt: window.startsAt, endsAt: window.endsAt };
}

export function isTaskInActiveWindow(
  task: Parameters<typeof resolveTaskScheduleIsoBounds>[0],
  nowWallClock: string,
): boolean {
  const bounds = resolveTaskScheduleIsoBounds(task);
  if (!bounds) return false;
  const now = nowWallClock.slice(0, 19);
  return now >= bounds.startsAt && now < bounds.endsAt;
}

/**
 * Auto status from schedule: open → in_progress when the slot starts.
 * in_progress stays until manually completed (even after the slot ends).
 */
export function resolveAutoTaskStatus(
  task: {
    status: FollowUpTaskStatus;
    startsAt?: string | null;
    endsAt?: string | null;
    dueDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    durationMinutes?: number | null;
    extraTimeMinutes?: number | null;
  },
  nowWallClock: string,
): FollowUpTaskStatus {
  if (task.status === "completed" || task.status === "cancelled" || task.status === "blocked") {
    return task.status;
  }

  const bounds = resolveTaskScheduleIsoBounds(task);
  if (!bounds) return task.status;

  const now = nowWallClock.slice(0, 19);
  const inWindow = now >= bounds.startsAt && now < bounds.endsAt;
  const beforeWindow = now < bounds.startsAt;

  if (inWindow && task.status === "open") return "in_progress";
  if (beforeWindow && task.status === "in_progress") return "open";
  return task.status;
}

export function applyAutoTaskStatus<T extends { status: FollowUpTaskStatus }>(
  task: T,
  nowWallClock = taskWallClockNow(),
): T {
  const status = resolveAutoTaskStatus(task, nowWallClock);
  return status === task.status ? task : { ...task, status };
}
