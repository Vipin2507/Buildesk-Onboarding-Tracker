import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { DPR_CATEGORY_SUBCATEGORIES, isValidDprCategory, isValidDprSubcategory } from "@/data/dpr-catalog";
import { roleHasPermission } from "@/lib/permissions";
import { loadServerRoles } from "@/server/auth/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { remindDprExecutives } from "@/server/dpr-compliance-remind";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  assertCanEditDprEntry,
  assertCanManageDpr,
  assertCanViewDprTracker,
  listExpectedDprExecutives,
} from "@/server/lib/dpr-access";
import {
  hydrateDprEntries,
  isFollowUpOverdue,
  mapDprTemplate,
  todayIsoDate,
} from "@/server/lib/dpr-map";
import { ensureDprTemplatesSeeded } from "@/server/lib/dpr-seed";
import { DPR_PRIORITIES, DPR_STATUSES, type DprComplianceRow, type DprSummary } from "@/types/dpr";

const statusSchema = z.enum(DPR_STATUSES);
const prioritySchema = z.enum(DPR_PRIORITIES);

const listFiltersSchema = z.object({
  executiveId: z.string().optional(),
  executiveIds: z.array(z.string()).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  clientId: z.string().optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  entryDate: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(500).optional().default(100),
  sortBy: z.enum(["entryDate", "priority", "status", "updatedAt"]).optional().default("entryDate"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

function userCanViewDprTracker(user: ReturnType<typeof requireUser>) {
  if (user.role === "Admin") return true;
  return roleHasPermission(loadServerRoles(), user.role, "viewDprTracker");
}

function assertCategorySubcategory(category: string, subcategory: string) {
  if (!isValidDprCategory(category)) throw new ApiError(400, "Invalid DPR category");
  if (!isValidDprSubcategory(category, subcategory)) {
    throw new ApiError(400, "Invalid subcategory for category");
  }
}

function submissionFor(db: ReturnType<typeof getDb>, executiveId: string, entryDate: string) {
  return db
    .select()
    .from(t.dprSubmissions)
    .where(and(eq(t.dprSubmissions.executiveId, executiveId), eq(t.dprSubmissions.entryDate, entryDate)))
    .get();
}

function assertCanAddEntry(db: ReturnType<typeof getDb>, executiveId: string, entryDate: string) {
  if (submissionFor(db, executiveId, entryDate)) {
    throw new ApiError(409, "DPR already submitted for this date — no new tasks can be added");
  }
}

function priorityRank(p: string) {
  if (p === "High") return 3;
  if (p === "Medium") return 2;
  return 1;
}

function filterAndSortEntries(
  rows: typeof t.dprEntries.$inferSelect[],
  filters: z.infer<typeof listFiltersSchema>,
) {
  let out = [...rows];
  if (filters.executiveId) out = out.filter((r) => r.executiveId === filters.executiveId);
  if (filters.executiveIds?.length) {
    const set = new Set(filters.executiveIds);
    out = out.filter((r) => set.has(r.executiveId));
  }
  if (filters.category) out = out.filter((r) => r.category === filters.category);
  if (filters.subcategory) out = out.filter((r) => r.subcategory === filters.subcategory);
  if (filters.clientId) out = out.filter((r) => r.clientId === filters.clientId);
  if (filters.status) out = out.filter((r) => r.status === filters.status);
  if (filters.priority) out = out.filter((r) => r.priority === filters.priority);
  if (filters.entryDate) out = out.filter((r) => r.entryDate === filters.entryDate.slice(0, 10));
  if (filters.dateFrom) {
    const from = filters.dateFrom.slice(0, 10);
    out = out.filter((r) => r.entryDate >= from);
  }
  if (filters.dateTo) {
    const to = filters.dateTo.slice(0, 10);
    out = out.filter((r) => r.entryDate <= to);
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.taskName.toLowerCase().includes(q) ||
        (r.clientNameFreeText?.toLowerCase().includes(q) ?? false) ||
        (r.taskDescription?.toLowerCase().includes(q) ?? false),
    );
  }

  const dir = filters.sortDir === "asc" ? 1 : -1;
  out.sort((a, b) => {
    if (filters.sortBy === "priority") {
      return (priorityRank(a.priority) - priorityRank(b.priority)) * dir;
    }
    if (filters.sortBy === "status") {
      return a.status.localeCompare(b.status) * dir;
    }
    if (filters.sortBy === "updatedAt") {
      return a.updatedAt.localeCompare(b.updatedAt) * dir;
    }
    return a.entryDate.localeCompare(b.entryDate) * dir;
  });

  const total = out.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 100;
  const start = (page - 1) * pageSize;
  return { rows: out.slice(start, start + pageSize), total, page, pageSize };
}

function computeSummary(rows: typeof t.dprEntries.$inferSelect[]): DprSummary {
  const totalEntries = rows.length;
  const completedCount = rows.filter((r) => r.status === "Completed").length;
  const pendingCount = rows.filter((r) => r.status === "Pending").length;
  const inProgressCount = rows.filter((r) => r.status === "In Progress").length;
  const overdueFollowUpCount = rows.filter((r) =>
    isFollowUpOverdue(r.nextFollowUpDate, r.status),
  ).length;
  const highPriorityOpenCount = rows.filter(
    (r) => r.priority === "High" && r.status !== "Completed",
  ).length;
  const completionRatePercent =
    totalEntries === 0 ? 100 : Math.round((completedCount / totalEntries) * 100);
  return {
    totalEntries,
    completedCount,
    pendingCount,
    inProgressCount,
    overdueFollowUpCount,
    completionRatePercent,
    highPriorityOpenCount,
    loggedTodayCount: totalEntries,
  };
}

export const getDprCategories = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return DPR_CATEGORY_SUBCATEGORIES;
});

export const listDprTemplates = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        category: z.string().optional(),
        subcategory: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    ensureDprTemplatesSeeded(db);
    let templates = db.select().from(t.dprTaskTemplates).all();
    if (data.category) templates = templates.filter((x) => x.category === data.category);
    if (data.subcategory) templates = templates.filter((x) => x.subcategory === data.subcategory);
    const steps = db.select().from(t.dprTemplateSteps).all();
    return templates.map((tpl) => mapDprTemplate(tpl, steps));
  });

export const listDprEntries = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listFiltersSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    ensureDprTemplatesSeeded(db);

    const isTracker = userCanViewDprTracker(user);

    if (!isTracker) {
      assertCanManageDpr();
      data = { ...data, executiveId: user.id };
    }

    let rows = db.select().from(t.dprEntries).orderBy(desc(t.dprEntries.updatedAt)).all();

    if (!isTracker) {
      rows = rows.filter((r) => r.executiveId === user.id);
    }

    const { rows: pageRows, total, page, pageSize } = filterAndSortEntries(rows, data);
    return {
      items: hydrateDprEntries(pageRows),
      total,
      page,
      pageSize,
    };
  });

export const createDprEntryInputSchema = z.object({
  executiveId: z.string().optional(),
  entryDate: z.string(),
  category: z.string(),
  subcategory: z.string(),
  clientId: z.string().nullable().optional(),
  clientNameFreeText: z.string().nullable().optional(),
  taskName: z.string().min(1),
  taskDescription: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  status: statusSchema.optional().default("Pending"),
  priority: prioritySchema.optional().default("Medium"),
  startTime: z.string().optional(),
  endTime: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  pendingReason: z.string().nullable().optional(),
  nextFollowUpDate: z.string().nullable().optional(),
});

function validatePendingFields(status: string, pendingReason?: string | null) {
  if (status === "Pending" && !pendingReason?.trim()) {
    throw new ApiError(400, "pendingReason is required when status is Pending");
  }
}

export const createDprEntry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createDprEntryInputSchema.parse(data))
  .handler(async ({ data }) => {
    const user = assertCanManageDpr();
    const db = getDb();
    assertCategorySubcategory(data.category, data.subcategory);

    const executiveId = data.executiveId && user.role === "Admin" ? data.executiveId : user.id;
    const entryDate = data.entryDate.slice(0, 10);
    assertCanAddEntry(db, executiveId, entryDate);

    const status = data.status ?? "Pending";
    validatePendingFields(status, data.pendingReason);

    if (data.clientId) {
      const company = db.select().from(t.companies).where(eq(t.companies.id, data.clientId)).get();
      if (!company) throw new ApiError(400, "Client company not found");
    }

    const now = nowIso();
    const startTime = data.startTime || now;
    let completionDate: string | null = null;
    let endTime = data.endTime ?? null;
    if (status === "Completed") {
      completionDate = entryDate;
      endTime = endTime || now;
    }

    const id = newId();
    db.insert(t.dprEntries)
      .values({
        id,
        executiveId,
        entryDate,
        category: data.category,
        subcategory: data.subcategory,
        clientId: data.clientId ?? null,
        clientNameFreeText: data.clientNameFreeText?.trim() || null,
        taskName: data.taskName.trim(),
        taskDescription: data.taskDescription?.trim() || null,
        assignedTo: data.assignedTo ?? executiveId,
        status,
        priority: data.priority ?? "Medium",
        startTime,
        endTime,
        remarks: data.remarks?.trim() || null,
        pendingReason: status === "Pending" ? pendingReasonTrim(data.pendingReason) : null,
        nextFollowUpDate: data.nextFollowUpDate?.slice(0, 10) || null,
        completionDate,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const row = db.select().from(t.dprEntries).where(eq(t.dprEntries.id, id)).get()!;
    return hydrateDprEntries([row])[0]!;
  });

function pendingReasonTrim(v?: string | null) {
  const t = v?.trim();
  if (!t) throw new ApiError(400, "pendingReason is required when status is Pending");
  return t;
}

export const createDprFromTemplateInputSchema = z.object({
  templateId: z.string(),
  clientId: z.string().nullable().optional(),
  clientNameFreeText: z.string().nullable().optional(),
  executiveId: z.string().optional(),
  entryDate: z.string(),
});

export const createDprEntriesFromTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createDprFromTemplateInputSchema.parse(data))
  .handler(async ({ data }) => {
    const user = assertCanManageDpr();
    const db = getDb();
    ensureDprTemplatesSeeded(db);

    const tpl = db.select().from(t.dprTaskTemplates).where(eq(t.dprTaskTemplates.id, data.templateId)).get();
    if (!tpl) throw new ApiError(404, "Template not found");

    const executiveId = data.executiveId && user.role === "Admin" ? data.executiveId : user.id;
    const entryDate = data.entryDate.slice(0, 10);
    assertCanAddEntry(db, executiveId, entryDate);

    if (data.clientId) {
      const company = db.select().from(t.companies).where(eq(t.companies.id, data.clientId)).get();
      if (!company) throw new ApiError(400, "Client company not found");
    }

    const steps = db
      .select()
      .from(t.dprTemplateSteps)
      .where(eq(t.dprTemplateSteps.templateId, tpl.id))
      .all()
      .sort((a, b) => a.stepOrder - b.stepOrder);

    if (steps.length === 0) throw new ApiError(400, "Template has no steps");

    const now = nowIso();
    const createdIds: string[] = [];
    for (const step of steps) {
      const id = newId();
      db.insert(t.dprEntries)
        .values({
          id,
          executiveId,
          entryDate,
          category: tpl.category,
          subcategory: tpl.subcategory,
          clientId: data.clientId ?? null,
          clientNameFreeText: data.clientNameFreeText?.trim() || null,
          taskName: step.stepName,
          taskDescription: tpl.description,
          assignedTo: executiveId,
          status: "Pending",
          priority: "Medium",
          startTime: now,
          endTime: null,
          remarks: null,
          pendingReason: "Checklist step not started",
          nextFollowUpDate: null,
          completionDate: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      createdIds.push(id);
    }

    const rows = db
      .select()
      .from(t.dprEntries)
      .all()
      .filter((r) => createdIds.includes(r.id));
    return hydrateDprEntries(rows);
  });

export const updateDprEntryInputSchema = z.object({
  id: z.string(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  remarks: z.string().nullable().optional(),
  startTime: z.string().optional(),
  endTime: z.string().nullable().optional(),
  pendingReason: z.string().nullable().optional(),
  nextFollowUpDate: z.string().nullable().optional(),
  taskDescription: z.string().nullable().optional(),
});

export type CreateDprEntryInput = z.infer<typeof createDprEntryInputSchema>;
export type CreateDprFromTemplateInput = z.infer<typeof createDprFromTemplateInputSchema>;
export type UpdateDprEntryInput = z.infer<typeof updateDprEntryInputSchema>;

export const updateDprEntry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateDprEntryInputSchema.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db.select().from(t.dprEntries).where(eq(t.dprEntries.id, data.id)).get();
    if (!row) throw new ApiError(404, "DPR entry not found");
    assertCanEditDprEntry(row, user);

    const submitted = submissionFor(db, row.executiveId, row.entryDate);
    if (submitted && row.status === "Completed" && user.role !== "Admin") {
      throw new ApiError(409, "This entry is locked after DPR submission");
    }

    const nextStatus = data.status ?? row.status;
    if (nextStatus === "Pending") {
      const reason = data.pendingReason !== undefined ? data.pendingReason : row.pendingReason;
      validatePendingFields("Pending", reason);
    }

    const now = nowIso();
    let completionDate = row.completionDate;
    let endTime = data.endTime !== undefined ? data.endTime : row.endTime;

    if (data.status === "Completed" && row.status !== "Completed") {
      completionDate = row.entryDate;
      endTime = endTime || now;
    }
    if (data.status && data.status !== "Completed") {
      completionDate = null;
    }

    db.update(t.dprEntries)
      .set({
        status: nextStatus,
        priority: data.priority ?? row.priority,
        remarks: data.remarks !== undefined ? data.remarks?.trim() || null : row.remarks,
        startTime: data.startTime ?? row.startTime,
        endTime,
        pendingReason:
          nextStatus === "Pending"
            ? pendingReasonTrim(
                data.pendingReason !== undefined ? data.pendingReason : row.pendingReason,
              )
            : null,
        nextFollowUpDate:
          data.nextFollowUpDate !== undefined
            ? data.nextFollowUpDate?.slice(0, 10) || null
            : row.nextFollowUpDate,
        taskDescription:
          data.taskDescription !== undefined
            ? data.taskDescription?.trim() || null
            : row.taskDescription,
        completionDate,
        updatedAt: now,
      })
      .where(eq(t.dprEntries.id, data.id))
      .run();

    const updated = db.select().from(t.dprEntries).where(eq(t.dprEntries.id, data.id)).get()!;
    return hydrateDprEntries([updated])[0]!;
  });

export const getDprSummary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listFiltersSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    let rows = db.select().from(t.dprEntries).all();

    const canTracker = userCanViewDprTracker(user);
    if (!canTracker) {
      assertCanManageDpr();
      data = { ...data, executiveId: user.id };
    }

    const { rows: filtered } = filterAndSortEntries(rows, { ...data, page: 1, pageSize: 100_000 });
    return computeSummary(filtered);
  });

export const getDprCompliance = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ date: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    assertCanViewDprTracker();
    const db = getDb();
    const date = data.date?.slice(0, 10) || todayIsoDate();
    const expected = listExpectedDprExecutives(db);
    const entries = db.select().from(t.dprEntries).where(eq(t.dprEntries.entryDate, date)).all();

    const countByExec = new Map<string, number>();
    for (const e of entries) {
      countByExec.set(e.executiveId, (countByExec.get(e.executiveId) ?? 0) + 1);
    }

    const rows: DprComplianceRow[] = expected.map((u) => ({
      executiveId: u.id,
      name: u.name,
      role: u.role,
      hasSubmitted: (countByExec.get(u.id) ?? 0) > 0,
      entryCount: countByExec.get(u.id) ?? 0,
    }));

    return { date, executives: rows };
  });

export const remindDprCompliance = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        executiveIds: z.array(z.string()).min(1),
        date: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    assertCanViewDprTracker();
    return remindDprExecutives(data.executiveIds, data.date);
  });

export const submitDprDay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ entryDate: z.string(), executiveId: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = assertCanManageDpr();
    const db = getDb();
    const executiveId = data.executiveId && user.role === "Admin" ? data.executiveId : user.id;
    const entryDate = data.entryDate.slice(0, 10);

    const existing = submissionFor(db, executiveId, entryDate);
    if (existing) return { ok: true as const, submittedAt: existing.submittedAt };

    const entries = db
      .select()
      .from(t.dprEntries)
      .where(and(eq(t.dprEntries.executiveId, executiveId), eq(t.dprEntries.entryDate, entryDate)))
      .all();
    if (entries.length === 0) {
      throw new ApiError(400, "Log at least one task before submitting your DPR");
    }

    const pendingInvalid = entries.filter(
      (e) => e.status === "Pending" && !e.pendingReason?.trim(),
    );
    if (pendingInvalid.length > 0) {
      throw new ApiError(400, "All Pending tasks must include a pending reason before submit");
    }

    const now = nowIso();
    const id = newId();
    db.insert(t.dprSubmissions)
      .values({
        id,
        executiveId,
        entryDate,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return { ok: true as const, submittedAt: now };
  });

export const getDprDaySubmission = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        entryDate: z.string(),
        executiveId: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const executiveId = data.executiveId && user.role === "Admin" ? data.executiveId : user.id;
    const entryDate = data.entryDate.slice(0, 10);
    const row = submissionFor(db, executiveId, entryDate);
    return row ? { submitted: true as const, submittedAt: row.submittedAt } : { submitted: false as const };
  });
