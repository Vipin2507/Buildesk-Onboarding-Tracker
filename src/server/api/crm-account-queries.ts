import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { resolveCrmQueryMentionUserIds } from "@/lib/crm-query-mentions";
import { isAdminRoleKey } from "@/lib/permissions";
import {
  insertNotificationsForUserIds,
  resolveNotificationRecipientIds,
} from "@/server/api/notifications";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  decodeUploadPayload,
  saveCrmQueryUpload,
} from "@/server/lib/crm-query-file-storage";
import {
  getCrmQueryTypingUsers,
  setCrmQueryTyping,
} from "@/server/lib/crm-query-typing";
import type {
  CrmAccountQuery,
  CrmAccountQueryAttachment,
  CrmAccountQueryMessage,
  CrmAccountQueryMessageType,
  CrmAccountQueryStatus,
  CrmAccountQuerySummary,
} from "@/types/crm-account-query";

const attachmentSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  storageKey: z.string().optional(),
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

function lastMessagePreview(messages: CrmAccountQueryMessage[]) {
  const last = messages[messages.length - 1];
  if (!last) return undefined;
  if (last.messageType === "system") return last.body;
  if (last.messageType === "image") return "Image attachment";
  if (last.messageType === "voice") return "Voice note";
  if (last.messageType === "file") {
    const name = last.attachments?.[0]?.name;
    return name ? `File: ${name}` : "File attachment";
  }
  return last.body.slice(0, 120);
}

function mapQuerySummary(
  row: typeof t.crmAccountQueries.$inferSelect,
  messages: typeof t.crmAccountQueryMessages.$inferSelect[],
  accountName?: string,
): CrmAccountQuerySummary {
  const mappedMessages = messages.map(mapMessage);
  return {
    id: row.id,
    companyId: row.companyId,
    accountName,
    title: row.title,
    status: row.status as CrmAccountQueryStatus,
    category: (row.category as CrmAccountQuerySummary["category"]) ?? undefined,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    messageCount: mappedMessages.length,
    lastMessagePreview: lastMessagePreview(mappedMessages),
    resolvedAt: row.resolvedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function loadMentionCandidatesForCompany(db: ReturnType<typeof getDb>, companyId: string) {
  const recipientIds = resolveNotificationRecipientIds(db, {
    companyId,
    productScope: "crm",
  });
  const users = db.select().from(t.users).all();
  return users
    .filter((u) => recipientIds.includes(u.id) && u.active !== false)
    .map((u) => ({ id: u.id, name: u.name }));
}

function notifyAccountQueryMentions(
  db: ReturnType<typeof getDb>,
  opts: {
    companyId: string;
    queryId: string;
    queryTitle: string;
    body: string;
    authorName: string;
    authorUserId: string;
  },
): string[] {
  const candidates = loadMentionCandidatesForCompany(db, opts.companyId);
  const mentionedIds = resolveCrmQueryMentionUserIds(opts.body, candidates).filter(
    (id) => id !== opts.authorUserId,
  );
  if (!mentionedIds.length) return [];

  const users = db.select().from(t.users).all();
  const enabledIds = mentionedIds.filter((id) => {
    const user = users.find((u) => u.id === id);
    return user?.active !== false && user?.notifyInApp !== false;
  });

  if (enabledIds.length) {
    insertNotificationsForUserIds(db, enabledIds, {
      title: `${opts.authorName} mentioned you`,
      body: `${opts.queryTitle}: ${opts.body.trim().slice(0, 120)}`,
      href: `/crm/accounts/${opts.companyId}?tab=queries&queryId=${opts.queryId}`,
      companyId: opts.companyId,
      ticketId: opts.queryId,
      kind: "warning",
    });
  }

  return mentionedIds;
}

function notifyAccountQueryParticipants(
  db: ReturnType<typeof getDb>,
  opts: {
    companyId: string;
    queryId: string;
    title: string;
    body: string;
    excludeUserId: string;
    alsoExcludeUserIds?: string[];
    kind?: "info" | "success" | "warning";
  },
) {
  const extraExclude = new Set(opts.alsoExcludeUserIds ?? []);
  const recipientIds = resolveNotificationRecipientIds(db, {
    companyId: opts.companyId,
    productScope: "crm",
  }).filter((id) => id !== opts.excludeUserId && !extraExclude.has(id));

  const users = db.select().from(t.users).all();
  const enabledIds = recipientIds.filter((id) => {
    const user = users.find((u) => u.id === id);
    return user?.active !== false && user?.notifyInApp !== false;
  });

  if (!enabledIds.length) return;

  insertNotificationsForUserIds(db, enabledIds, {
    title: opts.title,
    body: opts.body,
    href: `/crm/accounts/${opts.companyId}?tab=queries&queryId=${opts.queryId}`,
    companyId: opts.companyId,
    ticketId: opts.queryId,
    kind: opts.kind ?? "info",
  });
}

function loadAccessibleAccountMap(
  db: ReturnType<typeof getDb>,
  user: { id: string; name: string; role: string },
) {
  const rows = db.select().from(t.crmAccounts).all();
  const map = new Map<string, { id: string; name: string }>();
  for (const row of rows) {
    if (isAdminRoleKey(user.role) || canViewCrmAccount(accountAccessFields(row), user)) {
      map.set(row.id, { id: row.id, name: row.name });
    }
  }
  return map;
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

export const listAllCrmAccountQueries = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.enum(["all", "open", "resolved", "archived"]).optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const accountMap = loadAccessibleAccountMap(db, user);
    const rows = db
      .select()
      .from(t.crmAccountQueries)
      .orderBy(desc(t.crmAccountQueries.updatedAt))
      .all()
      .filter((row) => accountMap.has(row.companyId));

    return rows
      .filter((row) => !data?.status || data.status === "all" || row.status === data.status)
      .map((row) => {
        const messages = db
          .select()
          .from(t.crmAccountQueryMessages)
          .where(eq(t.crmAccountQueryMessages.queryId, row.id))
          .orderBy(asc(t.crmAccountQueryMessages.createdAt))
          .all();
        return mapQuerySummary(row, messages, accountMap.get(row.companyId)?.name);
      });
  });

export const uploadCrmQueryAttachment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        queryId: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        dataBase64: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const query = loadQuery(db, data.queryId);
    if (!query) throw new ApiError(404, "Query not found");
    assertCanAccessCompany(user, query.companyId);
    if (query.status === "archived") {
      throw new ApiError(400, "Cannot upload to an archived query");
    }

    const buffer = decodeUploadPayload(data.dataBase64);
    const saved = saveCrmQueryUpload({
      queryId: data.queryId,
      fileName: data.fileName,
      mimeType: data.mimeType,
      buffer,
    });

    return {
      name: data.fileName,
      url: saved.url,
      mimeType: data.mimeType,
      sizeBytes: buffer.length,
      storageKey: saved.storageKey,
    } satisfies CrmAccountQueryAttachment;
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

export const syncCrmAccountQuery = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        queryId: z.string().min(1),
        updatedAt: z.string().optional(),
        messageCount: z.number().int().nonnegative().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const query = loadQuery(db, data.queryId);
    if (!query) throw new ApiError(404, "Query not found");
    assertCanAccessCompany(user, query.companyId);

    const changed =
      !data.updatedAt ||
      data.updatedAt !== query.updatedAt ||
      (data.messageCount != null && data.messageCount !== query.messages.length);

    return {
      changed,
      query: changed ? query : undefined,
      typing: getCrmQueryTypingUsers(data.queryId, user.id),
    };
  });

export const setCrmAccountQueryTyping = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        queryId: z.string().min(1),
        typing: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const query = loadQuery(db, data.queryId);
    if (!query) throw new ApiError(404, "Query not found");
    assertCanAccessCompany(user, query.companyId);
    setCrmQueryTyping(data.queryId, user.id, user.name, data.typing);
    return { ok: true as const };
  });

export const createCrmAccountQuery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const account = assertCanAccessCompany(user, data.companyId);
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

    const mentionedIds = initialBody
      ? notifyAccountQueryMentions(db, {
          companyId: data.companyId,
          queryId: id,
          queryTitle: data.title.trim(),
          body: initialBody,
          authorName: user.name,
          authorUserId: user.id,
        })
      : [];

    notifyAccountQueryParticipants(db, {
      companyId: data.companyId,
      queryId: id,
      title: `New account query · ${account.name}`,
      body: data.title.trim(),
      excludeUserId: user.id,
      alsoExcludeUserIds: mentionedIds,
    });

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

    const mentionedIds = notifyAccountQueryMentions(db, {
      companyId: existing.companyId,
      queryId: data.queryId,
      queryTitle: existing.title,
      body: data.body.trim(),
      authorName: user.name,
      authorUserId: user.id,
    });

    notifyAccountQueryParticipants(db, {
      companyId: existing.companyId,
      queryId: data.queryId,
      title: `Reply on ${existing.title}`,
      body: `${user.name}: ${data.body.trim().slice(0, 120)}`,
      excludeUserId: user.id,
      alsoExcludeUserIds: mentionedIds,
    });

    setCrmQueryTyping(data.queryId, user.id, user.name, false);

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

    notifyAccountQueryParticipants(db, {
      companyId: existing.companyId,
      queryId: data.queryId,
      title: `${existing.title} · ${data.status}`,
      body: `${user.name} ${statusLabel} this query`,
      excludeUserId: user.id,
      kind: data.status === "resolved" ? "success" : "info",
    });

    return loadQuery(db, data.queryId)!;
  });
