import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { ActivityEntry, CompanyAttachment, CompanyNote } from "@/types";

export const listActivity = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser();
    const db = getDb();
    let rows = db.select().from(t.activityEntries).orderBy(desc(t.activityEntries.createdAt)).all();
    if (data?.companyId) rows = rows.filter((r) => r.companyId === data.companyId);
    if (data?.projectId) rows = rows.filter((r) => r.projectId === data.projectId);
    const limit = data?.limit ?? 50;
    return rows.slice(0, limit) as ActivityEntry[];
  });

export const listNotes = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    return getDb()
      .select()
      .from(t.companyNotes)
      .where(eq(t.companyNotes.companyId, data.companyId))
      .orderBy(desc(t.companyNotes.createdAt))
      .all()
      .map(
        (n) =>
          ({
            ...n,
            pinned: n.pinned ?? false,
            projectId: n.projectId ?? undefined,
          }) satisfies CompanyNote,
      );
  });

export const addNote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        companyId: z.string(),
        body: z.string().min(1),
        projectId: z.string().optional(),
        pinned: z.boolean().optional(),
        author: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const now = nowIso();
    const id = data.id ?? newId();
    getDb()
      .insert(t.companyNotes)
      .values({
        id,
        companyId: data.companyId,
        body: data.body,
        author: data.author ?? user.name,
        projectId: data.projectId,
        pinned: data.pinned ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return {
      id,
      companyId: data.companyId,
      body: data.body,
      author: data.author ?? user.name,
      projectId: data.projectId,
      pinned: data.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    } satisfies CompanyNote;
  });

export const listAllNotes = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb()
    .select()
    .from(t.companyNotes)
    .orderBy(desc(t.companyNotes.createdAt))
    .all()
    .map(
      (n) =>
        ({
          ...n,
          pinned: n.pinned ?? false,
          projectId: n.projectId ?? undefined,
        }) satisfies CompanyNote,
    );
});

export const listAllAttachments = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return getDb()
    .select()
    .from(t.companyAttachments)
    .orderBy(desc(t.companyAttachments.uploadedAt))
    .all()
    .map(
      (a) =>
        ({
          ...a,
          projectId: a.projectId ?? undefined,
          context: a.context ?? undefined,
          recordCount: a.recordCount ?? undefined,
          category: a.category as CompanyAttachment["category"],
        }) satisfies CompanyAttachment,
    );
});

export const updateNote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        patch: z.object({ body: z.string().optional(), pinned: z.boolean().optional() }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    getDb()
      .update(t.companyNotes)
      .set({ ...data.patch, updatedAt: nowIso() })
      .where(eq(t.companyNotes.id, data.id))
      .run();
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb().delete(t.companyNotes).where(eq(t.companyNotes.id, data.id)).run();
    return { ok: true };
  });

export const listAttachments = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    return getDb()
      .select()
      .from(t.companyAttachments)
      .where(eq(t.companyAttachments.companyId, data.companyId))
      .orderBy(desc(t.companyAttachments.uploadedAt))
      .all()
      .map(
        (a) =>
          ({
            ...a,
            projectId: a.projectId ?? undefined,
            context: a.context ?? undefined,
            recordCount: a.recordCount ?? undefined,
            category: a.category as CompanyAttachment["category"],
          }) satisfies CompanyAttachment,
      );
  });

export const deleteAttachment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin", "Manager"]);
    getDb().delete(t.companyAttachments).where(eq(t.companyAttachments.id, data.id)).run();
    return { ok: true };
  });
