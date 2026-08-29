import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { roleHasPermission } from "@/lib/permissions";
import {
  buildTaskScheduleWithExtra,
  formatScheduleConflictMessage,
} from "@/lib/task-scheduling";
import { requirePermission, loadServerRoles } from "@/server/auth/permissions";
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
import { processTaskInAppReminders } from "@/server/crm-task-in-app-reminder";
import { processTaskReminderAutomations } from "@/server/crm-task-reminder-automation";
import { processTaskWebPushReminders } from "@/server/crm-task-web-push";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";
import type {
  ClientVisit,
  CrmEvent,
  FollowUpTask,
  ModuleKey,
  ModuleSubscription,
  ModuleSubscriptionEvent,
  ModuleSubscriptionStatus,
} from "@/types";

/* ---------- Helpers ---------- */

const CRM_SCOPE = "crm" as const;

function assertCrmTaskRow(row: typeof t.followUpTasks.$inferSelect) {
  if (row.productScope !== CRM_SCOPE) {
    throw new ApiError(404, "Task not found");
  }
}

function assertCanManageFollowUpTask(user: ReturnType<typeof requireUser>, companyId: string) {
  if (user.role === "Admin") return;

  const roles = loadServerRoles();
  if (roleHasPermission(roles, user.role, "manageTasks")) return;

  const crmAccount = getDb()
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, companyId))
    .get();
  if (
    crmAccount &&
    canViewCrmAccount(
      {
        salesManagerName: crmAccount.salesManagerName ?? undefined,
        supportManager1: crmAccount.supportManager1 ?? undefined,
        supportManager2: crmAccount.supportManager2 ?? undefined,
      },
      user,
    )
  ) {
    return;
  }

  throw new ApiError(403, "You do not have permission for this action");
}

function writeCrmEvent(input: {
  companyId: string;
  entityType: CrmEvent["entityType"];
  taskId?: string;
  visitId?: string;
  subscriptionId?: string;
  eventType: string;
  actorUserId?: string;
  actorName: string;
  remark?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  progressPercent?: number;
  dueDate?: string;
}) {
  const db = getDb();
  db.insert(t.crmEvents)
    .values({
      id: newId(),
      companyId: input.companyId,
      entityType: input.entityType,
      taskId: input.taskId ?? null,
      visitId: input.visitId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName,
      remark: input.remark ?? null,
      oldValuesJson: input.oldValues ? JSON.stringify(input.oldValues) : null,
      newValuesJson: input.newValues ? JSON.stringify(input.newValues) : null,
      progressPercent: input.progressPercent ?? null,
      dueDate: input.dueDate ?? null,
      createdAt: nowIso(),
    })
    .run();
}

function mapSubscription(row: typeof t.moduleSubscriptions.$inferSelect): ModuleSubscription {
  return {
    id: row.id,
    companyId: row.companyId,
    moduleKey: row.moduleKey as ModuleKey,
    status: row.status as ModuleSubscriptionStatus,
    startDate: row.startDate,
    validUntil: row.validUntil ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapVisit(row: typeof t.clientVisits.$inferSelect): ClientVisit {
  return {
    id: row.id,
    companyId: row.companyId,
    onboardingProjectId: row.onboardingProjectId ?? undefined,
    postSalesProjectId: row.postSalesProjectId ?? undefined,
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt ?? undefined,
    endedAt: row.endedAt ?? undefined,
    status: row.status as ClientVisit["status"],
    visitType: row.visitType ?? undefined,
    purpose: row.purpose,
    location: row.location ?? undefined,
    assignedUserId: row.assignedUserId ?? undefined,
    contactName: row.contactName ?? undefined,
    contactPhone: row.contactPhone ?? undefined,
    outcome: row.outcome ?? undefined,
    remarks: row.remarks ?? undefined,
    notes: row.notes ?? undefined,
    nextAction: row.nextAction ?? undefined,
    nextFollowUpDate: row.nextFollowUpDate ?? undefined,
    createdByUserId: row.createdByUserId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCrmEvent(row: typeof t.crmEvents.$inferSelect): CrmEvent {
  return {
    id: row.id,
    companyId: row.companyId,
    entityType: row.entityType as CrmEvent["entityType"],
    taskId: row.taskId ?? undefined,
    visitId: row.visitId ?? undefined,
    subscriptionId: row.subscriptionId ?? undefined,
    eventType: row.eventType,
    actorUserId: row.actorUserId ?? undefined,
    actorName: row.actorName,
    remark: row.remark ?? undefined,
    oldValuesJson: row.oldValuesJson ?? undefined,
    newValuesJson: row.newValuesJson ?? undefined,
    progressPercent: row.progressPercent ?? undefined,
    dueDate: row.dueDate ?? undefined,
    createdAt: row.createdAt,
  };
}

/* ---------- Subscriptions ---------- */

export const listModuleSubscriptions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ companyId: z.string().optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const rows = data?.companyId
      ? db
          .select()
          .from(t.moduleSubscriptions)
          .where(eq(t.moduleSubscriptions.companyId, data.companyId))
          .all()
      : db.select().from(t.moduleSubscriptions).all();
    return rows.map(mapSubscription);
  });

export const listModuleSubscriptionEvents = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().optional(),
        subscriptionId: z.string().optional(),
        moduleKey: z.string().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    let rows = db
      .select()
      .from(t.moduleSubscriptionEvents)
      .orderBy(desc(t.moduleSubscriptionEvents.createdAt))
      .all();
    if (data?.subscriptionId) rows = rows.filter((r) => r.subscriptionId === data.subscriptionId);
    if (data?.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data?.moduleKey) rows = rows.filter((r) => r.moduleKey === data.moduleKey);
    return rows.map(
      (r): ModuleSubscriptionEvent => ({
        id: r.id,
        subscriptionId: r.subscriptionId,
        companyId: r.companyId,
        moduleKey: r.moduleKey as ModuleKey,
        previousStatus: (r.previousStatus as ModuleSubscriptionStatus) ?? undefined,
        newStatus: r.newStatus as ModuleSubscriptionStatus,
        previousStartDate: r.previousStartDate ?? undefined,
        newStartDate: r.newStartDate ?? undefined,
        previousValidUntil: r.previousValidUntil ?? undefined,
        newValidUntil: r.newValidUntil ?? undefined,
        actorUserId: r.actorUserId ?? undefined,
        actorName: r.actorName,
        reason: r.reason ?? undefined,
        createdAt: r.createdAt,
      }),
    );
  });

const subscriptionActionInput = z.object({
  companyId: z.string(),
  moduleKey: z.string(),
  status: z.enum(["inactive", "active", "paused", "expired", "cancelled"]),
  startDate: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  reason: z.string().optional(),
});

export const upsertModuleSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => subscriptionActionInput.parse(data))
  .handler(async ({ data }) => {
    const user = requirePermission("manageModuleSubscriptions");
    const db = getDb();
    const now = nowIso();
    const existing = db
      .select()
      .from(t.moduleSubscriptions)
      .where(
        and(
          eq(t.moduleSubscriptions.companyId, data.companyId),
          eq(t.moduleSubscriptions.moduleKey, data.moduleKey),
        ),
      )
      .get();

    const startDate = data.startDate || existing?.startDate || now.slice(0, 10);
    const validUntil = data.validUntil === undefined ? existing?.validUntil ?? null : data.validUntil;

    let id = existing?.id;
    if (existing) {
      db.update(t.moduleSubscriptions)
        .set({
          status: data.status,
          startDate,
          validUntil,
          notes: data.notes === undefined ? existing.notes : data.notes,
          updatedAt: now,
        })
        .where(eq(t.moduleSubscriptions.id, existing.id))
        .run();
    } else {
      id = newId();
      db.insert(t.moduleSubscriptions)
        .values({
          id,
          companyId: data.companyId,
          moduleKey: data.moduleKey,
          status: data.status,
          startDate,
          validUntil,
          notes: data.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    db.insert(t.moduleSubscriptionEvents)
      .values({
        id: newId(),
        subscriptionId: id!,
        companyId: data.companyId,
        moduleKey: data.moduleKey,
        previousStatus: existing?.status ?? null,
        newStatus: data.status,
        previousStartDate: existing?.startDate ?? null,
        newStartDate: startDate,
        previousValidUntil: existing?.validUntil ?? null,
        newValidUntil: validUntil,
        actorUserId: user.id,
        actorName: user.name,
        reason: data.reason ?? null,
        createdAt: now,
      })
      .run();

    writeCrmEvent({
      companyId: data.companyId,
      entityType: "subscription",
      subscriptionId: id,
      eventType: `subscription_${data.status}`,
      actorUserId: user.id,
      actorName: user.name,
      remark: data.reason,
      oldValues: existing
        ? { status: existing.status, startDate: existing.startDate, validUntil: existing.validUntil }
        : undefined,
      newValues: { status: data.status, startDate, validUntil },
    });

    // Keep optedIn in sync when activating — does not mark live.
    if (data.status === "active") {
      const mod = db
        .select()
        .from(t.companyModules)
        .where(
          and(
            eq(t.companyModules.companyId, data.companyId),
            eq(t.companyModules.moduleKey, data.moduleKey),
          ),
        )
        .get();
      if (mod && !mod.optedIn) {
        db.update(t.companyModules)
          .set({ optedIn: true, optedOnDate: mod.optedOnDate || startDate })
          .where(eq(t.companyModules.id, mod.id))
          .run();
      }
    }

    logActivity({
      who: user.name,
      what: `Module subscription ${data.moduleKey} → ${data.status}`,
      kind: "info",
      companyId: data.companyId,
    });

    return mapSubscription(
      db.select().from(t.moduleSubscriptions).where(eq(t.moduleSubscriptions.id, id!)).get()!,
    );
  });

/* ---------- Tasks ---------- */

export const listFollowUpTasks = createServerFn({ method: "GET" })
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
    void processTaskReminderAutomations(db, user.timezone || DEFAULT_BOOKING_TIMEZONE);
    void processTaskInAppReminders(db, user.timezone || DEFAULT_BOOKING_TIMEZONE);
    void processTaskWebPushReminders(db, user.timezone || DEFAULT_BOOKING_TIMEZONE);
    let rows = db
      .select()
      .from(t.followUpTasks)
      .where(eq(t.followUpTasks.productScope, CRM_SCOPE))
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

export const syncFollowUpTaskStatuses = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({}).optional().parse(data ?? {}))
  .handler(async () => {
    const user = requireUser();
    const db = getDb();
    const tz = user.timezone || DEFAULT_BOOKING_TIMEZONE;
    const updated = syncFollowUpTaskStatusesByTime(db, tz);
    await processTaskReminderAutomations(db, tz);
    processTaskInAppReminders(db, tz);
    await processTaskWebPushReminders(db, tz);
    return updated.filter((task) => task.productScope === CRM_SCOPE);
  });

export const getFollowUpTask = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const row = getDb().select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!row) throw new ApiError(404, "Task not found");
    assertCrmTaskRow(row);
    return mapTaskRow(row);
  });

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
  bookingAppointmentId: z.string().optional().nullable(),
  skipConflictCheck: z.boolean().optional(),
});

function assertNoScheduleConflicts(input: {
  userIds: string[];
  startsAt: string;
  endsAt: string;
  excludeTaskId?: string;
  excludeBookingId?: string;
}) {
  const conflicts = findScheduleConflicts({
    ...input,
    productScope: CRM_SCOPE,
    includeBookings: true,
  });
  if (conflicts.length > 0) {
    throw new ApiError(409, formatScheduleConflictMessage(conflicts[0]!));
  }
}

export const createFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => taskInput.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanManageFollowUpTask(user, data.companyId);
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
        excludeBookingId: data.bookingAppointmentId ?? undefined,
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
        bookingAppointmentId: data.bookingAppointmentId ?? null,
        productScope: CRM_SCOPE,
        createdByUserId: user.id,
        completedAt,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    writeCrmEvent({
      companyId: data.companyId,
      entityType: "task",
      taskId: id,
      eventType: "task_created",
      actorUserId: user.id,
      actorName: user.name,
      newValues: {
        title: data.title,
        status: data.status,
        taskType: data.taskType,
        dueDate: schedule.dueDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        assigneeUserId: primaryAssignee,
        assigneeUserIds: data.assigneeUserIds,
      },
      dueDate: schedule.dueDate ?? undefined,
    });
    logActivity({
      who: user.name,
      what: `Created follow-up task: ${data.title}`,
      kind: "info",
      companyId: data.companyId,
    });
    const tz = user.timezone || DEFAULT_BOOKING_TIMEZONE;
    processTaskInAppReminders(db, tz);
    void processTaskWebPushReminders(db, tz);
    void processTaskReminderAutomations(db, tz);
    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, id)).get()!);
  });

export const updateFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: taskInput.partial().extend({
          remark: z.string().optional(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertCrmTaskRow(existing);
    assertCanManageFollowUpTask(user, existing.companyId);
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
        excludeBookingId: existing.bookingAppointmentId ?? undefined,
      });
    }

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
        latestRemark: remark?.trim() ? remark.trim() : existing.latestRemark,
        assigneeUserId: primaryAssignee,
        assigneeUserIdsJson,
        completedAt,
        completedByUserId,
        updatedAt: now,
      })
      .where(eq(t.followUpTasks.id, data.id))
      .run();

    const eventType = remark
      ? "task_remark"
      : patch.status && patch.status !== existing.status
        ? `task_status_${patch.status}`
        : "task_updated";

    writeCrmEvent({
      companyId: existing.companyId,
      entityType: "task",
      taskId: data.id,
      eventType,
      actorUserId: user.id,
      actorName: user.name,
      remark,
      oldValues: {
        status: existing.status,
        dueDate: existing.dueDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        assigneeUserId: existing.assigneeUserId,
      },
      newValues: {
        status: nextStatus,
        dueDate: schedule.dueDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        assigneeUserId: primaryAssignee,
        completedAt,
      },
      dueDate: schedule.dueDate ?? undefined,
    });

    const tz = user.timezone || DEFAULT_BOOKING_TIMEZONE;
    processTaskInAppReminders(db, tz);
    void processTaskWebPushReminders(db, tz);
    void processTaskReminderAutomations(db, tz);
    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
  });

export const completeFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string(), remark: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertCrmTaskRow(existing);
    assertCanManageFollowUpTask(user, existing.companyId);
    const now = nowIso();
    db.update(t.followUpTasks)
      .set({
        status: "completed",
        progressPercent: 100,
        completedAt: now,
        completedByUserId: user.id,
        updatedAt: now,
      })
      .where(eq(t.followUpTasks.id, data.id))
      .run();
    writeCrmEvent({
      companyId: existing.companyId,
      entityType: "task",
      taskId: data.id,
      eventType: "task_status_completed",
      actorUserId: user.id,
      actorName: user.name,
      remark: data.remark,
      oldValues: { status: existing.status, completedAt: existing.completedAt },
      newValues: { status: "completed", completedAt: now, completedByUserId: user.id },
    });
    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
  });

export const checkTaskScheduleConflicts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        assigneeUserIds: z.array(z.string()).min(1),
        startsAt: z.string().min(10),
        endsAt: z.string().min(10),
        excludeTaskId: z.string().optional(),
        excludeBookingId: z.string().optional(),
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
      excludeBookingId: data.excludeBookingId,
      productScope: CRM_SCOPE,
      includeBookings: true,
    });
    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      message: conflicts[0] ? formatScheduleConflictMessage(conflicts[0]) : undefined,
    };
  });

export const cancelFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), reason: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertCrmTaskRow(existing);
    assertCanManageFollowUpTask(user, existing.companyId);
    db.update(t.followUpTasks)
      .set({ status: "cancelled", updatedAt: nowIso() })
      .where(eq(t.followUpTasks.id, data.id))
      .run();
    writeCrmEvent({
      companyId: existing.companyId,
      entityType: "task",
      taskId: data.id,
      eventType: "task_cancelled",
      actorUserId: user.id,
      actorName: user.name,
      remark: data.reason,
      oldValues: { status: existing.status },
      newValues: { status: "cancelled" },
    });
    return mapTaskRow(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
  });

export const deleteFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin"]);
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    assertCrmTaskRow(existing);

    writeCrmEvent({
      companyId: existing.companyId,
      entityType: "task",
      taskId: data.id,
      eventType: "task_deleted",
      actorUserId: user.id,
      actorName: user.name,
      oldValues: {
        title: existing.title,
        status: existing.status,
        dueDate: existing.dueDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
      },
    });

    db.delete(t.automationRemindersSent)
      .where(eq(t.automationRemindersSent.taskId, data.id))
      .run();
    db.delete(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).run();

    return { ok: true as const, id: data.id };
  });

/* ---------- Visits ---------- */

export const listClientVisits = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().optional(),
        status: z.string().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    let rows = db.select().from(t.clientVisits).orderBy(desc(t.clientVisits.scheduledAt)).all();
    if (data?.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data?.status) rows = rows.filter((r) => r.status === data.status);
    return rows.map(mapVisit);
  });

export const getClientVisit = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const row = getDb().select().from(t.clientVisits).where(eq(t.clientVisits.id, data.id)).get();
    if (!row) throw new ApiError(404, "Visit not found");
    return mapVisit(row);
  });

const visitInput = z.object({
  id: z.string().optional(),
  companyId: z.string(),
  onboardingProjectId: z.string().optional().nullable(),
  postSalesProjectId: z.string().optional().nullable(),
  scheduledAt: z.string(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  visitType: z.string().optional().nullable(),
  purpose: z.string().min(1),
  location: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
});

export const createClientVisit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => visitInput.parse(data))
  .handler(async ({ data }) => {
    const user = requirePermission("manageClientVisits");
    const db = getDb();
    const id = data.id ?? newId();
    const now = nowIso();
    db.insert(t.clientVisits)
      .values({
        id,
        companyId: data.companyId,
        onboardingProjectId: data.onboardingProjectId ?? null,
        postSalesProjectId: data.postSalesProjectId ?? null,
        scheduledAt: data.scheduledAt,
        startedAt: data.startedAt ?? null,
        endedAt: data.endedAt ?? null,
        status: data.status,
        visitType: data.visitType ?? null,
        purpose: data.purpose,
        location: data.location ?? null,
        assignedUserId: data.assignedUserId ?? null,
        contactName: data.contactName ?? null,
        contactPhone: data.contactPhone ?? null,
        outcome: data.outcome ?? null,
        remarks: data.remarks ?? null,
        notes: data.notes ?? null,
        nextAction: data.nextAction ?? null,
        nextFollowUpDate: data.nextFollowUpDate ?? null,
        createdByUserId: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    writeCrmEvent({
      companyId: data.companyId,
      entityType: "visit",
      visitId: id,
      eventType: "visit_scheduled",
      actorUserId: user.id,
      actorName: user.name,
      newValues: {
        purpose: data.purpose,
        scheduledAt: data.scheduledAt,
        status: data.status,
      },
    });
    logActivity({
      who: user.name,
      what: `Logged client visit: ${data.purpose}`,
      kind: "info",
      companyId: data.companyId,
    });
    return mapVisit(db.select().from(t.clientVisits).where(eq(t.clientVisits.id, id)).get()!);
  });

export const updateClientVisit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), patch: visitInput.partial() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requirePermission("manageClientVisits");
    const db = getDb();
    const existing = db.select().from(t.clientVisits).where(eq(t.clientVisits.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Visit not found");
    const p = data.patch;
    const nextStatus = p.status ?? existing.status;
    db.update(t.clientVisits)
      .set({
        scheduledAt: p.scheduledAt ?? existing.scheduledAt,
        startedAt: p.startedAt !== undefined ? p.startedAt : existing.startedAt,
        endedAt: p.endedAt !== undefined ? p.endedAt : existing.endedAt,
        status: nextStatus,
        visitType: p.visitType !== undefined ? p.visitType : existing.visitType,
        purpose: p.purpose ?? existing.purpose,
        location: p.location !== undefined ? p.location : existing.location,
        assignedUserId: p.assignedUserId !== undefined ? p.assignedUserId : existing.assignedUserId,
        contactName: p.contactName !== undefined ? p.contactName : existing.contactName,
        contactPhone: p.contactPhone !== undefined ? p.contactPhone : existing.contactPhone,
        outcome: p.outcome !== undefined ? p.outcome : existing.outcome,
        remarks: p.remarks !== undefined ? p.remarks : existing.remarks,
        notes: p.notes !== undefined ? p.notes : existing.notes,
        nextAction: p.nextAction !== undefined ? p.nextAction : existing.nextAction,
        nextFollowUpDate:
          p.nextFollowUpDate !== undefined ? p.nextFollowUpDate : existing.nextFollowUpDate,
        onboardingProjectId:
          p.onboardingProjectId !== undefined ? p.onboardingProjectId : existing.onboardingProjectId,
        postSalesProjectId:
          p.postSalesProjectId !== undefined ? p.postSalesProjectId : existing.postSalesProjectId,
        updatedAt: nowIso(),
      })
      .where(eq(t.clientVisits.id, data.id))
      .run();

    const eventType =
      p.status && p.status !== existing.status
        ? `visit_${p.status}`
        : p.scheduledAt && p.scheduledAt !== existing.scheduledAt
          ? "visit_rescheduled"
          : "visit_updated";

    writeCrmEvent({
      companyId: existing.companyId,
      entityType: "visit",
      visitId: data.id,
      eventType,
      actorUserId: user.id,
      actorName: user.name,
      remark: p.remarks ?? undefined,
      oldValues: { status: existing.status, scheduledAt: existing.scheduledAt, outcome: existing.outcome },
      newValues: {
        status: nextStatus,
        scheduledAt: p.scheduledAt ?? existing.scheduledAt,
        outcome: p.outcome !== undefined ? p.outcome : existing.outcome,
      },
    });

    return mapVisit(db.select().from(t.clientVisits).where(eq(t.clientVisits.id, data.id)).get()!);
  });

/* ---------- CRM events ---------- */

export const listCrmEvents = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().optional(),
        taskId: z.string().optional(),
        visitId: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    let rows = db.select().from(t.crmEvents).orderBy(desc(t.crmEvents.createdAt)).all();
    if (data.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data.taskId) rows = rows.filter((r) => r.taskId === data.taskId);
    if (data.visitId) rows = rows.filter((r) => r.visitId === data.visitId);
    const limit = data.limit ?? 100;
    return rows.slice(0, limit).map(mapCrmEvent);
  });

export const getCrmDashboardSummary = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const db = getDb();
  const today = nowIso().slice(0, 10);
  const tasks = db.select().from(t.followUpTasks).all();
  const visits = db.select().from(t.clientVisits).all();
  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "blocked");
  const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = openTasks.filter((t) => t.dueDate === today);
  const upcomingVisits = visits.filter(
    (v) => v.status === "scheduled" && v.scheduledAt.slice(0, 10) >= today,
  );
  return {
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    tasksDueToday: dueToday.length,
    upcomingVisits: upcomingVisits.length,
    totalVisits: visits.length,
    completedVisits: visits.filter((v) => v.status === "completed").length,
  };
});
