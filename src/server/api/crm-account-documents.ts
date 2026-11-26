import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  decodeCrmAccountDocumentPayload,
  deleteCrmAccountDocumentFromDisk,
  saveCrmAccountDocumentFile,
} from "@/server/lib/crm-account-document-storage";
import {
  crmAccountDocumentRejectReason,
  type CrmAccountDocument,
  type CrmAccountDocumentKind,
} from "@/types/crm-account-document";

function publicUrl(storageKey: string) {
  return `/api/crm-account-documents/${encodeURIComponent(storageKey).replace(/%2F/g, "/")}`;
}

function mapRow(row: typeof t.crmAccountDocuments.$inferSelect): CrmAccountDocument {
  return {
    id: row.id,
    accountId: row.accountId,
    kind: row.kind === "signoff" ? "signoff" : "file",
    title: row.title?.trim() || undefined,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: publicUrl(row.storageKey),
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
  };
}

function requireAccount(user: { name: string; role: string }, accountId: string) {
  const db = getDb();
  const row = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!row) throw new ApiError(404, "CRM account not found");
  if (
    !isAdminRoleKey(user.role) &&
    !canViewCrmAccount(
      {
        salesManagerName: row.salesManagerName ?? undefined,
        supportManager1: row.supportManager1 ?? undefined,
        supportManager2: row.supportManager2 ?? undefined,
      },
      user,
    )
  ) {
    throw new ApiError(403, "You do not have permission to view this account");
  }
  return row;
}

function setSignOffUploadedAt(accountId: string, uploadedAt: string | null) {
  const db = getDb();
  db.update(t.crmAccounts)
    .set({ signOffUploadedAt: uploadedAt, updatedAt: nowIso() })
    .where(eq(t.crmAccounts.id, accountId))
    .run();
}

export const listCrmAccountDocuments = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ accountId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    requireAccount(user, data.accountId);
    const db = getDb();
    return db
      .select()
      .from(t.crmAccountDocuments)
      .where(eq(t.crmAccountDocuments.accountId, data.accountId))
      .orderBy(desc(t.crmAccountDocuments.uploadedAt))
      .all()
      .map(mapRow);
  });

export const uploadCrmAccountDocument = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().min(1),
        kind: z.enum(["file", "signoff"]),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(200),
        dataBase64: z.string().min(1),
        title: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    requireAccount(user, data.accountId);
    const buffer = decodeCrmAccountDocumentPayload(data.dataBase64);
    const rejected = crmAccountDocumentRejectReason(data.fileName, buffer.length);
    if (rejected) throw new ApiError(400, rejected);

    const db = getDb();
    const id = newId();
    const now = nowIso();
    const kind: CrmAccountDocumentKind = data.kind;
    const saved = saveCrmAccountDocumentFile({
      accountId: data.accountId,
      documentId: id,
      fileName: data.fileName.trim(),
      mimeType: data.mimeType,
      buffer,
    });

    if (kind === "signoff") {
      const previous = db
        .select()
        .from(t.crmAccountDocuments)
        .where(
          and(
            eq(t.crmAccountDocuments.accountId, data.accountId),
            eq(t.crmAccountDocuments.kind, "signoff"),
          ),
        )
        .all();
      for (const row of previous) {
        deleteCrmAccountDocumentFromDisk(row.storageKey);
        db.delete(t.crmAccountDocuments).where(eq(t.crmAccountDocuments.id, row.id)).run();
      }
    }

    db.insert(t.crmAccountDocuments)
      .values({
        id,
        accountId: data.accountId,
        kind,
        title: data.title?.trim() || null,
        fileName: data.fileName.trim(),
        mimeType: data.mimeType,
        sizeBytes: buffer.length,
        storageKey: saved.storageKey,
        uploadedBy: user.name,
        uploadedByUserId: user.id,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    if (kind === "signoff") setSignOffUploadedAt(data.accountId, now);

    const row = db.select().from(t.crmAccountDocuments).where(eq(t.crmAccountDocuments.id, id)).get();
    if (!row) throw new ApiError(500, "Failed to save document");
    return mapRow(row);
  });

export const updateCrmAccountDocument = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        title: z.string().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = db
      .select()
      .from(t.crmAccountDocuments)
      .where(eq(t.crmAccountDocuments.id, data.id))
      .get();
    if (!existing) throw new ApiError(404, "Document not found");
    requireAccount(user, existing.accountId);
    const now = nowIso();
    db.update(t.crmAccountDocuments)
      .set({ title: data.title.trim() || null, updatedAt: now })
      .where(eq(t.crmAccountDocuments.id, data.id))
      .run();
    const row = db.select().from(t.crmAccountDocuments).where(eq(t.crmAccountDocuments.id, data.id)).get();
    if (!row) throw new ApiError(500, "Failed to update document");
    return mapRow(row);
  });

export const deleteCrmAccountDocument = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = db
      .select()
      .from(t.crmAccountDocuments)
      .where(eq(t.crmAccountDocuments.id, data.id))
      .get();
    if (!existing) throw new ApiError(404, "Document not found");
    requireAccount(user, existing.accountId);
    deleteCrmAccountDocumentFromDisk(existing.storageKey);
    db.delete(t.crmAccountDocuments).where(eq(t.crmAccountDocuments.id, data.id)).run();
    if (existing.kind === "signoff") {
      const remaining = db
        .select()
        .from(t.crmAccountDocuments)
        .where(
          and(
            eq(t.crmAccountDocuments.accountId, existing.accountId),
            eq(t.crmAccountDocuments.kind, "signoff"),
          ),
        )
        .get();
      if (!remaining) setSignOffUploadedAt(existing.accountId, null);
    }
    return { id: data.id, accountId: existing.accountId, kind: existing.kind };
  });
