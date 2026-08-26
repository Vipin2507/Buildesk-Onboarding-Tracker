import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";

import {
  buildTaskScheduleWindow,
  resolveAutoTaskStatus,
  resolveTaskAssigneeIds,
  scheduleRangesOverlap,
  type ScheduleConflict,
} from "@/lib/task-scheduling";
import { localWallClockIso } from "@/lib/booking-slots";
import type { FollowUpTask, FollowUpTaskType } from "@/types";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";
import { newId, nowIso } from "@/types";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

const OCCUPIED_TASK_STATUSES = ["open", "in_progress", "blocked"];

export function parseAssigneeIdsJson(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function mapTaskRow(row: typeof t.followUpTasks.$inferSelect): FollowUpTask {
  const assigneeUserIds = parseAssigneeIdsJson(row.assigneeUserIdsJson);
  const primaryAssignee = row.assigneeUserId ?? assigneeUserIds[0];
  return {
    id: row.id,
    companyId: row.companyId,
    onboardingProjectId: row.onboardingProjectId ?? undefined,
    postSalesProjectId: row.postSalesProjectId ?? undefined,
    sourceVisitId: row.sourceVisitId ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as FollowUpTask["status"],
    priority: row.priority as FollowUpTask["priority"],
    progressPercent: row.progressPercent,
    dueDate: row.dueDate ?? undefined,
    taskType: (row.taskType as FollowUpTaskType | null) ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    startsAt: row.startsAt ?? undefined,
    endsAt: row.endsAt ?? undefined,
    durationMinutes: row.durationMinutes ?? undefined,
    extraTimeMinutes: row.extraTimeMinutes ?? 0,
    latestRemark: row.latestRemark ?? undefined,
    assigneeUserId: primaryAssignee ?? undefined,
    assigneeUserIds: assigneeUserIds.length ? assigneeUserIds : primaryAssignee ? [primaryAssignee] : [],
    createdByUserId: row.createdByUserId ?? undefined,
    completedAt: row.completedAt ?? undefined,
    completedByUserId: row.completedByUserId ?? undefined,
    source: (row.source as FollowUpTask["source"]) ?? "manual",
    bookingAppointmentId: row.bookingAppointmentId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function taskAssigneeIds(row: typeof t.followUpTasks.$inferSelect): string[] {
  const fromJson = parseAssigneeIdsJson(row.assigneeUserIdsJson);
  if (fromJson.length) return fromJson;
  return row.assigneeUserId ? [row.assigneeUserId] : [];
}

/** Busy ranges from scheduled tasks for a user in a date window. */
export function collectTaskBusyRanges(userId: string, fromYmd: string, toYmd: string) {
  const db = getDb();
  const rangeStart = `${fromYmd}T00:00:00`;
  const rangeEnd = `${toYmd}T23:59:59`;

  const rows = db
    .select()
    .from(t.followUpTasks)
    .where(
      and(
        inArray(t.followUpTasks.status, OCCUPIED_TASK_STATUSES),
        lte(t.followUpTasks.startsAt, rangeEnd),
        gte(t.followUpTasks.endsAt, rangeStart),
      ),
    )
    .all();

  return rows
    .filter((row) => row.startsAt && row.endsAt && taskAssigneeIds(row).includes(userId))
    .map((row) => ({ startsAt: row.startsAt!, endsAt: row.endsAt! }));
}

export function findScheduleConflicts(input: {
  userIds: string[];
  startsAt: string;
  endsAt: string;
  excludeTaskId?: string;
  excludeBookingId?: string;
}): ScheduleConflict[] {
  const db = getDb();
  const ymd = input.startsAt.slice(0, 10);
  const rangeStart = `${ymd}T00:00:00`;
  const rangeEnd = `${ymd}T23:59:59`;
  const conflicts: ScheduleConflict[] = [];

  for (const userId of input.userIds) {
    const tasks = db
      .select()
      .from(t.followUpTasks)
      .where(
        and(
          inArray(t.followUpTasks.status, OCCUPIED_TASK_STATUSES),
          lte(t.followUpTasks.startsAt, rangeEnd),
          gte(t.followUpTasks.endsAt, rangeStart),
          input.excludeTaskId ? ne(t.followUpTasks.id, input.excludeTaskId) : undefined,
        ),
      )
      .all();

    for (const task of tasks) {
      if (!task.startsAt || !task.endsAt) continue;
      if (!taskAssigneeIds(task).includes(userId)) continue;
      if (scheduleRangesOverlap(input.startsAt, input.endsAt, task.startsAt, task.endsAt)) {
        conflicts.push({
          kind: "task",
          title: task.title,
          startsAt: task.startsAt,
          endsAt: task.endsAt,
          userId,
        });
      }
    }

    const bookings = db
      .select()
      .from(t.bookingAppointments)
      .where(
        and(
          eq(t.bookingAppointments.hostUserId, userId),
          inArray(t.bookingAppointments.status, ["pending", "confirmed", "postponed"]),
          lte(t.bookingAppointments.startsAt, rangeEnd),
          gte(t.bookingAppointments.endsAt, rangeStart),
          input.excludeBookingId
            ? ne(t.bookingAppointments.id, input.excludeBookingId)
            : undefined,
        ),
      )
      .all();

    for (const booking of bookings) {
      if (scheduleRangesOverlap(input.startsAt, input.endsAt, booking.startsAt, booking.endsAt)) {
        conflicts.push({
          kind: "booking",
          title: booking.guestName ? `Booking – ${booking.guestName}` : "Booking",
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          userId,
        });
      }
    }
  }

  return conflicts;
}

export function normalizeTaskSchedule(input: {
  dueDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  taskType?: FollowUpTaskType | null;
}) {
  const dueDate = input.dueDate?.slice(0, 10);
  const startTime = input.startTime?.slice(0, 5);
  const endTime = input.endTime?.slice(0, 5);
  const hasTimes = Boolean(dueDate && startTime);

  if (!hasTimes) {
    return {
      dueDate: dueDate ?? null,
      startTime: null as string | null,
      endTime: null as string | null,
      startsAt: null as string | null,
      endsAt: null as string | null,
      durationMinutes: null as number | null,
    };
  }

  const window = buildTaskScheduleWindow({
    dueDate: dueDate!,
    startTime: startTime!,
    endTime: endTime || undefined,
    durationMinutes: input.durationMinutes ?? undefined,
  });

  if (!window) {
    throw new Error("End time must be after start time");
  }

  return {
    dueDate,
    startTime: window.startTime,
    endTime: window.endTime,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    durationMinutes: window.durationMinutes,
  };
}

export function serializeAssigneeIds(ids: string[] | undefined, fallback?: string | null): string {
  const list = ids?.length ? ids : fallback ? [fallback] : [];
  return JSON.stringify([...new Set(list.filter(Boolean))]);
}

export function resolvePrimaryAssignee(ids: string[] | undefined, fallback?: string | null): string | null {
  const list = ids?.length ? ids : fallback ? [fallback] : [];
  return list[0] ?? null;
}

function isVideoBookingEvent(slug: string, title: string, meetUrl?: string | null): boolean {
  if (meetUrl) return true;
  const hay = `${slug} ${title}`.toLowerCase();
  return hay.includes("gmeet") || hay.includes("meet") || hay.includes("teams") || hay.includes("video");
}

/** Create or update a task linked to a confirmed GMeet/Teams booking. */
export function syncTaskFromBookingAppointment(
  appointment: typeof t.bookingAppointments.$inferSelect,
  event?: { slug: string; title: string },
) {
  const db = getDb();
  const eventRow =
    event ??
    db
      .select()
      .from(t.bookingEventTypes)
      .where(eq(t.bookingEventTypes.id, appointment.eventTypeId))
      .get();

  const slug = eventRow?.slug ?? "";
  const title = eventRow?.title ?? "Meeting";
  if (!isVideoBookingEvent(slug, title, appointment.meetUrl)) return null;

  const now = nowIso();
  const guestLabel = appointment.guestName?.trim() || "Client";
  const taskTitle = `GMeet Meeting – ${guestLabel}`;
  const assigneeIds = [appointment.hostUserId];
  const schedule = {
    dueDate: appointment.startsAt.slice(0, 10),
    startTime: appointment.startsAt.slice(11, 16),
    endTime: appointment.endsAt.slice(11, 16),
    startsAt: appointment.startsAt.slice(0, 19),
    endsAt: appointment.endsAt.slice(0, 19),
    durationMinutes: Math.round(
      (new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60000,
    ),
  };

  const existing = appointment.id
    ? db
        .select()
        .from(t.followUpTasks)
        .where(eq(t.followUpTasks.bookingAppointmentId, appointment.id))
        .get()
    : undefined;

  if (existing) {
    db.update(t.followUpTasks)
      .set({
        title: taskTitle,
        taskType: "on_call_gmeet_teams",
        dueDate: schedule.dueDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        durationMinutes: schedule.durationMinutes,
        assigneeUserId: appointment.hostUserId,
        assigneeUserIdsJson: serializeAssigneeIds(assigneeIds),
        status:
          appointment.status === "cancelled" || appointment.status === "declined"
            ? "cancelled"
            : appointment.status === "completed"
              ? "completed"
              : "open",
        updatedAt: now,
      })
      .where(eq(t.followUpTasks.id, existing.id))
      .run();
    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, existing.id)).get()!);
  }

  if (appointment.status === "cancelled" || appointment.status === "declined") return null;

  const id = newId();
  db.insert(t.followUpTasks)
    .values({
      id,
      companyId: appointment.companyId,
      title: taskTitle,
      description: appointment.notes ?? null,
      status: "open",
      priority: "medium",
      progressPercent: 0,
      taskType: "on_call_gmeet_teams",
      dueDate: schedule.dueDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      durationMinutes: schedule.durationMinutes,
      assigneeUserId: appointment.hostUserId,
      assigneeUserIdsJson: serializeAssigneeIds(assigneeIds),
      source: "booking",
      bookingAppointmentId: appointment.id,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, id)).get()!);
}

/** Persist open ↔ in_progress transitions when scheduled start/end times elapse. */
export function syncFollowUpTaskStatusesByTime(
  db: ReturnType<typeof getDb>,
  timezone = DEFAULT_BOOKING_TIMEZONE,
): FollowUpTask[] {
  const nowWall = localWallClockIso(timezone);
  const rows = db
    .select()
    .from(t.followUpTasks)
    .where(inArray(t.followUpTasks.status, ["open", "in_progress"]))
    .all();

  const updated: FollowUpTask[] = [];
  const ts = nowIso();

  for (const row of rows) {
    const mapped = mapTaskRow(row);
    const nextStatus = resolveAutoTaskStatus(mapped, nowWall);
    if (nextStatus === row.status) continue;
    db.update(t.followUpTasks)
      .set({ status: nextStatus, updatedAt: ts })
      .where(eq(t.followUpTasks.id, row.id))
      .run();
    updated.push(
      mapTaskRow(
        db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, row.id)).get()!,
      ),
    );
  }

  return updated;
}

export function cancelLinkedTaskForBooking(bookingId: string) {
  const db = getDb();
  const now = nowIso();
  const linked = db
    .select()
    .from(t.followUpTasks)
    .where(eq(t.followUpTasks.bookingAppointmentId, bookingId))
    .all();
  for (const task of linked) {
    db.update(t.followUpTasks)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(t.followUpTasks.id, task.id))
      .run();
  }
}
