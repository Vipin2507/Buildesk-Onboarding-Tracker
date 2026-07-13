import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { CHECKLIST_TEMPLATE } from "@/data/constants";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { logActivity } from "@/server/api/mappers";
import type { ChecklistPhase, OnboardingChecklistItem, OtherCharge } from "@/types";

function mapChecklist(row: typeof t.onboardingChecklistItems.$inferSelect): OnboardingChecklistItem {
  return {
    id: row.id,
    projectId: row.projectId,
    section: row.section,
    label: row.label,
    collected: row.collected,
    uploaded: row.uploaded,
    live: row.live,
    notApplicable: row.notApplicable ?? false,
    remarks: row.remarks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const listChecklist = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    let rows = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(eq(t.onboardingChecklistItems.projectId, data.projectId))
      .all();
    if (rows.length === 0) {
      const now = nowIso();
      for (const [section, labels] of Object.entries(CHECKLIST_TEMPLATE)) {
        for (const label of labels) {
          db.insert(t.onboardingChecklistItems)
            .values({
              id: newId(),
              projectId: data.projectId,
              section,
              label,
              collected: false,
              uploaded: false,
              live: false,
              notApplicable: false,
              remarks: "",
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }
      }
      rows = db
        .select()
        .from(t.onboardingChecklistItems)
        .where(eq(t.onboardingChecklistItems.projectId, data.projectId))
        .all();
    }
    return rows.map(mapChecklist);
  });

export const toggleChecklist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), phase: z.enum(["collected", "uploaded", "live"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(eq(t.onboardingChecklistItems.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Checklist item not found");
    if (row.notApplicable) throw new ApiError(400, "Item is marked not applicable");
    const phase = data.phase as ChecklistPhase;
    const next = !row[phase];
    db.update(t.onboardingChecklistItems)
      .set({ [phase]: next, updatedAt: nowIso() })
      .where(eq(t.onboardingChecklistItems.id, data.id))
      .run();
    logActivity({
      who: user.name,
      what: `${next ? "Checked" : "Unchecked"} ${row.label} (${phase})`,
      kind: "info",
      projectId: row.projectId,
    });
    return mapChecklist({ ...row, [phase]: next, updatedAt: nowIso() });
  });

export const setChecklistNotApplicable = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), notApplicable: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(eq(t.onboardingChecklistItems.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Checklist item not found");
    const now = nowIso();
    const patch = data.notApplicable
      ? { notApplicable: true, collected: false, uploaded: false, live: false, updatedAt: now }
      : { notApplicable: false, updatedAt: now };
    db.update(t.onboardingChecklistItems)
      .set(patch)
      .where(eq(t.onboardingChecklistItems.id, data.id))
      .run();
    logActivity({
      who: user.name,
      what: data.notApplicable
        ? `Marked "${row.label}" as not applicable`
        : `Cleared N/A on "${row.label}"`,
      kind: "info",
      projectId: row.projectId,
    });
    return mapChecklist({ ...row, ...patch });
  });

export const updateChecklistRemarks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string(), remarks: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    getDb()
      .update(t.onboardingChecklistItems)
      .set({ remarks: data.remarks, updatedAt: nowIso() })
      .where(eq(t.onboardingChecklistItems.id, data.id))
      .run();
    return { ok: true };
  });

export const listOtherCharges = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    return getDb()
      .select()
      .from(t.otherCharges)
      .where(eq(t.otherCharges.projectId, data.projectId))
      .all() as OtherCharge[];
  });

export const addOtherCharge = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        projectId: z.string(),
        name: z.string(),
        amount: z.number(),
        type: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const now = nowIso();
    const id = data.id ?? newId();
    const { id: _i, ...rest } = data;
    getDb()
      .insert(t.otherCharges)
      .values({ id, ...rest, createdAt: now, updatedAt: now })
      .run();
    return { id, ...rest, createdAt: now, updatedAt: now } satisfies OtherCharge;
  });

export const updateOtherCharge = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: z.object({ name: z.string().optional(), amount: z.number().optional(), type: z.string().optional() }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb()
      .update(t.otherCharges)
      .set({ ...data.patch, updatedAt: nowIso() })
      .where(eq(t.otherCharges.id, data.id))
      .run();
    return { ok: true };
  });

export const deleteOtherCharge = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb().delete(t.otherCharges).where(eq(t.otherCharges.id, data.id)).run();
    return { ok: true };
  });

export const listUploads = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    return getDb().select().from(t.unitUploads).where(eq(t.unitUploads.projectId, data.projectId)).all();
  });

export const simulateUpload = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string(),
        type: z.enum(["unit", "customer", "booking", "payment"]),
        fileName: z.string(),
        companyId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const now = nowIso();
    const id = newId();
    const recordCount = 50 + Math.floor(Math.random() * 200);
    getDb()
      .insert(t.unitUploads)
      .values({
        id,
        projectId: data.projectId,
        type: data.type,
        fileName: data.fileName,
        recordCount,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    if (data.companyId) {
      getDb()
        .insert(t.companyAttachments)
        .values({
          id: newId(),
          companyId: data.companyId,
          projectId: data.projectId,
          fileName: data.fileName,
          purpose: `${data.type} data`,
          category: data.type,
          context: "Onboarding data migration",
          recordCount,
          uploadedBy: user.name,
          uploadedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    logActivity({
      who: user.name,
      what: `Uploaded ${data.fileName}`,
      kind: "success",
      companyId: data.companyId,
      projectId: data.projectId,
    });
    return { id, ...data, recordCount, uploadedAt: now, createdAt: now, updatedAt: now };
  });

export const listAllChecklist = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.onboardingChecklistItems).all().map(mapChecklist);
});

export const listAllOtherCharges = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.otherCharges).all() as OtherCharge[];
});

export const listAllUploads = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.unitUploads).all();
});
