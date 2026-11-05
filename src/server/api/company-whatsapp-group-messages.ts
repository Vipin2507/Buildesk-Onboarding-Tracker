import { and, desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ApiError, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { StoredWhatsappGroupMessage } from "@/server/api/crm-whatsapp-group-messages";

function messageRowId(companyId: string, wahaMessageId: string) {
  return `${companyId}::${wahaMessageId}`;
}

function mapRow(row: typeof t.companyWhatsappGroupMessages.$inferSelect): StoredWhatsappGroupMessage {
  return {
    id: row.id,
    accountId: row.companyId,
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
    replyPreview: row.replyPreview ?? undefined,
  };
}

function assertCompany(companyId: string) {
  const user = requireUser();
  const db = getDb();
  const company = db.select().from(t.companies).where(eq(t.companies.id, companyId)).get();
  if (!company) throw new ApiError(404, "Company not found");
  return { user, db, company };
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
  replyPreview: z.string().optional().nullable(),
});

export const listCompanyWhatsappGroupMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().min(1),
        groupId: z.string().min(1),
        limit: z.number().int().positive().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { db } = assertCompany(data.companyId);
    const limit = data.limit ?? 120;
    try {
      const rows = db
        .select()
        .from(t.companyWhatsappGroupMessages)
        .where(
          and(
            eq(t.companyWhatsappGroupMessages.companyId, data.companyId),
            eq(t.companyWhatsappGroupMessages.groupId, data.groupId),
          ),
        )
        .orderBy(desc(t.companyWhatsappGroupMessages.timestamp))
        .limit(limit)
        .all();
      return rows.reverse().map(mapRow);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("no such table")) return [];
      throw err;
    }
  });

export const upsertCompanyWhatsappGroupMessages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().min(1),
        groupId: z.string().min(1),
        messages: z.array(storedMessageSchema).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { db } = assertCompany(data.companyId);
    if (data.messages.length === 0) return { upserted: 0 };

    const now = nowIso();
    let upserted = 0;

    try {
      db.transaction((txDb) => {
        for (const m of data.messages) {
          const id = messageRowId(data.companyId, m.wahaMessageId);
          const existing = txDb
            .select()
            .from(t.companyWhatsappGroupMessages)
            .where(eq(t.companyWhatsappGroupMessages.id, id))
            .get();

          const mediaUrl = m.mediaUrl || existing?.mediaUrl || null;
          const mediaType = m.mediaType || existing?.mediaType || null;
          const mimetype = m.mimetype || existing?.mimetype || null;
          const filename = m.filename || existing?.filename || null;
          const hasMedia = Boolean(m.hasMedia || existing?.hasMedia || mediaUrl);

          const values = {
            timestamp: m.timestamp,
            fromMe: m.fromMe,
            fromJid: m.from ?? "",
            participantName: m.participantName ?? existing?.participantName ?? null,
            body: (m.body ?? "") || existing?.body || "",
            hasMedia,
            mediaType,
            mimetype,
            mediaUrl,
            filename,
            ack: m.ack ?? existing?.ack ?? null,
            replyTo: m.replyTo ?? existing?.replyTo ?? null,
            replyPreview: m.replyPreview || existing?.replyPreview || null,
            updatedAt: now,
          };

          if (existing) {
            txDb
              .update(t.companyWhatsappGroupMessages)
              .set(values)
              .where(eq(t.companyWhatsappGroupMessages.id, id))
              .run();
          } else {
            txDb
              .insert(t.companyWhatsappGroupMessages)
              .values({
                id,
                companyId: data.companyId,
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
        throw new ApiError(503, "WhatsApp message cache table missing — run npm run db:ensure");
      }
      throw err;
    }

    return { upserted };
  });
