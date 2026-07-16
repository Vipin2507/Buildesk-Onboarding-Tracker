import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { CHECKLIST_TEMPLATE } from "@/data/constants";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { logActivity } from "@/server/api/mappers";
import type { ChecklistPhase, OnboardingChecklistItem, OtherCharge } from "@/types";
import { applyChecklistPhaseToggle, stampChecklistPhaseDates } from "@/lib/checklist";

function ensureDefaultChecklist(projectId: string) {
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

function mapChecklist(row: typeof t.onboardingChecklistItems.$inferSelect): OnboardingChecklistItem {
  return {
    id: row.id,
    projectId: row.projectId,
    section: row.section,
    label: row.label,
    collected: row.collected,
    uploaded: row.uploaded,
    live: row.live,
    collectedAt: row.collectedAt ?? (row.collected ? row.updatedAt : undefined),
    uploadedAt: row.uploadedAt ?? (row.uploaded ? row.updatedAt : undefined),
    liveAt: row.liveAt ?? (row.live ? row.updatedAt : undefined),
    notApplicable: row.notApplicable ?? false,
    remarks: row.remarks,
    source: (row.source as OnboardingChecklistItem["source"]) || "default",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const listChecklist = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const now = nowIso();
    let rows = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(eq(t.onboardingChecklistItems.projectId, data.projectId))
      .all();

    const allowed = new Set(
      Object.entries(CHECKLIST_TEMPLATE).flatMap(([section, labels]) =>
        labels.map((label) => `${section}::${label}`),
      ),
    );
    for (const row of rows) {
      if (row.source === "required-document") continue;
      if (!allowed.has(`${row.section}::${row.label}`)) {
        db.delete(t.onboardingChecklistItems).where(eq(t.onboardingChecklistItems.id, row.id)).run();
      }
    }
    rows = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(eq(t.onboardingChecklistItems.projectId, data.projectId))
      .all();
    const have = new Set(rows.map((r) => `${r.section}::${r.label}`));
    for (const [section, labels] of Object.entries(CHECKLIST_TEMPLATE)) {
      for (const label of labels) {
        if (have.has(`${section}::${label}`)) continue;
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
            source: "default",
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
    return rows.map(mapChecklist);
  });

export const setChecklistState = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        collected: z.boolean(),
        uploaded: z.boolean(),
        live: z.boolean(),
        notApplicable: z.boolean().optional(),
      })
      .parse(data),
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
    const notApplicable = data.notApplicable ?? false;
    const collected = notApplicable ? false : data.collected;
    const uploaded = notApplicable ? false : data.uploaded && collected;
    const live = notApplicable ? false : data.live && uploaded && collected;
    const dates = stampChecklistPhaseDates(mapChecklist(row), {
      collected,
      uploaded,
      live,
      notApplicable,
    }, now);
    db.update(t.onboardingChecklistItems)
      .set({
        notApplicable,
        collected,
        uploaded,
        live,
        collectedAt: dates.collectedAt ?? null,
        uploadedAt: dates.uploadedAt ?? null,
        liveAt: dates.liveAt ?? null,
        updatedAt: now,
      })
      .where(eq(t.onboardingChecklistItems.id, data.id))
      .run();
    logActivity({
      who: user.name,
      what: notApplicable
        ? `Marked "${row.label}" as not applicable`
        : `Set checklist state on "${row.label}"`,
      kind: "info",
      projectId: row.projectId,
    });
    return mapChecklist({
      ...row,
      notApplicable,
      collected,
      uploaded,
      live,
      collectedAt: dates.collectedAt ?? null,
      uploadedAt: dates.uploadedAt ?? null,
      liveAt: dates.liveAt ?? null,
      updatedAt: now,
    });
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
    const next = applyChecklistPhaseToggle(mapChecklist(row), phase);
    if (!next) throw new ApiError(400, "Complete prior phases first (Collected → Uploaded → Live)");
    const now = nowIso();
    db.update(t.onboardingChecklistItems)
      .set({
        collected: next.collected,
        uploaded: next.uploaded,
        live: next.live,
        collectedAt: next.collectedAt ?? null,
        uploadedAt: next.uploadedAt ?? null,
        liveAt: next.liveAt ?? null,
        updatedAt: now,
      })
      .where(eq(t.onboardingChecklistItems.id, data.id))
      .run();
    logActivity({
      who: user.name,
      what: `${next[phase] ? "Checked" : "Unchecked"} ${row.label} (${phase})`,
      kind: "info",
      projectId: row.projectId,
    });
    return mapChecklist({
      ...row,
      collected: next.collected,
      uploaded: next.uploaded,
      live: next.live,
      collectedAt: next.collectedAt ?? null,
      uploadedAt: next.uploadedAt ?? null,
      liveAt: next.liveAt ?? null,
      updatedAt: now,
    });
  });

export const completeProjectChecklist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const db = getDb();
    const now = nowIso();
    const rows = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(eq(t.onboardingChecklistItems.projectId, data.projectId))
      .all();
    for (const row of rows) {
      if (row.notApplicable) continue;
      db.update(t.onboardingChecklistItems)
        .set({
          collected: true,
          uploaded: true,
          live: true,
          collectedAt: row.collectedAt ?? now,
          uploadedAt: row.uploadedAt ?? now,
          liveAt: row.liveAt ?? now,
          updatedAt: now,
        })
        .where(eq(t.onboardingChecklistItems.id, row.id))
        .run();
    }
    logActivity({
      who: user.name,
      what: "Completed all onboarding checklist items",
      kind: "success",
      projectId: data.projectId,
    });
    return { ok: true as const, count: rows.filter((r) => !r.notApplicable).length };
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
      ? {
          notApplicable: true,
          collected: false,
          uploaded: false,
          live: false,
          collectedAt: null,
          uploadedAt: null,
          liveAt: null,
          updatedAt: now,
        }
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

/** Mark a document template as required for a customer project — adds/removes an onboarding Documents step. */
export const setDocumentRequired = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string(),
        documentName: z.string().min(1),
        required: z.boolean(),
        id: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    ensureDefaultChecklist(data.projectId);

    const existing = db
      .select()
      .from(t.onboardingChecklistItems)
      .where(
        and(
          eq(t.onboardingChecklistItems.projectId, data.projectId),
          eq(t.onboardingChecklistItems.label, data.documentName),
          eq(t.onboardingChecklistItems.source, "required-document"),
        ),
      )
      .get();

    if (data.required) {
      if (existing) return { item: mapChecklist(existing), required: true as const };
      const now = nowIso();
      const id = data.id ?? newId();
      const row = {
        id,
        projectId: data.projectId,
        section: "documents",
        label: data.documentName,
        collected: false,
        uploaded: false,
        live: false,
        collectedAt: null as string | null,
        uploadedAt: null as string | null,
        liveAt: null as string | null,
        notApplicable: false,
        remarks: "",
        source: "required-document" as const,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(t.onboardingChecklistItems).values(row).run();
      logActivity({
        who: user.name,
        what: `Marked "${data.documentName}" as required (added Documents process step)`,
        kind: "info",
        projectId: data.projectId,
      });
      return { item: mapChecklist(row), required: true as const };
    }

    if (existing) {
      db.delete(t.onboardingChecklistItems)
        .where(eq(t.onboardingChecklistItems.id, existing.id))
        .run();
      logActivity({
        who: user.name,
        what: `Cleared required flag on "${data.documentName}" (removed Documents process step)`,
        kind: "info",
        projectId: data.projectId,
      });
    }
    return { item: null, required: false as const };
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

function mapCustomerAppConfig(row: typeof t.customerAppConfigs.$inferSelect) {
  return {
    projectId: row.projectId,
    mode: row.mode as "buildesk" | "whitelabel",
    appName: row.appName,
    primaryColor: row.primaryColor,
    logoUrl: row.logoUrl,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    publishStatus: row.publishStatus as "draft" | "review" | "published",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const listAllCustomerAppConfigs = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb().select().from(t.customerAppConfigs).all().map(mapCustomerAppConfig);
});

export const upsertCustomerAppConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string(),
        patch: z
          .object({
            mode: z.enum(["buildesk", "whitelabel"]).optional(),
            appName: z.string().optional(),
            primaryColor: z.string().optional(),
            logoUrl: z.string().optional(),
            supportEmail: z.string().optional(),
            supportPhone: z.string().optional(),
            publishStatus: z.enum(["draft", "review", "published"]).optional(),
          })
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    const db = getDb();
    const now = nowIso();
    const existing = db
      .select()
      .from(t.customerAppConfigs)
      .where(eq(t.customerAppConfigs.projectId, data.projectId))
      .get();
    const patch = data.patch ?? {};
    if (!existing) {
      const row = {
        projectId: data.projectId,
        mode: patch.mode ?? "buildesk",
        appName: patch.appName ?? "Customer App",
        primaryColor: patch.primaryColor ?? "#2563eb",
        logoUrl: patch.logoUrl ?? "",
        supportEmail: patch.supportEmail ?? "",
        supportPhone: patch.supportPhone ?? "",
        publishStatus: patch.publishStatus ?? "draft",
        createdAt: now,
        updatedAt: now,
      };
      db.insert(t.customerAppConfigs).values(row).run();
      return mapCustomerAppConfig(row);
    }
    const next = {
      mode: patch.mode ?? existing.mode,
      appName: patch.appName ?? existing.appName,
      primaryColor: patch.primaryColor ?? existing.primaryColor,
      logoUrl: patch.logoUrl ?? existing.logoUrl,
      supportEmail: patch.supportEmail ?? existing.supportEmail,
      supportPhone: patch.supportPhone ?? existing.supportPhone,
      publishStatus: patch.publishStatus ?? existing.publishStatus,
      updatedAt: now,
    };
    db.update(t.customerAppConfigs)
      .set(next)
      .where(eq(t.customerAppConfigs.projectId, data.projectId))
      .run();
    return mapCustomerAppConfig({ ...existing, ...next });
  });
