import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { logActivity } from "@/server/api/mappers";
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

function mapTask(row: typeof t.followUpTasks.$inferSelect): FollowUpTask {
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
    assigneeUserId: row.assigneeUserId ?? undefined,
    createdByUserId: row.createdByUserId ?? undefined,
    completedAt: row.completedAt ?? undefined,
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
    requireUser();
    const db = getDb();
    let rows = db.select().from(t.followUpTasks).orderBy(desc(t.followUpTasks.updatedAt)).all();
    if (data?.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data?.status) rows = rows.filter((r) => r.status === data.status);
    if (data?.assigneeUserId) rows = rows.filter((r) => r.assigneeUserId === data.assigneeUserId);
    return rows.map(mapTask);
  });

export const getFollowUpTask = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const row = getDb().select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!row) throw new ApiError(404, "Task not found");
    return mapTask(row);
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
  assigneeUserId: z.string().optional().nullable(),
});

export const createFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => taskInput.parse(data))
  .handler(async ({ data }) => {
    const user = requirePermission("manageTasks");
    const db = getDb();
    const id = data.id ?? newId();
    const now = nowIso();
    const completedAt = data.status === "completed" ? now : null;
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
        dueDate: data.dueDate ?? null,
        assigneeUserId: data.assigneeUserId ?? null,
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
        priority: data.priority,
        dueDate: data.dueDate,
        assigneeUserId: data.assigneeUserId,
      },
      progressPercent: data.progressPercent,
      dueDate: data.dueDate ?? undefined,
    });
    logActivity({
      who: user.name,
      what: `Created follow-up task: ${data.title}`,
      kind: "info",
      companyId: data.companyId,
    });
    return mapTask(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, id)).get()!);
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
    const user = requirePermission("manageTasks");
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
    const { remark, ...patch } = data.patch;
    const now = nowIso();
    const nextStatus = patch.status ?? existing.status;
    const completedAt =
      nextStatus === "completed"
        ? existing.completedAt || now
        : nextStatus === "cancelled"
          ? existing.completedAt
          : null;

    db.update(t.followUpTasks)
      .set({
        title: patch.title ?? existing.title,
        description: patch.description !== undefined ? patch.description : existing.description,
        status: nextStatus,
        priority: patch.priority ?? existing.priority,
        progressPercent: patch.progressPercent ?? existing.progressPercent,
        dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
        assigneeUserId:
          patch.assigneeUserId !== undefined ? patch.assigneeUserId : existing.assigneeUserId,
        onboardingProjectId:
          patch.onboardingProjectId !== undefined
            ? patch.onboardingProjectId
            : existing.onboardingProjectId,
        postSalesProjectId:
          patch.postSalesProjectId !== undefined
            ? patch.postSalesProjectId
            : existing.postSalesProjectId,
        completedAt,
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
        progressPercent: existing.progressPercent,
        dueDate: existing.dueDate,
        assigneeUserId: existing.assigneeUserId,
      },
      newValues: {
        status: nextStatus,
        progressPercent: patch.progressPercent ?? existing.progressPercent,
        dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
        assigneeUserId:
          patch.assigneeUserId !== undefined ? patch.assigneeUserId : existing.assigneeUserId,
      },
      progressPercent: patch.progressPercent ?? existing.progressPercent,
      dueDate: (patch.dueDate !== undefined ? patch.dueDate : existing.dueDate) ?? undefined,
    });

    return mapTask(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
  });

export const cancelFollowUpTask = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), reason: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requirePermission("manageTasks");
    const db = getDb();
    const existing = db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Task not found");
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
    return mapTask(db.select().from(t.followUpTasks).where(eq(t.followUpTasks.id, data.id)).get()!);
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
