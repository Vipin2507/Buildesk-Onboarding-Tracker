import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { loadCompanies, loadProjects } from "@/server/api/mappers";
import { isTicketOpen, mapTicket, mapTicketActivity } from "@/lib/tickets";
import type { TicketActivity } from "@/types";

const ticketStatus = z.enum([
  "Open",
  "In Progress",
  "Pending",
  "Resolved",
  "Closed",
  // Legacy lifecycle values remain readable/editable.
  "New",
  "Assigned",
  "QA",
  "Ready for Release",
  "Released",
]);

const ticketType = z.enum([
  "Bug",
  "Feature Request",
  "Customization",
  "Enhancement",
  "Requirement",
  "Other",
]);

const ticketInput = z.object({
  id: z.string().optional(),
  type: ticketType,
  title: z.string().min(1),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  status: ticketStatus,
  raisedOn: z.string(),
  eta: z.string().default(""),
  developerId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  description: z.string().optional(),
  assignedUserId: z.string().optional().nullable(),
  actionTaken: z.string().optional(),
  backendAssigned: z.boolean().optional(),
  backendAssigneeId: z.string().optional().nullable(),
  backendForwardedAt: z.string().optional().nullable(),
  resolutionStatus: z.enum(["Resolved", "Not Resolved"]).optional(),
  resolutionAt: z.string().optional().nullable(),
  etaRevisedAt: z.string().optional().nullable(),
  resolutionNotes: z.string().optional(),
});

function addTicketActivity(
  db: ReturnType<typeof getDb>,
  input: Omit<TicketActivity, "id" | "createdAt">,
) {
  db.insert(t.ticketActivities)
    .values({
      ...input,
      id: newId(),
      actorUserId: input.actorUserId ?? null,
      remark: input.remark ?? null,
      oldValuesJson: input.oldValuesJson ?? null,
      newValuesJson: input.newValuesJson ?? null,
      createdAt: nowIso(),
    })
    .run();
}

export const listTickets = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb()
    .select()
    .from(t.tickets)
    .orderBy(asc(t.tickets.id))
    .all()
    .map((row) => mapTicket(row as Record<string, unknown>));
});

export const getTicket = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const row = getDb().select().from(t.tickets).where(eq(t.tickets.id, data.id)).get();
    if (!row) throw new ApiError(404, "Ticket not found");
    return mapTicket(row as Record<string, unknown>);
  });

export const listTicketActivities = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ ticketId: z.string().optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const rows = getDb()
      .select()
      .from(t.ticketActivities)
      .orderBy(desc(t.ticketActivities.createdAt))
      .all();
    return (data?.ticketId ? rows.filter((row) => row.ticketId === data.ticketId) : rows).map(
      (row) => mapTicketActivity(row as Record<string, unknown>),
    );
  });

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ticketInput.parse(data))
  .handler(async ({ data }) => {
    const user = requirePermission("manageTickets");
    const now = nowIso();
    const { id: clientId, ...input } = data;
    const id = clientId ?? `TKT-${newId().slice(0, 8).toUpperCase()}`;
    const resolutionStatus =
      input.status === "Resolved" || input.status === "Closed"
        ? "Resolved"
        : input.resolutionStatus ?? "Not Resolved";
    const resolutionAt =
      resolutionStatus === "Resolved" ? input.resolutionAt || now : null;
    const db = getDb();
    const values = {
      id,
      type: input.type,
      title: input.title,
      priority: input.priority,
      status: input.status,
      raisedOn: input.raisedOn,
      eta: input.eta || "",
      developerId: input.developerId || null,
      companyId: input.companyId || null,
      projectId: input.projectId || null,
      assignedUserId: input.assignedUserId || null,
      description: input.description ?? "",
      actionTaken: input.actionTaken ?? "",
      backendAssigned: Boolean(input.backendAssigned),
      backendAssigneeId: input.backendAssigneeId || null,
      backendForwardedAt: input.backendAssigned ? input.backendForwardedAt || now : null,
      resolutionStatus,
      resolutionAt,
      etaRevisedAt: input.etaRevisedAt || null,
      resolutionNotes: input.resolutionNotes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    db.insert(t.tickets).values(values).run();
    addTicketActivity(db, {
      ticketId: id,
      eventType: "ticket_created",
      actorUserId: user.id,
      actorName: user.name,
      newValuesJson: JSON.stringify({ ...input, resolutionStatus, resolutionAt }),
    });
    return mapTicket(
      db.select().from(t.tickets).where(eq(t.tickets.id, id)).get()! as Record<string, unknown>,
    );
  });

export const updateTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: ticketInput.partial().extend({ updateRemark: z.string().optional() }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requirePermission("manageTickets");
    const db = getDb();
    const existing = db.select().from(t.tickets).where(eq(t.tickets.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Ticket not found");
    const { updateRemark, id: _ignoredId, ...requested } = data.patch;
    const now = nowIso();
    const etaChanged = requested.eta !== undefined && requested.eta !== existing.eta;
    const backendJustAssigned =
      requested.backendAssigned === true && !existing.backendAssigned;
    const status = requested.status ?? existing.status;
    const isResolved = status === "Resolved" || status === "Closed";
    const patch = {
      ...requested,
      developerId:
        requested.developerId === undefined ? existing.developerId : requested.developerId || null,
      companyId:
        requested.companyId === undefined ? existing.companyId : requested.companyId || null,
      projectId:
        requested.projectId === undefined ? existing.projectId : requested.projectId || null,
      assignedUserId:
        requested.assignedUserId === undefined
          ? existing.assignedUserId
          : requested.assignedUserId || null,
      backendAssigneeId:
        requested.backendAssigneeId === undefined
          ? existing.backendAssigneeId
          : requested.backendAssigneeId || null,
      backendForwardedAt:
        requested.backendAssigned === false
          ? null
          : backendJustAssigned
            ? requested.backendForwardedAt || now
            : requested.backendForwardedAt === undefined
              ? existing.backendForwardedAt
              : requested.backendForwardedAt || null,
      etaRevisedAt: etaChanged ? now : requested.etaRevisedAt ?? existing.etaRevisedAt,
      resolutionStatus: isResolved
        ? "Resolved"
        : requested.resolutionStatus ?? existing.resolutionStatus,
      resolutionAt: isResolved
        ? existing.resolutionAt || requested.resolutionAt || now
        : requested.resolutionStatus === "Not Resolved"
          ? null
          : requested.resolutionAt === undefined
            ? existing.resolutionAt
            : requested.resolutionAt || null,
      updatedAt: now,
    };
    const changedKeys = Object.keys(requested).filter(
      (key) =>
        key !== "id" &&
        requested[key as keyof typeof requested] !==
          existing[key as keyof typeof existing],
    );
    const eventType = updateRemark
      ? "ticket_follow_up"
      : etaChanged
        ? "ticket_eta_revised"
        : requested.status && requested.status !== existing.status
          ? "ticket_status_changed"
          : backendJustAssigned
            ? "ticket_forwarded_backend"
            : "ticket_updated";
    db.update(t.tickets).set(patch).where(eq(t.tickets.id, data.id)).run();
    addTicketActivity(db, {
      ticketId: data.id,
      eventType,
      actorUserId: user.id,
      actorName: user.name,
      remark: updateRemark,
      oldValuesJson: JSON.stringify(
        Object.fromEntries(changedKeys.map((key) => [key, existing[key as keyof typeof existing]])),
      ),
      newValuesJson: JSON.stringify(
        Object.fromEntries(changedKeys.map((key) => [key, patch[key as keyof typeof patch]])),
      ),
    });
    return mapTicket(
      db.select().from(t.tickets).where(eq(t.tickets.id, data.id)).get()! as Record<
        string,
        unknown
      >,
    );
  });

export const deleteTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requirePermission("manageTickets");
    getDb().delete(t.tickets).where(eq(t.tickets.id, data.id)).run();
    return { ok: true };
  });

export const listTraining = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.trainingSessions).all();
});

export const createTraining = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        type: z.string(),
        trainerId: z.string(),
        companyId: z.string(),
        date: z.string(),
        attendance: z.string(),
        recording: z.string(),
        status: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const now = nowIso();
    const { id: clientId, ...rest } = data;
    const id = clientId ?? newId();
    getDb()
      .insert(t.trainingSessions)
      .values({ id, ...rest, createdAt: now, updatedAt: now })
      .run();
    return { id, ...rest, createdAt: now, updatedAt: now };
  });

export const updateTraining = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), patch: z.record(z.any()) }).parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb()
      .update(t.trainingSessions)
      .set({ ...data.patch, updatedAt: nowIso() })
      .where(eq(t.trainingSessions.id, data.id))
      .run();
    return { ok: true };
  });

export const deleteTraining = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb().delete(t.trainingSessions).where(eq(t.trainingSessions.id, data.id)).run();
    return { ok: true };
  });

export const getVendorBundle = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const db = getDb();
  return {
    materials: db.select().from(t.materials).all(),
    suppliers: db.select().from(t.suppliers).all(),
    contractors: db.select().from(t.contractors).all(),
    purchaseOrders: db.select().from(t.purchaseOrders).all(),
    workOrders: db.select().from(t.workOrders).all(),
    boqs: db.select().from(t.boqs).all(),
    approvalFlows: db
      .select()
      .from(t.approvalFlows)
      .all()
      .map((f) => ({ ...f, stages: JSON.parse(f.stagesJson || "[]") })),
  };
});

export const mutateVendorEntity = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        entity: z.enum([
          "materials",
          "suppliers",
          "contractors",
          "purchaseOrders",
          "workOrders",
          "boqs",
          "approvalFlows",
        ]),
        action: z.enum(["create", "update", "delete"]),
        id: z.string().optional(),
        values: z.record(z.any()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const db = getDb();
    const tableMap = {
      materials: t.materials,
      suppliers: t.suppliers,
      contractors: t.contractors,
      purchaseOrders: t.purchaseOrders,
      workOrders: t.workOrders,
      boqs: t.boqs,
      approvalFlows: t.approvalFlows,
    } as const;
    const table = tableMap[data.entity];
    const now = nowIso();
    if (data.action === "create") {
      const values = { ...(data.values ?? {}) };
      const id = data.id ?? (typeof values.id === "string" ? values.id : newId());
      delete values.id;
      if (data.entity === "approvalFlows" && values.stages) {
        values.stagesJson = JSON.stringify(values.stages);
        delete values.stages;
      }
      db.insert(table)
        .values({ id, ...values, createdAt: now, updatedAt: now } as never)
        .run();
      return { id };
    }
    if (data.action === "update" && data.id) {
      const values = { ...data.values };
      if (data.entity === "approvalFlows" && values.stages) {
        values.stagesJson = JSON.stringify(values.stages);
        delete values.stages;
      }
      db.update(table)
        .set({ ...values, updatedAt: now } as never)
        .where(eq(table.id, data.id))
        .run();
      return { ok: true };
    }
    if (data.action === "delete" && data.id) {
      db.delete(table).where(eq(table.id, data.id)).run();
      return { ok: true };
    }
    throw new ApiError(400, "Invalid vendor mutation");
  });

export const getLaborBundle = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const db = getDb();
  return {
    labor: db.select().from(t.labor).all(),
    attendance: db.select().from(t.attendanceRecords).all(),
  };
});

export const mutateLabor = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        action: z.enum(["create", "update", "delete", "addAttendance"]),
        id: z.string().optional(),
        values: z.record(z.any()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const db = getDb();
    const now = nowIso();
    if (data.action === "addAttendance") {
      const id = newId();
      db.insert(t.attendanceRecords)
        .values({
          id,
          fileName: String(data.values?.fileName ?? "attendance.xlsx"),
          uploadedAt: now,
          recordCount: Number(data.values?.recordCount ?? 0),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return { id };
    }
    if (data.action === "create") {
      const values = { ...(data.values ?? {}) };
      const id = data.id ?? (typeof values.id === "string" ? values.id : newId());
      delete values.id;
      db.insert(t.labor)
        .values({ id, ...values, createdAt: now, updatedAt: now } as never)
        .run();
      return { id };
    }
    if (data.action === "update" && data.id) {
      db.update(t.labor)
        .set({ ...(data.values as object), updatedAt: now } as never)
        .where(eq(t.labor.id, data.id))
        .run();
      return { ok: true };
    }
    if (data.action === "delete" && data.id) {
      db.delete(t.labor).where(eq(t.labor.id, data.id)).run();
      return { ok: true };
    }
    throw new ApiError(400, "Invalid labor mutation");
  });

export const listDocuments = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.documentTemplates).all();
});

export const mutateDocument = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        action: z.enum(["create", "update", "delete"]),
        id: z.string().optional(),
        values: z.record(z.any()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const db = getDb();
    const now = nowIso();
    if (data.action === "create") {
      const values = { ...(data.values ?? {}) };
      const id = data.id ?? (typeof values.id === "string" ? values.id : newId());
      delete values.id;
      db.insert(t.documentTemplates)
        .values({ id, ...values, createdAt: now, updatedAt: now } as never)
        .run();
      return { id };
    }
    if (data.action === "update" && data.id) {
      db.update(t.documentTemplates)
        .set({ ...(data.values as object), updatedAt: now } as never)
        .where(eq(t.documentTemplates.id, data.id))
        .run();
      return { ok: true };
    }
    if (data.action === "delete" && data.id) {
      db.delete(t.documentTemplates).where(eq(t.documentTemplates.id, data.id)).run();
      return { ok: true };
    }
    throw new ApiError(400, "Invalid document mutation");
  });

export const getIntegrationsBundle = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const db = getDb();
  return {
    integrations: db.select().from(t.integrations).all(),
    triggers: db.select().from(t.triggers).all(),
  };
});

export const mutateIntegration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        kind: z.enum(["integration", "trigger"]),
        action: z.enum(["create", "update", "delete"]),
        id: z.string().optional(),
        values: z.record(z.any()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const db = getDb();
    const table = data.kind === "integration" ? t.integrations : t.triggers;
    const now = nowIso();
    if (data.action === "create") {
      const values = { ...(data.values ?? {}) };
      const id = data.id ?? (typeof values.id === "string" ? values.id : newId());
      delete values.id;
      db.insert(table)
        .values({ id, ...values, createdAt: now, updatedAt: now } as never)
        .run();
      return { id };
    }
    if (data.action === "update" && data.id) {
      db.update(table)
        .set({ ...(data.values as object), updatedAt: now } as never)
        .where(eq(table.id, data.id))
        .run();
      return { ok: true };
    }
    if (data.action === "delete" && data.id) {
      db.delete(table).where(eq(table.id, data.id)).run();
      return { ok: true };
    }
    throw new ApiError(400, "Invalid integration mutation");
  });

export const getAppConfig = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ key: z.enum(["master", "settings"]) }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    const row = getDb().select().from(t.appConfig).where(eq(t.appConfig.key, data.key)).get();
    return row ? JSON.parse(row.valueJson) : {};
  });

export const setAppConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ key: z.enum(["master", "settings"]), value: z.any() }).parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    const db = getDb();
    const existing = db.select().from(t.appConfig).where(eq(t.appConfig.key, data.key)).get();
    const now = nowIso();
    if (existing) {
      db.update(t.appConfig)
        .set({ valueJson: JSON.stringify(data.value), updatedAt: now })
        .where(eq(t.appConfig.key, data.key))
        .run();
    } else {
      db.insert(t.appConfig)
        .values({ key: data.key, valueJson: JSON.stringify(data.value), updatedAt: now })
        .run();
    }
    return { ok: true };
  });

export const getDashboardKpis = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const companies = loadCompanies();
  const projects = loadProjects();
  const tickets = getDb().select().from(t.tickets).all();
  const live = projects.filter((p) => p.goLiveAt).length;
  const upcomingRenewals = companies.filter((c) => {
    const days = (new Date(c.planExpiry).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 60;
  }).length;
  return {
    companyCount: companies.length,
    projectCount: projects.length,
    liveProjects: live,
    openTickets: tickets
      .map((tkt) => mapTicket(tkt as Record<string, unknown>))
      .filter((tkt) => isTicketOpen(tkt)).length,
    upcomingRenewals,
    healthy: companies.filter((c) => c.health === "Healthy").length,
    critical: companies.filter((c) => c.health === "Critical").length,
  };
});
