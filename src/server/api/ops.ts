import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import {
  appendAutomationLogToConfig,
  readAutomationLogsFromConfig,
  replaceAutomationLogsInConfig,
} from "@/server/automation-log-persistence";
import { automationLogWireSchema } from "@/server/automation-log-schema";
import {
  DEFAULT_AUTOMATION_RULES,
  LEGACY_COMPANY_CREATED_EMAIL_TEMPLATES,
  LEGACY_COMPANY_CREATED_WHATSAPP_TEMPLATES,
} from "@/data/automationDefaults";
import { DEFAULT_CRM_AUTOMATION_RULES } from "@/data/crm-automation-defaults";
import { getDb, getSqlite } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { loadCompanies, loadProjects } from "@/server/api/mappers";
import { isTicketOpen, mapTicket, mapTicketActivity } from "@/lib/tickets";
import { automationLogToWire } from "@/lib/automation-log-sync";
import type { TicketActivity } from "@/types";
import type { AutomationChannel, AutomationLogWire, AutomationRule, AutomationTrigger } from "@/types/automation";

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
  sourceDesignTicketId: z.string().optional().nullable(),
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
      sourceDesignTicketId: input.sourceDesignTicketId || null,
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
      sourceDesignTicketId:
        requested.sourceDesignTicketId === undefined
          ? existing.sourceDesignTicketId
          : requested.sourceDesignTicketId || null,
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
  .inputValidator(
    (data: unknown) =>
      z
        .object({
          key: z.enum(["master", "settings", "automation", "crm-automation", "crm-settings", "crm-master"]),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    // Shared runtime config: master catalogs + automation/WAHA must be readable by all
    // signed-in roles. Writes stay Admin-only via setAppConfig.
    // Without this, executives keep a stale WAHA session from localStorage forever.
    if (
      data.key === "crm-master" ||
      data.key === "automation" ||
      data.key === "crm-automation"
    ) {
      requireUser();
    } else {
      requireUser(["Admin"]);
    }
    const row = getDb().select().from(t.appConfig).where(eq(t.appConfig.key, data.key)).get();
    // Keep JSON.parse return type as `any` — TanStack strict output rejects Record<string, unknown>.
    const parsed = row ? JSON.parse(row.valueJson) : {};
    if (
      (data.key === "automation" || data.key === "crm-automation") &&
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "logs" in parsed
    ) {
      const clone = { ...parsed };
      delete clone.logs;
      return clone;
    }
    return parsed;
  });

const automationConfigKeySchema = z.enum(["automation", "crm-automation"]);

export const getAutomationLogs = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ key: automationConfigKeySchema }).parse(data),
  )
  .handler(async ({ data }): Promise<AutomationLogWire[]> => {
    requireUser(["Admin"]);
    const logs = readAutomationLogsFromConfig(getDb(), data.key);
    return JSON.parse(JSON.stringify(logs)) as AutomationLogWire[];
  });

export const appendAutomationLog = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        key: automationConfigKeySchema,
        log: automationLogWireSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    appendAutomationLogToConfig(getDb(), data.key, automationLogToWire(data.log));
    return { ok: true as const };
  });

export const clearAutomationLogs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ key: automationConfigKeySchema }).parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    replaceAutomationLogsInConfig(getDb(), data.key, []);
    return { ok: true as const };
  });

function normalizeBody(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/\r\n/g, "\n").trim();
}

/**
 * Merges incoming client automation snapshot with durable SQLite state:
 * 1. Never lets a stale or unhydrated client overwrite user-customized rule templates with seed defaults.
 * 2. Never lets a client wipe or revert user-configured WAHA sessionName.
 * 3. Never wipes user's automationsEnabled setting or custom webhook URLs.
 * 4. Preserves full attachments (dataBase64) when client partialize strips base64 data.
 * 5. Preserves existing rules that were omitted by a partial write.
 */
export function mergeIncomingAutomationWithSaved(
  existingJson: string | undefined,
  incoming: Record<string, unknown>,
  configKey: "automation" | "crm-automation",
): Record<string, unknown> {
  if (!existingJson) return incoming;
  let previous: Record<string, unknown>;
  try {
    previous = JSON.parse(existingJson) as Record<string, unknown>;
  } catch {
    return incoming;
  }
  if (!previous || typeof previous !== "object" || Object.keys(previous).length === 0) {
    return incoming;
  }

  const result = { ...incoming };

  // 1. Settings protection: preserve automationsEnabled & n8nWebhookBase
  const prevSettings = previous.settings as Record<string, unknown> | undefined;
  const incSettings = incoming.settings as Record<string, unknown> | undefined;
  if (prevSettings && typeof prevSettings === "object") {
    result.settings = {
      ...prevSettings,
      ...(incSettings || {}),
      automationsEnabled:
        typeof incSettings?.automationsEnabled === "boolean"
          ? incSettings.automationsEnabled
          : prevSettings.automationsEnabled ?? true,
      n8nWebhookBase:
        (typeof incSettings?.n8nWebhookBase === "string" && incSettings.n8nWebhookBase.trim()) ||
        prevSettings.n8nWebhookBase,
    };
  }

  // 2. WAHA protection: preserve sessionName and credentials
  const prevWaha = previous.waha as Record<string, unknown> | undefined;
  const incWaha = incoming.waha as Record<string, unknown> | undefined;
  if (prevWaha && typeof prevWaha === "object") {
    const incSession = typeof incWaha?.sessionName === "string" ? incWaha.sessionName.trim() : "";
    const prevSession = typeof prevWaha.sessionName === "string" ? prevWaha.sessionName.trim() : "";
    const defaultSession = configKey === "crm-automation" ? "first" : "second";
    // If incoming session is empty or defaulted while previous had a custom session, retain previous
    const sessionName =
      incSession && incSession !== "first" && incSession !== defaultSession
        ? incSession
        : prevSession || incSession || defaultSession;

    result.waha = {
      ...prevWaha,
      ...(incWaha || {}),
      sessionName,
      apiUrl: (typeof incWaha?.apiUrl === "string" && incWaha.apiUrl.trim()) || prevWaha.apiUrl,
      apiKey: (typeof incWaha?.apiKey === "string" && incWaha.apiKey.trim()) || prevWaha.apiKey,
      isEnabled:
        typeof incWaha?.isEnabled === "boolean"
          ? incWaha.isEnabled
          : prevWaha.isEnabled ?? true,
    };
  }

  // 3. Endpoints protection: keep existing if incoming omitted them
  const prevEndpoints = Array.isArray(previous.endpoints) ? previous.endpoints : [];
  const incEndpoints = Array.isArray(incoming.endpoints) ? incoming.endpoints : [];
  if (prevEndpoints.length > 0 && incEndpoints.length === 0) {
    result.endpoints = prevEndpoints;
  }

  // 4. Rules protection: preserve custom templates and attachments
  const prevRules = Array.isArray(previous.rules) ? (previous.rules as AutomationRule[]) : [];
  const incRules = Array.isArray(incoming.rules) ? (incoming.rules as AutomationRule[]) : [];

  if (prevRules.length > 0) {
    const seedRules =
      configKey === "automation" ? DEFAULT_AUTOMATION_RULES : DEFAULT_CRM_AUTOMATION_RULES;
    const seedById = new Map(seedRules.map((r) => [r.id, r]));
    const prevById = new Map(prevRules.map((r) => [r.id, r]));
    const incById = new Map(incRules.map((r) => [r.id, r]));

    const knownSeeds = new Set<string>();
    for (const s of seedRules) {
      if (s.templateBody) knownSeeds.add(normalizeBody(s.templateBody));
    }
    if (configKey === "automation") {
      for (const t of LEGACY_COMPANY_CREATED_EMAIL_TEMPLATES) knownSeeds.add(normalizeBody(t));
      for (const t of LEGACY_COMPANY_CREATED_WHATSAPP_TEMPLATES) knownSeeds.add(normalizeBody(t));
    }

    const mergedRules: AutomationRule[] = [];

    for (const incRule of incRules) {
      const prevRule = prevById.get(incRule.id);
      if (!prevRule) {
        mergedRules.push(incRule);
        continue;
      }

      const seedRule = seedById.get(incRule.id);
      const prevBodyNorm = normalizeBody(prevRule.templateBody);
      const incBodyNorm = normalizeBody(incRule.templateBody);
      const seedBodyNorm = seedRule?.templateBody ? normalizeBody(seedRule.templateBody) : "";

      const prevWasCustom =
        prevBodyNorm &&
        (!seedBodyNorm || prevBodyNorm !== seedBodyNorm) &&
        !knownSeeds.has(prevBodyNorm);
      const incIsSeed = knownSeeds.has(incBodyNorm) || (seedBodyNorm && incBodyNorm === seedBodyNorm);

      let ruleBody = incRule.templateBody;
      let ruleSubject = incRule.templateSubject;
      let ruleName = incRule.name;
      let ruleDesc = incRule.description;

      if (prevWasCustom && incIsSeed) {
        // Stale client or default merger is sending seed text — preserve user custom template!
        ruleBody = prevRule.templateBody;
        ruleSubject = prevRule.templateSubject ?? incRule.templateSubject;
        ruleName = prevRule.name || incRule.name;
        ruleDesc = prevRule.description ?? incRule.description;
      } else if (!incRule.templateBody && prevRule.templateBody) {
        ruleBody = prevRule.templateBody;
        ruleSubject = prevRule.templateSubject ?? incRule.templateSubject;
      }

      // Preserve full attachments if client stripped dataBase64 (e.g. partialize)
      let attachments = incRule.attachments;
      if (prevRule.attachments && prevRule.attachments.length > 0) {
        if (!attachments || attachments.length === 0) {
          attachments = prevRule.attachments;
        } else {
          attachments = attachments.map((att) => {
            if (!att.dataBase64) {
              const matched = prevRule.attachments?.find((p) => p.filename === att.filename);
              if (matched?.dataBase64) {
                return { ...att, dataBase64: matched.dataBase64 };
              }
            }
            return att;
          });
        }
      }

      mergedRules.push({
        ...prevRule,
        ...incRule,
        name: ruleName,
        description: ruleDesc,
        templateSubject: ruleSubject,
        templateBody: ruleBody,
        attachments,
      });
    }

    // Keep any existing rules that were omitted by incoming payload
    for (const prevRule of prevRules) {
      if (!incById.has(prevRule.id)) {
        mergedRules.push(prevRule);
      }
    }

    result.rules = mergedRules;
  }

  return result;
}

const automationRuleAttachmentSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string().min(1),
  dataBase64: z.string().min(1),
});

const automationRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  trigger: z.string(),
  channel: z.string(),
  isActive: z.boolean(),
  templateSubject: z.string().optional(),
  templateBody: z.string(),
  emailCc: z.string().optional(),
  offsetMinutes: z.number().optional(),
  attachments: z.array(automationRuleAttachmentSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

function toSavedAutomationRule(
  input: z.infer<typeof automationRuleSchema>,
  createdAt: string,
  updatedAt: string,
): AutomationRule {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    trigger: input.trigger as AutomationTrigger,
    channel: input.channel as AutomationChannel,
    isActive: input.isActive,
    templateSubject: input.templateSubject,
    templateBody: input.templateBody,
    emailCc: input.emailCc,
    offsetMinutes: input.offsetMinutes,
    attachments: input.attachments?.length ? input.attachments : undefined,
    createdAt,
    updatedAt,
  };
}

function upsertAutomationRuleInConfig(
  configKey: "automation" | "crm-automation",
  ruleInput: z.infer<typeof automationRuleSchema>,
): AutomationRule {
  const db = getDb();
  const now = nowIso();
  let saved = toSavedAutomationRule(ruleInput, ruleInput.createdAt ?? now, now);
  getSqlite().transaction(() => {
    const existing = db.select().from(t.appConfig).where(eq(t.appConfig.key, configKey)).get();
    const snapshot = existing?.valueJson
      ? (JSON.parse(existing.valueJson) as { rules?: AutomationRule[] })
      : {};
    const rules = Array.isArray(snapshot.rules) ? [...snapshot.rules] : [];
    const index = rules.findIndex((rule) => rule?.id === ruleInput.id);
    const prev = index >= 0 ? rules[index] : undefined;
    const createdAt = prev?.createdAt || ruleInput.createdAt || now;

    // Preserve attachment dataBase64 if incoming attachment data was empty/missing
    let attachments = ruleInput.attachments;
    if (prev?.attachments && prev.attachments.length > 0 && attachments && attachments.length > 0) {
      attachments = attachments.map((att) => {
        if (!att.dataBase64) {
          const matched = prev.attachments?.find((p) => p.filename === att.filename);
          if (matched?.dataBase64) {
            return { ...att, dataBase64: matched.dataBase64 };
          }
        }
        return att;
      });
    }

    saved = toSavedAutomationRule({ ...ruleInput, attachments }, createdAt, now);
    if (index >= 0) rules[index] = saved;
    else rules.push(saved);
    snapshot.rules = rules;
    const valueJson = JSON.stringify(snapshot);
    if (existing) {
      db.update(t.appConfig)
        .set({ valueJson, updatedAt: now })
        .where(eq(t.appConfig.key, configKey))
        .run();
    } else {
      db.insert(t.appConfig).values({ key: configKey, valueJson, updatedAt: now }).run();
    }
  })();
  return saved;
}

/** Patch one ERP automation rule in SQLite so toggles/edits survive deploy. */
export const saveAutomationRule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ rule: automationRuleSchema }).parse(data))
  .handler(async ({ data }): Promise<{ rule: AutomationRule }> => {
    requireUser(["Admin"]);
    return { rule: upsertAutomationRuleInConfig("automation", data.rule) };
  });

/** Patch one CRM automation rule inside the shared config so other PCs see the same Updated time. */
export const saveCrmAutomationRule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ rule: automationRuleSchema }).parse(data))
  .handler(async ({ data }): Promise<{ rule: AutomationRule }> => {
    requireUser(["Admin"]);
    return { rule: upsertAutomationRuleInConfig("crm-automation", data.rule) };
  });

export const setAppConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        key: z.enum(["master", "settings", "automation", "crm-automation", "crm-settings", "crm-master"]),
        value: z.any(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    const db = getDb();
    getSqlite().transaction(() => {
      const existing = db.select().from(t.appConfig).where(eq(t.appConfig.key, data.key)).get();
      const now = nowIso();
      let value = data.value as Record<string, unknown>;
      // Never wipe durable automation logs when persisting settings/rules from the client.
      if ((data.key === "automation" || data.key === "crm-automation") && !("logs" in value)) {
        value = { ...value, logs: readAutomationLogsFromConfig(db, data.key) };
      }
      if (data.key === "automation" || data.key === "crm-automation") {
        value = mergeIncomingAutomationWithSaved(existing?.valueJson, value, data.key);
      }
      const valueJson = JSON.stringify(value);
      if (existing) {
        db.update(t.appConfig)
          .set({ valueJson, updatedAt: now })
          .where(eq(t.appConfig.key, data.key))
          .run();
      } else {
        db.insert(t.appConfig)
          .values({ key: data.key, valueJson, updatedAt: now })
          .run();
      }
    })();
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
