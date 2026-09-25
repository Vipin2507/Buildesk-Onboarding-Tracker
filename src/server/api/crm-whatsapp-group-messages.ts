import { and, asc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { ApiError, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

export type StoredWhatsappGroupMessage = {
  id: string;
  accountId: string;
  groupId: string;
  wahaMessageId: string;
  timestamp: number;
  fromMe: boolean;
  from: string;
  participantName?: string;
  body: string;
  hasMedia: boolean;
  mediaType?: string;
  mimetype?: string;
  mediaUrl?: string;
  filename?: string;
  ack?: number;
  replyTo?: string;
};

function messageRowId(accountId: string, wahaMessageId: string) {
  return `${accountId}::${wahaMessageId}`;
}

function mapRow(row: typeof t.crmWhatsappGroupMessages.$inferSelect): StoredWhatsappGroupMessage {
  return {
    id: row.id,
    accountId: row.accountId,
    groupId: row.groupId,
    wahaMessageId: row.wahaMessageId,
    timestamp: row.timestamp,
    fromMe: row.fromMe,
    from: row.fromJid,
    participantName: row.participantName ?? undefined,
    body: row.body,
    hasMedia: row.hasMedia,
    mediaType: row.mediaType ?? undefined,
    mimetype: row.mimetype ?? undefined,
    mediaUrl: row.mediaUrl ?? undefined,
    filename: row.filename ?? undefined,
    ack: row.ack ?? undefined,
    replyTo: row.replyTo ?? undefined,
  };
}

function assertAccountAccess(accountId: string) {
  const user = requireUser();
  const db = getDb();
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, accountId)).get();
  if (!account) throw new ApiError(404, "Account not found");
  if (
    !canViewCrmAccount(
      {
        salesManagerName: account.salesManagerName ?? undefined,
        supportManager1: account.supportManager1 ?? undefined,
        supportManager2: account.supportManager2 ?? undefined,
        accountManagerName: account.accountManagerName ?? undefined,
      },
      user,
    )
  ) {
    throw new ApiError(403, "Forbidden");
  }
  return { user, db, account };
}

const storedMessageSchema = z.object({
  wahaMessageId: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  fromMe: z.boolean(),
  from: z.string().optional().default(""),
  participantName: z.string().optional().nullable(),
  body: z.string().optional().default(""),
  hasMedia: z.boolean().optional().default(false),
  mediaType: z.string().optional().nullable(),
  mimetype: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
  filename: z.string().optional().nullable(),
  ack: z.number().int().optional().nullable(),
  replyTo: z.string().optional().nullable(),
});

export const listCrmWhatsappGroupMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().min(1),
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { db } = assertAccountAccess(data.accountId);
    try {
      const rows = db
        .select()
        .from(t.crmWhatsappGroupMessages)
        .where(
          and(
            eq(t.crmWhatsappGroupMessages.accountId, data.accountId),
            eq(t.crmWhatsappGroupMessages.groupId, data.groupId),
          ),
        )
        .orderBy(asc(t.crmWhatsappGroupMessages.timestamp))
        .all();
      return rows.map(mapRow);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("no such table")) return [];
      throw err;
    }
  });

export const upsertCrmWhatsappGroupMessages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().min(1),
        groupId: z.string().min(1),
        messages: z.array(storedMessageSchema).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { db } = assertAccountAccess(data.accountId);
    if (data.messages.length === 0) return { upserted: 0 };

    const now = nowIso();
    let upserted = 0;

    try {
      db.transaction((txDb) => {
        for (const m of data.messages) {
          const id = messageRowId(data.accountId, m.wahaMessageId);
          const existing = txDb
            .select({ id: t.crmWhatsappGroupMessages.id })
            .from(t.crmWhatsappGroupMessages)
            .where(eq(t.crmWhatsappGroupMessages.id, id))
            .get();

          const values = {
            timestamp: m.timestamp,
            fromMe: m.fromMe,
            fromJid: m.from ?? "",
            participantName: m.participantName ?? null,
            body: m.body ?? "",
            hasMedia: m.hasMedia ?? false,
            mediaType: m.mediaType ?? null,
            mimetype: m.mimetype ?? null,
            mediaUrl: m.mediaUrl ?? null,
            filename: m.filename ?? null,
            ack: m.ack ?? null,
            replyTo: m.replyTo ?? null,
            updatedAt: now,
          };

          if (existing) {
            txDb
              .update(t.crmWhatsappGroupMessages)
              .set(values)
              .where(eq(t.crmWhatsappGroupMessages.id, id))
              .run();
          } else {
            txDb
              .insert(t.crmWhatsappGroupMessages)
              .values({
                id,
                accountId: data.accountId,
                groupId: data.groupId,
                wahaMessageId: m.wahaMessageId,
                ...values,
                createdAt: now,
              })
              .run();
          }
          upserted += 1;
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("no such table")) {
        throw new ApiError(
          503,
          "WhatsApp message cache table missing — run npm run db:ensure",
        );
      }
      throw err;
    }

    return { upserted };
  });
