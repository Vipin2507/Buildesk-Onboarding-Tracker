import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { loadCompanies, loadProjects } from "@/server/api/mappers";

export const listTickets = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.tickets).orderBy(asc(t.tickets.id)).all();
});

export const getTicket = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const row = getDb().select().from(t.tickets).where(eq(t.tickets.id, data.id)).get();
    if (!row) throw new ApiError(404, "Ticket not found");
    return row;
  });

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        type: z.string(),
        title: z.string(),
        priority: z.string(),
        status: z.string(),
        raisedOn: z.string(),
        eta: z.string(),
        developerId: z.string().optional(),
        companyId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const now = nowIso();
    const { id: clientId, ...rest } = data;
    const id = clientId ?? `TKT-${Date.now()}`;
    getDb()
      .insert(t.tickets)
      .values({ id, ...rest, createdAt: now, updatedAt: now })
      .run();
    return getDb().select().from(t.tickets).where(eq(t.tickets.id, id)).get()!;
  });

export const updateTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), patch: z.record(z.any()) }).parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb()
      .update(t.tickets)
      .set({ ...data.patch, updatedAt: nowIso() })
      .where(eq(t.tickets.id, data.id))
      .run();
    return getDb().select().from(t.tickets).where(eq(t.tickets.id, data.id)).get()!;
  });

export const deleteTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
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
    openTickets: tickets.filter((tkt) => tkt.status !== "Closed" && tkt.status !== "Released").length,
    upcomingRenewals,
    healthy: companies.filter((c) => c.health === "Healthy").length,
    critical: companies.filter((c) => c.health === "Critical").length,
  };
});
