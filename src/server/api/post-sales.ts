import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildDefaultPostSalesSteps } from "@/data/module-catalog";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { loadPostSalesByCompany, loadPostSalesProject, logActivity } from "@/server/api/mappers";

export const listPostSalesProjects = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string().optional() }).optional().parse(data ?? {}))
  .handler(async ({ data }) => {
    requireUser();
    if (data?.companyId) return loadPostSalesByCompany(data.companyId);
    const db = getDb();
    return db
      .select()
      .from(t.postSalesProjects)
      .all()
      .map((row) => loadPostSalesProject(row.id)!)
      .filter(Boolean);
  });

export const getPostSalesProject = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const project = loadPostSalesProject(data.id);
    if (!project) throw new ApiError(404, "Post Sales project not found");
    return project;
  });

export const createPostSalesProject = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        companyId: z.string(),
        projectName: z.string().min(1),
        projectNumber: z.string().optional(),
        steps: z
          .array(
            z.object({
              id: z.string(),
              key: z.string(),
              label: z.string(),
              requiresTemplate: z.boolean(),
              templateStatus: z.string(),
              uploadStatus: z.string(),
              approvalStatus: z.string(),
              order: z.number(),
            }),
          )
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const db = getDb();
    const id = data.id ?? newId();
    const now = nowIso();
    const count = db.select().from(t.postSalesProjects).where(eq(t.postSalesProjects.companyId, data.companyId)).all()
      .length;
    const projectNumber = data.projectNumber ?? `PRJ-${String(count + 1).padStart(3, "0")}`;
    db.insert(t.postSalesProjects)
      .values({
        id,
        companyId: data.companyId,
        projectNumber,
        projectName: data.projectName,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const steps = data.steps ?? buildDefaultPostSalesSteps();
    for (const step of steps) {
      db.insert(t.postSalesSteps)
        .values({
          id: step.id,
          postSalesProjectId: id,
          key: step.key,
          label: step.label,
          requiresTemplate: step.requiresTemplate,
          templateStatus: step.templateStatus,
          uploadStatus: step.uploadStatus,
          approvalStatus: step.approvalStatus,
          order: step.order,
        })
        .run();
    }
    logActivity({
      who: user.name,
      what: `Created Post Sales project ${projectNumber}`,
      kind: "success",
      companyId: data.companyId,
      projectId: id,
    });
    return loadPostSalesProject(id)!;
  });

export const updatePostSalesStep = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string(),
        stepId: z.string(),
        action: z.enum([
          "send-template",
          "receive-template",
          "upload",
          "submit",
          "approve",
          "reject",
          "remarks",
        ]),
        fileName: z.string().optional(),
        remarks: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const step = db.select().from(t.postSalesSteps).where(eq(t.postSalesSteps.id, data.stepId)).get();
    if (!step || step.postSalesProjectId !== data.projectId) throw new ApiError(404, "Step not found");
    const now = nowIso();
    const patch: Partial<typeof t.postSalesSteps.$inferInsert> = {};

    switch (data.action) {
      case "send-template":
        patch.templateStatus = "sent";
        patch.templateSentOn = now;
        break;
      case "receive-template":
        patch.templateStatus = "received";
        break;
      case "upload":
        patch.uploadStatus = "uploaded";
        patch.uploadedFileJson = JSON.stringify({
          name: data.fileName ?? `${step.key}.xlsx`,
          uploadedAt: now,
          recordCount: 100,
        });
        break;
      case "submit":
        requireUser(["Admin", "Manager"]);
        patch.approvalStatus = "pending-approval";
        break;
      case "approve":
        requireUser(["Admin"]);
        patch.approvalStatus = "approved";
        patch.approvedBy = user.name;
        patch.approvedOn = now;
        break;
      case "reject":
        requireUser(["Admin"]);
        patch.approvalStatus = "rejected";
        patch.remarks = data.remarks ?? step.remarks;
        break;
      case "remarks":
        patch.remarks = data.remarks ?? "";
        break;
    }

    db.update(t.postSalesSteps).set(patch).where(eq(t.postSalesSteps.id, data.stepId)).run();
    db.update(t.postSalesProjects).set({ updatedAt: now }).where(eq(t.postSalesProjects.id, data.projectId)).run();
    logActivity({
      who: user.name,
      what: `${data.action} on ${step.label}`,
      kind: data.action === "approve" ? "success" : data.action === "reject" ? "warning" : "info",
      projectId: data.projectId,
    });
    return loadPostSalesProject(data.projectId)!;
  });

export const deletePostSalesProject = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser(["Admin", "Manager"]);
    const existing = loadPostSalesProject(data.id);
    if (!existing) return { ok: true as const, skipped: true as const };
    getDb().delete(t.postSalesProjects).where(eq(t.postSalesProjects.id, data.id)).run();
    logActivity({
      who: user.name,
      what: `Deleted Post Sales ${existing.projectNumber}`,
      kind: "warning",
      companyId: existing.companyId,
      projectId: data.id,
    });
    return { ok: true as const };
  });
