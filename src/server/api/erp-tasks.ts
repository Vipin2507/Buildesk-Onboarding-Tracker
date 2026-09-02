import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { roleHasPermission } from "@/lib/permissions";
import {
  buildTaskScheduleWithExtra,
  formatScheduleConflictMessage,
} from "@/lib/task-scheduling";
import { appendTaskRemark } from "@/lib/task-remarks";
import { loadServerRoles } from "@/server/auth/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { logActivity } from "@/server/api/mappers";
import {
  findScheduleConflicts,
  mapTaskRow,
  normalizeTaskSchedule,
  resolvePrimaryAssignee,
  serializeAssigneeIds,
  syncFollowUpTaskStatusesByTime,
} from "@/server/lib/task-schedule";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";
import type { FollowUpTask } from "@/types";

const ERP_SCOPE = "erp" as const;

function assertCanManageErpTask(user: ReturnType<typeof requireUser>) {
  if (user.role === "Admin") return;
  const roles = loadServerRoles();
  if (roleHasPermission(roles, user.role, "manageTasks")) return;
  throw new ApiError(403, "You do not have permission for this action");
}

function assertErpCompany(companyId: string) {
  const company = getDb().select().from(t.companies).where(eq(t.companies.id, companyId)).get();
  if (!company) throw new ApiError(404, "Company not found");
}

function assertErpTaskRow(row: typeof t.followUpTasks.$inferSelect) {
  if (row.productScope !== ERP_SCOPE) {
    throw new ApiError(404, "Task not found");
  }
}

const taskInput = z.object({
  id: z.string().optional(),
  companyId: z.string(),
  onboardingProjectId: z.string().optional().nullable(),
  postSalesProjectId: z.string().optional().nullable(),
  sourceVisitId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["open", "in_progress", "blocked", "completed", "cancelled"]).default("open"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  progressPercent: z.number().int().min(0).max(100).default(0),
  dueDate: z.string().optional().nullable(),
  taskType: z
    .enum(["on_call_phone", "on_call_gmeet_teams", "offline_site_visit", "offline_office"])
    .optional()
    .nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(1).optional().nullable(),
  extraTimeMinutes: z.number().int().min(0).optional().nullable(),
  assigneeUserId: z.string().optional().nullable(),
  assigneeUserIds: z.array(z.string()).optional().nullable(),
  source: z.enum(["manual", "booking"]).optional(),
  skipConflictCheck: z.boolean().optional(),
});

function assertNoScheduleConflicts(input: {
  userIds: string[];
  startsAt: string;
  endsAt: string;
  excludeTaskId?: string;
}) {
  const conflicts = findScheduleConflicts({
    ...input,
    productScope: ERP_SCOPE,
    includeBookings: false,
  });
  if (conflicts.length > 0) {
    throw new ApiError(409, formatScheduleConflictMessage(conflicts[0]!));
  }
}

export const listErpFollowUpTasks = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().optional(),
        status: z.string().optional(),
        assigneeUserId: z.string().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    syncFollowUpTaskStatusesByTime(db, user.timezone || DEFAULT_BOOKING_TIMEZONE);
    let rows = db
      .select()
      .from(t.followUpTasks)
      .where(eq(t.followUpTasks.productScope, ERP_SCOPE))
      .orderBy(desc(t.followUpTasks.updatedAt))
      .all();
    if (data?.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data?.status) rows = rows.filter((r) => r.status === data.status);
    if (data?.assigneeUserId) {
      rows = rows.filter((r) => {
        if (r.assigneeUserId === data.assigneeUserId) return true;
        try {
          const ids = JSON.parse(r.assigneeUserIdsJson || "[]") as unknown;
          return Array.isArray(ids) && ids.includes(data.assigneeUserId);
        } catch {
          return false;
        }
      });
    }
    return rows.map(mapTaskRow);
  });

export const syncErpFollowUpTaskStatuses = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({}).optional().parse(data ?? {}))
  .handler(async () => {
    const user = requireUser();
    const db = getDb();
    const tz = user.timezone || DEFAULT_BOOKING_TIMEZONE;
    const updated = syncFollowUpTaskStatusesByTime(db, tz);
    return updated.filter((task) => task.productScope === ERP_SCOPE);
  });

export const createErpFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => taskInput.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageErpTask(user);
    assertErpCompany(data.companyId);
    const db = getDb();
    const id = data.id ?? newId();
    const now = nowIso();
    const completedAt = data.status === "completed" ? now : null;

    let schedule;
    try {
      schedule = normalizeTaskSchedule({
        dueDate: data.dueDate,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
        taskType: data.taskType,
      });
    } catch {
      throw new ApiError(400, "End time must be after start time");
    }

    if (data.taskType && schedule.startsAt && schedule.endsAt && !data.skipConflictCheck) {
      const assigneeIds = data.assigneeUserIds?.length
        ? data.assigneeUserIds
        : data.assigneeUserId
          ? [data.assigneeUserId]
          : [];
      if (assigneeIds.length === 0) {
        throw new ApiError(400, "Assign at least one user for a scheduled task");
      }
      assertNoScheduleConflicts({
        userIds: assigneeIds,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
      });
    }

    const assigneeUserIdsJson = serializeAssigneeIds(
      data.assigneeUserIds ?? undefined,
      data.assigneeUserId,
    );
    const primaryAssignee = resolvePrimaryAssignee(
      data.assigneeUserIds ?? undefined,
      data.assigneeUserId,
    );

    db.insert(t.followUpTasks)
      .values({
        id,
        companyId: data.companyId,
        onboardingProjectId: data.onboardingProjectId ?? null,
        postSalesProjectId: data.postSalesProjectId ?? null,
        sourceVisitId: data.sourceVisitId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        progressPercent: data.progressPercent,
        dueDate: schedule.dueDate,
        taskType: data.taskType ?? null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        durationMinutes: schedule.durationMinutes,
        extraTimeMinutes: 0,
        assigneeUserId: primaryAssignee,
        assigneeUserIdsJson,
        source: data.source ?? "manual",
        bookingAppointmentId: null,
        productScope: ERP_SCOPE,
        createdByUserId: user.id,
        completedAt,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    logActivity({
      who: user.name,
      what: `Created follow-up task: ${data.title}`,
      kind: "info",
      companyId: data.companyId,
    });

    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, id)).get()!);
  });

export const updateErpFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: taskInput.partial().extend({ remark: z.string().optional() }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageErpTask(user);
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertErpTaskRow(existing);

    const { remark, ...patch } = data.patch;
    const now = nowIso();
    const nextStatus = patch.status ?? existing.status;
    const completedAt =
      nextStatus === "completed"
        ? existing.completedAt || now
        : nextStatus === "cancelled"
          ? existing.completedAt
          : null;
    const completedByUserId =
      nextStatus === "completed" && !existing.completedAt ? user.id : existing.completedByUserId;

    const dueDate = patch.dueDate !== undefined ? patch.dueDate : existing.dueDate;
    const startTime = patch.startTime !== undefined ? patch.startTime : existing.startTime;
    const endTime = patch.endTime !== undefined ? patch.endTime : existing.endTime;
    const durationMinutes =
      patch.durationMinutes !== undefined ? patch.durationMinutes : existing.durationMinutes;
    const extraTimeMinutes =
      patch.extraTimeMinutes != null ? patch.extraTimeMinutes : existing.extraTimeMinutes ?? 0;
    const taskType = patch.taskType !== undefined ? patch.taskType : existing.taskType;

    let schedule;
    try {
      const extended = buildTaskScheduleWithExtra({
        dueDate,
        startTime,
        durationMinutes,
        extraTimeMinutes,
      });
      if (extended) {
        schedule = {
          dueDate: dueDate?.slice(0, 10) ?? null,
          startTime: extended.startTime,
          endTime: extended.endTime,
          startsAt: extended.startsAt,
          endsAt: extended.endsAt,
          durationMinutes: extended.durationMinutes,
        };
      } else {
        schedule = normalizeTaskSchedule({
          dueDate,
          startTime,
          endTime,
          durationMinutes,
          taskType: taskType as FollowUpTask["taskType"],
        });
      }
    } catch {
      throw new ApiError(400, "End time must be after start time");
    }

    const assigneeUserIdsJson =
      patch.assigneeUserIds !== undefined || patch.assigneeUserId !== undefined
        ? serializeAssigneeIds(
            patch.assigneeUserIds ?? undefined,
            patch.assigneeUserId !== undefined ? patch.assigneeUserId : existing.assigneeUserId,
          )
        : existing.assigneeUserIdsJson;
    const primaryAssignee =
      patch.assigneeUserIds !== undefined || patch.assigneeUserId !== undefined
        ? resolvePrimaryAssignee(
            patch.assigneeUserIds ?? undefined,
            patch.assigneeUserId !== undefined ? patch.assigneeUserId : existing.assigneeUserId,
          )
        : existing.assigneeUserId;

    const assigneeIdsForConflict = patch.assigneeUserIds?.length
      ? patch.assigneeUserIds
      : primaryAssignee
        ? [primaryAssignee]
        : [];

    if (
      taskType &&
      schedule.startsAt &&
      schedule.endsAt &&
      !patch.skipConflictCheck &&
      assigneeIdsForConflict.length > 0 &&
      ["open", "in_progress", "blocked"].includes(nextStatus)
    ) {
      assertNoScheduleConflicts({
        userIds: assigneeIdsForConflict,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        excludeTaskId: data.id,
      });
    }

    const remarkUpdate = remark?.trim()
      ? appendTaskRemark(existing.remarksJson, existing.latestRemark, remark, {
          authorName: user.name,
          authorUserId: user.id,
          createdAt: now,
        })
      : null;

    db.update(t.followUpTasks)
      .set({
        title: patch.title ?? existing.title,
        description: patch.description !== undefined ? patch.description : existing.description,
        status: nextStatus,
        priority: patch.priority ?? existing.priority,
        progressPercent: patch.progressPercent ?? existing.progressPercent,
        dueDate: schedule.dueDate,
        taskType: taskType ?? null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        durationMinutes: schedule.durationMinutes,
        extraTimeMinutes,
        latestRemark: remarkUpdate?.latestRemark ?? existing.latestRemark,
        remarksJson: remarkUpdate?.remarksJson ?? existing.remarksJson,
        assigneeUserId: primaryAssignee,
        assigneeUserIdsJson,
        completedAt,
        completedByUserId,
        updatedAt: now,
      })
      .where(eq(t.followUpTasks.id, data.id))
      .run();

    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
  });

export const completeErpFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string(), remark: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageErpTask(user);
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertErpTaskRow(existing);
    const now = nowIso();
    const remarkUpdate = data.remark?.trim()
      ? appendTaskRemark(existing.remarksJson, existing.latestRemark, data.remark, {
          authorName: user.name,
          authorUserId: user.id,
          createdAt: now,
        })
      : null;
    db.update(t.followUpTasks)
      .set({
        status: "completed",
        progressPercent: 100,
        completedAt: now,
        completedByUserId: user.id,
        latestRemark: remarkUpdate?.latestRemark ?? existing.latestRemark,
        remarksJson: remarkUpdate?.remarksJson ?? existing.remarksJson,
        updatedAt: now,
      })
      .where(eq(t.followUpTasks.id, data.id))
      .run();
    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
  });

export const cancelErpFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), reason: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageErpTask(user);
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertErpTaskRow(existing);
    const now = nowIso();
    const remarkUpdate = data.reason?.trim()
      ? appendTaskRemark(existing.remarksJson, existing.latestRemark, data.reason, {
          authorName: user.name,
          authorUserId: user.id,
          createdAt: now,
        })
      : null;
    db.update(t.followUpTasks)
      .set({
        status: "cancelled",
        latestRemark: remarkUpdate?.latestRemark ?? existing.latestRemark,
        remarksJson: remarkUpdate?.remarksJson ?? existing.remarksJson,
        updatedAt: now,
      })
      .where(eq(t.followUpTasks.id, data.id))
      .run();
    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
  });

export const deleteErpFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertErpTaskRow(existing);
    db.delete(t.automationRemindersSent)
      .where(eq(t.automationRemindersSent.taskId, data.id))
      .run();
    db.delete(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).run();
    return { ok: true as const, id: data.id };
  });

export const checkErpTaskScheduleConflicts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        assigneeUserIds: z.array(z.string()).min(1),
        startsAt: z.string().min(10),
        endsAt: z.string().min(10),
        excludeTaskId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const conflicts = findScheduleConflicts({
      userIds: data.assigneeUserIds,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      excludeTaskId: data.excludeTaskId,
      productScope: ERP_SCOPE,
      includeBookings: false,
    });
    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      message: conflicts[0] ? formatScheduleConflictMessage(conflicts[0]) : undefined,
    };
  });
