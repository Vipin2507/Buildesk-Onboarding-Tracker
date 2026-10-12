import { and, desc, eq, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
import type {
  CrmWhatsappBroadcast,
  CrmWhatsappBroadcastDelivery,
  CrmWhatsappBroadcastDeliveryStatus,
  CrmWhatsappBroadcastStatus,
} from "@/types/crm-whatsapp-broadcast";

function assertAdmin() {
  const user = requireUser();
  if (!isAdminRoleKey(user.role)) throw new ApiError(403, "Admin access required");
  return user;
}

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
  return {
    id: row.id,
    scheduledAt: row.scheduledAt,
    status: row.status as CrmWhatsappBroadcastStatus,
    templateId: row.templateId,
    templateName: row.templateName,
    body: row.body,
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

export const listCrmWhatsappBroadcasts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().int().positive().max(100).optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    assertAdmin();
    const db = getDb();
    const limit = data?.limit ?? 40;
    try {
      const rows = db
        .select()
        .from(t.crmWhatsappBroadcasts)
        .orderBy(desc(t.crmWhatsappBroadcasts.createdAt))
        .limit(limit)
        .all();
      return rows.map((row) => mapBroadcast(row, deliveryCounts(db, row.id)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("no such table")) return [];
      throw err;
    }
  });

export const getCrmWhatsappBroadcast = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    assertAdmin();
    const db = getDb();
    const row = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Broadcast not found");
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
        /** ISO datetime; omit / past / "now" → send immediately. */
        scheduledAt: z.string().optional().nullable(),
        sendNow: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = assertAdmin();
    const db = getDb();

    let resolved;
    try {
      resolved = resolveBroadcastBody(db, {
        templateId: data.templateId,
        body: data.body,
      });
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Invalid message");
    }

    const uniqueIds = [...new Set(data.accountIds.map((id) => id.trim()).filter(Boolean))];
    const accounts = listAccountIdsWithGroups(db, uniqueIds);
    if (accounts.length === 0) {
      throw new ApiError(400, "No valid accounts selected");
    }

    const withGroups = accounts.filter((a) => normalizeGroupId(a.whatsappGroupId));
    if (withGroups.length === 0) {
      throw new ApiError(
        400,
        "None of the selected accounts have a WhatsApp group linked. Sync groups first.",
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
        throw new ApiError(400, "Enable WAHA in Automation → Webhooks before sending");
      }
    }

    const broadcastId = newId();
    db.insert(t.crmWhatsappBroadcasts)
      .values({
        id: broadcastId,
        scheduledAt,
        status: "pending",
        templateId: resolved.templateId,
        templateName: resolved.templateName,
        body: resolved.body,
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
    assertAdmin();
    const db = getDb();
    const row = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Broadcast not found");
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
    assertAdmin();
    const db = getDb();
    const row = db
      .select()
      .from(t.crmWhatsappBroadcasts)
      .where(eq(t.crmWhatsappBroadcasts.id, data.id))
      .get();
    if (!row) throw new ApiError(404, "Broadcast not found");
    if (row.status === "cancelled" || row.status === "completed") {
      throw new ApiError(400, "Broadcast is already finished");
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
