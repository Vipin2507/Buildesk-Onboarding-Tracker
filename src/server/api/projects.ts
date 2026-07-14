import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { CHECKLIST_TEMPLATE } from "@/data/constants";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { loadProject, loadProjects, logActivity } from "@/server/api/mappers";
import type { ProjectManualProgress } from "@/types";

function ensureChecklist(projectId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(t.onboardingChecklistItems)
    .where(eq(t.onboardingChecklistItems.projectId, projectId))
    .get();
  if (existing) return;
  const now = nowIso();
  for (const [section, labels] of Object.entries(CHECKLIST_TEMPLATE)) {
    for (const label of labels) {
      db.insert(t.onboardingChecklistItems)
        .values({
          id: newId(),
          projectId,
          section,
          label,
          collected: false,
          uploaded: false,
          live: false,
          notApplicable: false,
          remarks: "",
          source: "default",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
}

export const listProjects = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ companyId: z.string().optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    return loadProjects(data?.companyId);
  });

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const project = loadProject(data.id);
    if (!project) throw new ApiError(404, "Project not found");
    ensureChecklist(data.id);
    return project;
  });

const projectInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  companyId: z.string(),
  type: z.string(),
  units: z.number(),
  city: z.string(),
  rera: z.string().optional().default(""),
  status: z.enum(["not_started", "in_progress", "review", "completed", "on_hold"]),
  currentStep: z.number().optional(),
  startDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  totalTowers: z.number().optional().nullable(),
  totalFloors: z.number().optional().nullable(),
  agreementValue: z.number().optional().nullable(),
  otherCharges: z.array(z.string()).optional(),
  customCharges: z.array(z.string()).optional(),
  logoUrl: z.string().optional().nullable(),
  pocName: z.string().optional().nullable(),
  pocMobile: z.string().optional().nullable(),
});

function projectRowValues(
  data: z.infer<typeof projectInput>,
  extras: { id: string; now: string; createdAt: string },
) {
  return {
    id: extras.id,
    name: data.name,
    companyId: data.companyId,
    type: data.type,
    units: data.units,
    city: data.city,
    rera: data.rera ?? "",
    status: data.status,
    currentStep: data.currentStep ?? 0,
    startDate: data.startDate ?? null,
    address: data.address ?? null,
    state: data.state ?? null,
    pinCode: data.pinCode ?? null,
    totalTowers: data.totalTowers ?? null,
    totalFloors: data.totalFloors ?? null,
    agreementValue: data.agreementValue ?? null,
    otherChargesJson: JSON.stringify(data.otherCharges ?? []),
    customChargesJson: JSON.stringify(data.customCharges ?? []),
    logoUrl: data.logoUrl ?? null,
    pocName: data.pocName ?? null,
    pocMobile: data.pocMobile ?? null,
    createdAt: extras.createdAt,
    updatedAt: extras.now,
  };
}

export const createProject = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => projectInput.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const db = getDb();
    const id = data.id ?? newId();
    const existing = loadProject(id);
    if (existing) return existing;

    // Import fires company + project almost together; wait briefly for company row.
    let company = db.select().from(t.companies).where(eq(t.companies.id, data.companyId)).get();
    if (!company) {
      for (let i = 0; i < 5 && !company; i++) {
        await new Promise((r) => setTimeout(r, 150));
        company = db.select().from(t.companies).where(eq(t.companies.id, data.companyId)).get();
      }
    }
    if (!company) {
      return { ok: false as const, skipped: "company missing" as const };
    }

    const now = nowIso();
    try {
      db.insert(t.projects)
        .values(projectRowValues(data, { id, now, createdAt: now }))
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/FOREIGN KEY/i.test(msg)) {
        return { ok: false as const, skipped: "company missing" as const };
      }
      throw e;
    }
    ensureChecklist(id);
    logActivity({
      who: user.name,
      what: `Created project ${data.name}`,
      kind: "success",
      companyId: data.companyId,
      projectId: id,
    });
    return loadProject(id)!;
  });

export const updateProject = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: projectInput.partial().extend({ goLiveAt: z.string().optional().nullable() }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const existing = loadProject(data.id);
    if (!existing) throw new ApiError(404, "Project not found");
    const now = nowIso();
    const p = data.patch;
    const set: Record<string, unknown> = { updatedAt: now };
    if (p.name !== undefined) set.name = p.name;
    if (p.companyId !== undefined) set.companyId = p.companyId;
    if (p.type !== undefined) set.type = p.type;
    if (p.units !== undefined) set.units = p.units;
    if (p.city !== undefined) set.city = p.city;
    if (p.rera !== undefined) set.rera = p.rera;
    if (p.status !== undefined) set.status = p.status;
    if (p.currentStep !== undefined) set.currentStep = p.currentStep;
    if (p.startDate !== undefined) set.startDate = p.startDate;
    if (p.goLiveAt !== undefined) set.goLiveAt = p.goLiveAt;
    if (p.address !== undefined) set.address = p.address;
    if (p.state !== undefined) set.state = p.state;
    if (p.pinCode !== undefined) set.pinCode = p.pinCode;
    if (p.totalTowers !== undefined) set.totalTowers = p.totalTowers;
    if (p.totalFloors !== undefined) set.totalFloors = p.totalFloors;
    if (p.agreementValue !== undefined) set.agreementValue = p.agreementValue;
    if (p.otherCharges !== undefined) set.otherChargesJson = JSON.stringify(p.otherCharges);
    if (p.customCharges !== undefined) set.customChargesJson = JSON.stringify(p.customCharges);
    if (p.logoUrl !== undefined) set.logoUrl = p.logoUrl;
    if (p.pocName !== undefined) set.pocName = p.pocName;
    if (p.pocMobile !== undefined) set.pocMobile = p.pocMobile;

    getDb().update(t.projects).set(set).where(eq(t.projects.id, data.id)).run();
    logActivity({
      who: user.name,
      what: `Updated project ${existing.name}`,
      kind: "info",
      companyId: existing.companyId,
      projectId: data.id,
    });
    return loadProject(data.id)!;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const existing = loadProject(data.id);
    if (!existing) return { ok: true as const, skipped: true as const };
    getDb().delete(t.projects).where(eq(t.projects.id, data.id)).run();
    logActivity({
      who: user.name,
      what: `Deleted project ${existing.name}`,
      kind: "warning",
      companyId: existing.companyId,
      projectId: data.id,
    });
    return { ok: true as const };
  });

export const goLiveProject = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const db = getDb();
    const existing = loadProject(data.id);
    if (!existing) throw new ApiError(404, "Project not found");
    ensureChecklist(data.id);
    const items = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(eq(t.onboardingChecklistItems.projectId, data.id))
      .all();
    const golive = items.filter((i) => i.section === "golive");
    const ready =
      golive.length > 0 &&
      golive.every((i) => i.notApplicable || (i.collected && i.uploaded && i.live));
    if (!ready) throw new ApiError(400, "Complete all Go-Live checklist items first");
    const now = nowIso();
    db.update(t.projects)
      .set({ status: "completed", goLiveAt: now, currentStep: 7, updatedAt: now })
      .where(eq(t.projects.id, data.id))
      .run();
    logActivity({
      who: user.name,
      what: `${existing.name} went LIVE!`,
      kind: "success",
      companyId: existing.companyId,
      projectId: data.id,
    });
    return loadProject(data.id)!;
  });

export const getProjectProgress = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string() }).parse(data))
  .handler(async ({ data }): Promise<ProjectManualProgress> => {
    requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.projectManualProgress)
      .where(eq(t.projectManualProgress.projectId, data.projectId))
      .get();
    if (!row) {
      const now = nowIso();
      return {
        projectId: data.projectId,
        checks: {},
        notApplicable: {},
        remarks: "",
        createdAt: now,
        updatedAt: now,
      };
    }
    return {
      projectId: row.projectId,
      contactPerson: row.contactPerson ?? undefined,
      contactNumber: row.contactNumber ?? undefined,
      checks: JSON.parse(row.checksJson || "{}"),
      notApplicable: JSON.parse(row.notApplicableJson || "{}"),
      remarks: row.remarks,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

export const upsertProjectProgress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string(),
        contactPerson: z.string().optional().nullable(),
        contactNumber: z.string().optional().nullable(),
        checks: z.record(z.boolean()).optional(),
        notApplicable: z.record(z.boolean()).optional(),
        remarks: z.string().optional(),
        toggleKey: z.string().optional(),
        markAll: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const now = nowIso();
    let row = db
      .select()
      .from(t.projectManualProgress)
      .where(eq(t.projectManualProgress.projectId, data.projectId))
      .get();
    if (!row) {
      db.insert(t.projectManualProgress)
        .values({
          projectId: data.projectId,
          checksJson: "{}",
          notApplicableJson: "{}",
          remarks: "",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      row = db
        .select()
        .from(t.projectManualProgress)
        .where(eq(t.projectManualProgress.projectId, data.projectId))
        .get()!;
    }
    const keys = [
      "projectSetup", "existingDataUpload", "paymentUpload", "dueMatching", "demandFormat",
      "receiptFormat", "agreementFormat", "allotmentLetterFormat", "welcomeLetterFormat",
      "customerApplication", "whiteLabelOrBuildesk", "androidAppPublished", "iosAppPublished",
      "credentialsShared", "appIntegrationRequired", "integrationConnected", "procurementManagement",
      "materialDataUpdated", "supplierDataUpdated", "contractorDataUpdated", "poFormat", "woFormat",
      "boqFormed", "clientSignOff",
    ];
    let checks = JSON.parse(row.checksJson || "{}") as Record<string, boolean>;
    let notApplicable = JSON.parse(row.notApplicableJson || "{}") as Record<string, boolean>;
    if (data.markAll !== undefined) {
      checks = Object.fromEntries(keys.map((k) => [k, data.markAll!]));
      notApplicable = Object.fromEntries(keys.map((k) => [k, false]));
    }
    if (data.toggleKey) {
      if (!notApplicable[data.toggleKey]) {
        checks[data.toggleKey] = !checks[data.toggleKey];
      }
    }
    if (data.checks) checks = { ...checks, ...data.checks };
    if (data.notApplicable) notApplicable = { ...notApplicable, ...data.notApplicable };
    db.update(t.projectManualProgress)
      .set({
        contactPerson: data.contactPerson !== undefined ? data.contactPerson : row.contactPerson,
        contactNumber: data.contactNumber !== undefined ? data.contactNumber : row.contactNumber,
        remarks: data.remarks !== undefined ? data.remarks : row.remarks,
        checksJson: JSON.stringify(checks),
        notApplicableJson: JSON.stringify(notApplicable),
        updatedAt: now,
      })
      .where(eq(t.projectManualProgress.projectId, data.projectId))
      .run();
    return {
      projectId: data.projectId,
      contactPerson: (data.contactPerson !== undefined ? data.contactPerson : row.contactPerson) ?? undefined,
      contactNumber: (data.contactNumber !== undefined ? data.contactNumber : row.contactNumber) ?? undefined,
      checks: checks as ProjectManualProgress["checks"],
      notApplicable: notApplicable as ProjectManualProgress["notApplicable"],
      remarks: data.remarks !== undefined ? data.remarks : row.remarks,
      createdAt: row.createdAt,
      updatedAt: now,
    } satisfies ProjectManualProgress;
  });

export const listAllProgress = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb()
    .select()
    .from(t.projectManualProgress)
    .all()
    .map(
      (row): ProjectManualProgress => ({
        projectId: row.projectId,
        contactPerson: row.contactPerson ?? undefined,
        contactNumber: row.contactNumber ?? undefined,
        checks: JSON.parse(row.checksJson || "{}"),
        notApplicable: JSON.parse(row.notApplicableJson || "{}"),
        remarks: row.remarks,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
});
