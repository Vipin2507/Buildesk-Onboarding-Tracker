import type { FollowUpTaskType } from "@/types";

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
  const label = conflict.kind === "booking" ? "booking" : "task";
  return `Time slot unavailable: This user already has a ${label} scheduled from ${formatTimeRange12h(start, end)} (${conflict.title}).`;
}

export function isScheduledTaskType(taskType?: FollowUpTaskType): boolean {
  return Boolean(taskType);
}
