import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type {
  CrmAccountQuery,
  CrmAccountQueryAttachment,
  CrmAccountQueryMessage,
  CrmAccountQueryMessageType,
  CrmAccountQueryStatus,
} from "@/types/crm-account-query";

const attachmentSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
});

function parseAttachments(json: string | null | undefined): CrmAccountQueryAttachment[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as CrmAccountQueryAttachment[];
    return parsed.length ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function serializeAttachments(attachments?: CrmAccountQueryAttachment[]) {
  return attachments?.length ? JSON.stringify(attachments) : null;
}

function mapMessage(row: typeof t.crmAccountQueryMessages.$inferSelect): CrmAccountQueryMessage {
  return {
    id: row.id,
    queryId: row.queryId,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    messageType: row.messageType as CrmAccountQueryMessageType,
    body: row.body,
    attachments: parseAttachments(row.attachmentsJson),
    createdAt: row.createdAt,
  };
}

function mapQuery(
  row: typeof t.crmAccountQueries.$inferSelect,
  messages: typeof t.crmAccountQueryMessages.$inferSelect[],
): CrmAccountQuery {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    status: row.status as CrmAccountQueryStatus,
    category: (row.category as CrmAccountQuery["category"]) ?? undefined,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    resolvedAt: row.resolvedAt ?? undefined,
    resolvedByUserId: row.resolvedByUserId ?? undefined,
    resolvedByName: row.resolvedByName ?? undefined,
    messages: messages.map(mapMessage),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function accountAccessFields(row: typeof t.crmAccounts.$inferSelect) {
  return {
    salesManagerName: row.salesManagerName ?? undefined,
    supportManager1: row.supportManager1 ?? undefined,
    supportManager2: row.supportManager2 ?? undefined,
    accountManagerName: row.accountManagerName ?? undefined,
  };
}

function assertCanAccessCompany(
  user: { id: string; name: string; role: string },
  companyId: string,
) {
  const db = getDb();
  const account = db
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, companyId))
    .get();
  if (!account) throw new ApiError(404, "Account not found");
  if (!canViewCrmAccount(accountAccessFields(account), user)) {
    throw new ApiError(403, "You do not have access to this account");
  }
  return account;
}

function loadQuery(db: ReturnType<typeof getDb>, queryId: string): CrmAccountQuery | null {
  const row = db
    .select()
    .from(t.crmAccountQueries)
    .where(eq(t.crmAccountQueries.id, queryId))
    .get();
  if (!row) return null;
  const messages = db
    .select()
    .from(t.crmAccountQueryMessages)
    .where(eq(t.crmAccountQueryMessages.queryId, queryId))
    .orderBy(asc(t.crmAccountQueryMessages.createdAt))
    .all();
  return mapQuery(row, messages);
}

function loadQueriesForCompany(db: ReturnType<typeof getDb>, companyId: string): CrmAccountQuery[] {
  const rows = db
    .select()
    .from(t.crmAccountQueries)
    .where(eq(t.crmAccountQueries.companyId, companyId))
    .orderBy(desc(t.crmAccountQueries.updatedAt))
    .all();
  return rows.map((row) => {
    const messages = db
      .select()
      .from(t.crmAccountQueryMessages)
      .where(eq(t.crmAccountQueryMessages.queryId, row.id))
      .orderBy(asc(t.crmAccountQueryMessages.createdAt))
      .all();
    return mapQuery(row, messages);
  });
}

const createQuerySchema = z.object({
  companyId: z.string().min(1),
  title: z.string().min(1).max(200),
  category: z.enum(["general", "billing", "technical", "onboarding"]).optional(),
  initialMessage: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const addMessageSchema = z.object({
  queryId: z.string().min(1),
  body: z.string().min(1),
  messageType: z.enum(["text", "image", "voice", "file"]).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const updateStatusSchema = z.object({
  queryId: z.string().min(1),
  status: z.enum(["open", "resolved", "archived"]),
});

export const listCrmAccountQueries = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanAccessCompany(user, data.companyId);
    const db = getDb();
    return loadQueriesForCompany(db, data.companyId);
  });

export const getCrmAccountQuery = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const query = loadQuery(db, data.id);
    if (!query) throw new ApiError(404, "Query not found");
    assertCanAccessCompany(user, query.companyId);
    return query;
  });

export const createCrmAccountQuery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanAccessCompany(user, data.companyId);
    const db = getDb();
    const now = nowIso();
    const id = newId();
    const initialBody = data.initialMessage?.trim();

    db.insert(t.crmAccountQueries)
      .values({
        id,
        companyId: data.companyId,
        title: data.title.trim(),
        status: "open",
        category: data.category ?? "general",
        createdByUserId: user.id,
        createdByName: user.name,
        resolvedAt: null,
        resolvedByUserId: null,
        resolvedByName: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    if (initialBody) {
      db.insert(t.crmAccountQueryMessages)
        .values({
          id: newId(),
          queryId: id,
          authorUserId: user.id,
          authorName: user.name,
          messageType: "text",
          body: initialBody,
          attachmentsJson: serializeAttachments(data.attachments),
          createdAt: now,
        })
        .run();
    }

    return loadQuery(db, id)!;
  });

export const addCrmAccountQueryMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => addMessageSchema.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = loadQuery(db, data.queryId);
    if (!existing) throw new ApiError(404, "Query not found");
    assertCanAccessCompany(user, existing.companyId);
    if (existing.status === "archived") {
      throw new ApiError(400, "Cannot reply to an archived query");
    }

    const now = nowIso();
    const messageType = data.messageType ?? "text";
    const wasResolved = existing.status === "resolved";

    if (wasResolved) {
      db.insert(t.crmAccountQueryMessages)
        .values({
          id: newId(),
          queryId: data.queryId,
          authorUserId: user.id,
          authorName: user.name,
          messageType: "system",
          body: `${user.name} reopened this query`,
          attachmentsJson: null,
          createdAt: now,
        })
        .run();
    }

    db.insert(t.crmAccountQueryMessages)
      .values({
        id: newId(),
        queryId: data.queryId,
        authorUserId: user.id,
        authorName: user.name,
        messageType,
        body: data.body.trim(),
        attachmentsJson: serializeAttachments(data.attachments),
        createdAt: now,
      })
      .run();

    db.update(t.crmAccountQueries)
      .set({
        updatedAt: now,
        status: wasResolved ? "open" : existing.status,
        resolvedAt: wasResolved ? null : existing.resolvedAt,
        resolvedByUserId: wasResolved ? null : existing.resolvedByUserId,
        resolvedByName: wasResolved ? null : existing.resolvedByName,
      })
      .where(eq(t.crmAccountQueries.id, data.queryId))
      .run();

    return loadQuery(db, data.queryId)!;
  });

export const updateCrmAccountQueryStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateStatusSchema.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = loadQuery(db, data.queryId);
    if (!existing) throw new ApiError(404, "Query not found");
    assertCanAccessCompany(user, existing.companyId);

    const now = nowIso();
    const resolved = data.status === "resolved";

    db.update(t.crmAccountQueries)
      .set({
        status: data.status,
        updatedAt: now,
        resolvedAt: resolved ? now : null,
        resolvedByUserId: resolved ? user.id : null,
        resolvedByName: resolved ? user.name : null,
      })
      .where(eq(t.crmAccountQueries.id, data.queryId))
      .run();

    const statusLabel =
      data.status === "open"
        ? "reopened"
        : data.status === "resolved"
          ? "marked as resolved"
          : "archived";
    db.insert(t.crmAccountQueryMessages)
      .values({
        id: newId(),
        queryId: data.queryId,
        authorUserId: user.id,
        authorName: user.name,
        messageType: "system",
        body: `${user.name} ${statusLabel} this query`,
        attachmentsJson: null,
        createdAt: now,
      })
      .run();

    return loadQuery(db, data.queryId)!;
  });
