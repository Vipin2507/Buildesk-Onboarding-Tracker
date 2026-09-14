import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  decodeProjectFileUploadPayload,
  deleteProjectFileFromDisk,
  saveProjectFileUpload,
} from "@/server/lib/project-file-storage";
import {
  PROJECT_FILE_CATEGORIES,
  type ProjectFile,
  type ProjectFileCategory,
} from "@/types/project-file";

const categorySchema = z.enum(
  PROJECT_FILE_CATEGORIES as [ProjectFileCategory, ...ProjectFileCategory[]],
);

function publicUrl(storageKey: string) {
  return `/api/project-files/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`;
}

function mapRow(row: typeof t.projectFiles.$inferSelect): ProjectFile {
  return {
    id: row.id,
    projectId: row.projectId,
    companyId: row.companyId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes ?? 0,
    category: (row.category as ProjectFileCategory) || "other",
    purpose: row.purpose ?? undefined,
    notes: row.notes ?? undefined,
    storageKey: row.storageKey,
    url: publicUrl(row.storageKey),
    uploadedBy: row.uploadedBy,
    uploadedByUserId: row.uploadedByUserId ?? undefined,
    uploadedAt: row.uploadedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function requireProject(projectId: string) {
  const db = getDb();
  const project = db.select().from(t.projects).where(eq(t.projects.id, projectId)).get();
  if (!project) throw new ApiError(404, "Project not found");
  return project;
}

export const listProjectFiles = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    requireProject(data.projectId);
    const db = getDb();
    return db
      .select()
      .from(t.projectFiles)
      .where(eq(t.projectFiles.projectId, data.projectId))
      .orderBy(desc(t.projectFiles.uploadedAt))
      .all()
      .map(mapRow);
  });

export const uploadProjectFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string().min(1),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(200),
        dataBase64: z.string().min(1),
        category: categorySchema.optional(),
        purpose: z.string().max(200).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const project = requireProject(data.projectId);
    const buffer = decodeProjectFileUploadPayload(data.dataBase64);
    const id = newId();
    const now = nowIso();
    const saved = saveProjectFileUpload({
      projectId: data.projectId,
      fileId: id,
      fileName: data.fileName,
      mimeType: data.mimeType,
      buffer,
    });

    const db = getDb();
    db.insert(t.projectFiles)
      .values({
        id,
        projectId: data.projectId,
        companyId: project.companyId,
        fileName: data.fileName.trim(),
        mimeType: data.mimeType.trim() || "application/octet-stream",
        sizeBytes: buffer.length,
        category: data.category ?? "other",
        purpose: data.purpose?.trim() || null,
        notes: data.notes?.trim() || null,
        storageKey: saved.storageKey,
        uploadedBy: user.name,
        uploadedByUserId: user.id,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const row = db.select().from(t.projectFiles).where(eq(t.projectFiles.id, id)).get();
    if (!row) throw new ApiError(500, "Failed to save project file");
    return mapRow(row);
  });

export const updateProjectFileMeta = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        category: categorySchema.optional(),
        purpose: z.string().max(200).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const existing = db.select().from(t.projectFiles).where(eq(t.projectFiles.id, data.id)).get();
    if (!existing) throw new ApiError(404, "File not found");

    db.update(t.projectFiles)
      .set({
        category: data.category ?? existing.category,
        purpose:
          data.purpose === undefined
            ? existing.purpose
            : data.purpose?.trim() || null,
        notes:
          data.notes === undefined ? existing.notes : data.notes?.trim() || null,
        updatedAt: nowIso(),
      })
      .where(eq(t.projectFiles.id, data.id))
      .run();

    const row = db.select().from(t.projectFiles).where(eq(t.projectFiles.id, data.id)).get();
    if (!row) throw new ApiError(404, "File not found");
    return mapRow(row);
  });

export const deleteProjectFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    const existing = db.select().from(t.projectFiles).where(eq(t.projectFiles.id, data.id)).get();
    if (!existing) throw new ApiError(404, "File not found");

    db.delete(t.projectFiles).where(eq(t.projectFiles.id, data.id)).run();
    deleteProjectFileFromDisk(existing.storageKey);
    return { ok: true as const };
  });
