import { and, desc, eq, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { loadCrmAutomationConfig } from "@/server/crm-booking-automation";
import {
  listAccountIdsWithGroups,
  processWhatsappBroadcasts,
  resolveBroadcastBody,
} from "@/server/crm-whatsapp-broadcast";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  decodeBroadcastMediaBase64,
  inferBroadcastMediaKind,
  saveBroadcastMedia,
} from "@/server/lib/crm-whatsapp-broadcast-media";
import type {
  CrmWhatsappBroadcast,
  CrmWhatsappBroadcastDelivery,
  CrmWhatsappBroadcastDeliveryStatus,
  CrmWhatsappBroadcastStatus,
} from "@/types/crm-whatsapp-broadcast";

function normalizeGroupId(raw: string | null | undefined) {
  const id = (raw ?? "").trim();
  if (!id) return "";
  if (id.includes("@g.us")) return id;
  if (/^\d+$/.test(id)) return `${id}@g.us`;
  return id;
}

function mapBroadcast(
  row: typeof t.crmWhatsappBroadcasts.$inferSelect,
  counts: { accountCount: number; sentCount: number; failedCount: number; skippedCount: number },
): CrmWhatsappBroadcast {
  const mediaKind =
    row.mediaKind === "image" ||
    row.mediaKind === "video" ||
    row.mediaKind === "voice" ||
    row.mediaKind === "file"
      ? row.mediaKind
      : null;
  return {
    id: row.id,
    scheduledAt: row.scheduledAt,
    status: row.status as CrmWhatsappBroadcastStatus,
    templateId: row.templateId,
    templateName: row.templateName,
    body: row.body,
    mediaKind,
    mediaFilename: row.mediaFilename,
    mediaMimetype: row.mediaMimetype,
    hasMedia: Boolean(row.mediaStorageKey && mediaKind),
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...counts,
  };
}

function deliveryCounts(db: ReturnType<typeof getDb>, broadcastId: string) {
  const rows = db
    .select({
      status: t.crmWhatsappBroadcastDeliveries.status,
      c: sql<number>`count(*)`,
    })
    .from(t.crmWhatsappBroadcastDeliveries)
    .where(eq(t.crmWhatsappBroadcastDeliveries.broadcastId, broadcastId))
    .groupBy(t.crmWhatsappBroadcastDeliveries.status)
    .all();

  let accountCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  for (const r of rows) {
    const n = Number(r.c) || 0;
    accountCount += n;
    if (r.status === "sent") sentCount += n;
    else if (r.status === "failed") failedCount += n;
    else if (r.status === "skipped") skippedCount += n;
  }
  return { accountCount, sentCount, failedCount, skippedCount };
}

function mapDelivery(
  row: typeof t.crmWhatsappBroadcastDeliveries.$inferSelect,
): CrmWhatsappBroadcastDelivery {
  return {
    id: row.id,
    broadcastId: row.broadcastId,
    accountId: row.accountId,
    accountName: row.accountName,
    groupId: row.groupId,
    renderedBody: row.renderedBody,
    status: row.status as CrmWhatsappBroadcastDeliveryStatus,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt,
  };
}

function assertCanAccessBroadcast(
  row: typeof t.crmWhatsappBroadcasts.$inferSelect,
  user: { id: string; role?: string },
) {
  if (isAdminRoleKey(user.role)) return;
  if (row.createdByUserId === user.id) return;
  throw new ApiError(403, "Forbidden");
}

export const listCrmWhatsappBroadcasts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().int().positive().max(100).optional(),
        /** When true (admin only), include everyone’s pending schedules. */
        allScheduled: z.boolean().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const limit = data?.limit ?? 40;
    const isAdmin = isAdminRoleKey(user.role);
    try {
      let rows = db
        .select()
        .from(t.crmWhatsappBroadcasts)
        .orderBy(desc(t.crmWhatsappBroadcasts.createdAt))
        .limit(isAdmin ? limit : Math.min(limit, 60))
        .all();

      if (!isAdmin) {
        // Non-admins: own broadcasts only (sends + their schedules).
        rows = rows.filter((r) => r.createdByUserId === user.id);
      } else if (data?.allScheduled === false) {
        // unused flag — admins always get full list by default
      }

      return {
        isAdmin,
        broadcasts: rows.map((row) => mapBroadcast(row, deliveryCounts(db, row.id))),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("no such table")) return { isAdmin, broadcasts: [] };
      throw err;
    }
  });

export const getCrmWhatsappBroadcast = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Broadcast not found");
    assertCanAccessBroadcast(row, user);
    const deliveries = db
      .select()
      .from(t.crmWhatsappBroadcastDeliveries)
      .where(eq(t.crmWhatsappBroadcastDeliveries.broadcastId, row.id))
      .all()
      .map(mapDelivery);
    return {
      broadcast: mapBroadcast(row, deliveryCounts(db, row.id)),
      deliveries,
    };
  });

export const createCrmWhatsappBroadcast = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accountIds: z.array(z.string().min(1)).min(1).max(200),
        templateId: z.string().min(1).optional().nullable(),
        body: z.string().max(8000).optional().nullable(),
        scheduledAt: z.string().optional().nullable(),
        sendNow: z.boolean().optional(),
        media: z
          .object({
            filename: z.string().min(1).max(200),
            mimetype: z.string().min(1).max(120),
            /** Base64 (optionally data-URL prefixed). */
            dataBase64: z.string().min(1),
          })
          .optional()
          .nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();

    const hasMedia = Boolean(data.media?.dataBase64);
    let resolved;
    try {
      if ((data.body ?? "").trim() || data.templateId) {
        resolved = resolveBroadcastBody(db, {
          templateId: data.templateId,
          body: data.body,
        });
      } else if (hasMedia) {
        resolved = { body: "", templateId: null, templateName: null };
      } else {
        throw new Error("Message body or media is required");
      }
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Invalid message");
    }

    const uniqueIds = [...new Set(data.accountIds.map((id) => id.trim()).filter(Boolean))];
    const accounts = listAccountIdsWithGroups(db, uniqueIds).filter((a) =>
      canViewCrmAccount(
        {
          salesManagerName: a.salesManagerName ?? undefined,
          supportManager1: a.supportManager1 ?? undefined,
          supportManager2: a.supportManager2 ?? undefined,
          accountManagerName: a.accountManagerName ?? undefined,
        },
        user,
      ),
    );
    if (accounts.length === 0) {
      throw new ApiError(400, "No accessible accounts selected");
    }

    const withGroups = accounts.filter((a) => normalizeGroupId(a.whatsappGroupId));
    if (withGroups.length === 0) {
      throw new ApiError(
        400,
        "None of the selected accounts have a WhatsApp group linked.",
      );
    }

    const now = nowIso();
    const wantsSchedule = Boolean(data.scheduledAt?.trim()) && data.sendNow !== true;
    let scheduledAt = now;
    if (wantsSchedule) {
      const parsed = Date.parse(data.scheduledAt!.trim());
      if (!Number.isFinite(parsed)) throw new ApiError(400, "Invalid schedule time");
      scheduledAt = parsed <= Date.now() ? now : new Date(parsed).toISOString();
    }

    const shouldRunNow = Date.parse(scheduledAt) <= Date.now() + 2_000;
    if (shouldRunNow) {
      const config = loadCrmAutomationConfig(db);
      if (!config.waha.isEnabled || !config.waha.apiUrl?.trim() || !config.waha.apiKey?.trim()) {
        throw new ApiError(400, "WhatsApp (WAHA) is not enabled. Ask an admin to configure it.");
      }
    }

    const broadcastId = newId();
    let mediaKind: string | null = null;
    let mediaFilename: string | null = null;
    let mediaMimetype: string | null = null;
    let mediaStorageKey: string | null = null;
    if (data.media?.dataBase64) {
      const buffer = decodeBroadcastMediaBase64(data.media.dataBase64);
      mediaFilename = data.media.filename.trim() || "file";
      mediaMimetype = data.media.mimetype.trim() || "application/octet-stream";
      mediaKind = inferBroadcastMediaKind(mediaMimetype);
      mediaStorageKey = saveBroadcastMedia({
        broadcastId,
        fileName: mediaFilename,
        mimeType: mediaMimetype,
        buffer,
      }).storageKey;
    }

    db.insert(t.crmWhatsappBroadcasts)
      .values({
        id: broadcastId,
        scheduledAt,
        status: "pending",
        templateId: resolved.templateId,
        templateName: resolved.templateName,
        body: resolved.body,
        mediaKind,
        mediaFilename,
        mediaMimetype,
        mediaStorageKey,
        createdByUserId: user.id,
        createdByName: user.name,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (const account of accounts) {
      const groupId = normalizeGroupId(account.whatsappGroupId) || null;
      db.insert(t.crmWhatsappBroadcastDeliveries)
        .values({
          id: newId(),
          broadcastId,
          accountId: account.id,
          accountName: account.name,
          groupId,
          renderedBody: null,
          status: groupId ? "pending" : "skipped",
          errorMessage: groupId ? null : "No WhatsApp group linked",
          sentAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    if (shouldRunNow) {
      try {
        await processWhatsappBroadcasts(db, { broadcastId });
      } catch (err) {
        console.warn("[crm-whatsapp-broadcast] immediate process failed", err);
      }
    }

    const row = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, broadcastId))
      .get()!;
    return mapBroadcast(row, deliveryCounts(db, broadcastId));
  });

export const cancelCrmWhatsappBroadcast = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Broadcast not found");
    assertCanAccessBroadcast(row, user);
    if (row.status !== "pending") {
      throw new ApiError(400, "Only pending scheduled broadcasts can be cancelled");
    }
    const now = nowIso();
    db.update(t.crmWhatsappBroadcasts)
      .set({ status: "cancelled", finishedAt: now, updatedAt: now })
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .run();
    db.update(t.crmWhatsappBroadcastDeliveries)
      .set({ status: "skipped", errorMessage: "Broadcast cancelled", updatedAt: now })
      .where(
        and(
          eq(t.crmWhatsappBroadcastDeliveries.broadcastId, data.id),
          eq(t.crmWhatsappBroadcastDeliveries.status, "pending"),
        ),
      )
      .run();
    return { ok: true };
  });

export const runCrmWhatsappBroadcastNow = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Broadcast not found");
    assertCanAccessBroadcast(row, user);
    if (row.status === "cancelled" || row.status === "completed") {
      throw new ApiError(400, "Broadcast is already finished");
    }
    const config = loadCrmAutomationConfig(db);
    if (!config.waha.isEnabled || !config.waha.apiUrl?.trim() || !config.waha.apiKey?.trim()) {
      throw new ApiError(400, "WhatsApp (WAHA) is not enabled. Ask an admin to configure it.");
    }
    const now = nowIso();
    if (row.status === "pending") {
      db.update(t.crmWhatsappBroadcasts)
        .set({ scheduledAt: now, updatedAt: now })
        .where(eq(t.crmWhatsappBroadcasts.id, data.id))
        .run();
    }
    const sent = await processWhatsappBroadcasts(db, { broadcastId: data.id });
    const updated = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .get()!;
    return { sent, broadcast: mapBroadcast(updated, deliveryCounts(db, data.id)) };
  });
