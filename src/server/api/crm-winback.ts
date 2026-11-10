import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { normalizeIndiaPhone } from "@/lib/automationEndpoints";
import {
  CRM_WINBACK_GAP_MS,
  CRM_WINBACK_WAVE_LIMIT,
  winbackScheduleConflict,
} from "@/lib/crm-winback-limits";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { loadCrmAutomationConfig } from "@/server/crm-booking-automation";
import { processWinbackCampaigns, renderWinbackTemplate } from "@/server/crm-winback";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  decodeWinbackMediaBase64,
  inferWinbackMediaKind,
  saveWinbackMedia,
} from "@/server/lib/crm-winback-media";
import type {
  CrmWinbackCampaign,
  CrmWinbackCampaignStatus,
  CrmWinbackContact,
  CrmWinbackDelivery,
  CrmWinbackDeliveryStatus,
  CrmWinbackMediaKind,
  CrmWinbackOutcome,
  CrmWinbackTemplate,
} from "@/types/crm-winback";

const outcomeSchema = z.enum([
  "none",
  "interested",
  "callback",
  "not_interested",
  "wrong_number",
  "do_not_contact",
]);

function formatWhen(iso: string) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function mapContact(row: typeof t.crmWinbackContacts.$inferSelect): CrmWinbackContact {
  return {
    id: row.id,
    companyName: row.companyName,
    contactPerson: row.contactPerson,
    mobile: row.mobile,
    mobileNormalized: row.mobileNormalized,
    email: row.email ?? undefined,
    city: row.city ?? undefined,
    outcome: (row.outcome as CrmWinbackOutcome) || "none",
    notes: row.notes ?? undefined,
    ownerName: row.ownerName ?? undefined,
    tags: parseTags(row.tagsJson),
    lastContactedAt: row.lastContactedAt ?? undefined,
    archived: Boolean(row.archived),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function campaignCounts(db: ReturnType<typeof getDb>, campaignId: string) {
  const rows = db
    .select({
      status: t.crmWinbackDeliveries.status,
      n: sql<number>`count(*)`,
    })
    .from(t.crmWinbackDeliveries)
    .where(eq(t.crmWinbackDeliveries.campaignId, campaignId))
    .groupBy(t.crmWinbackDeliveries.status)
    .all();
  let recipientCount = 0;
  let pendingCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  for (const row of rows) {
    const n = Number(row.n) || 0;
    recipientCount += n;
    if (row.status === "pending") pendingCount += n;
    else if (row.status === "sent") sentCount += n;
    else if (row.status === "failed") failedCount += n;
    else if (row.status === "skipped") skippedCount += n;
  }
  return { recipientCount, pendingCount, sentCount, failedCount, skippedCount };
}

function mapCampaign(
  row: typeof t.crmWinbackCampaigns.$inferSelect,
  counts: ReturnType<typeof campaignCounts>,
): CrmWinbackCampaign {
  const mediaKind =
    row.mediaKind === "image" ||
    row.mediaKind === "video" ||
    row.mediaKind === "voice" ||
    row.mediaKind === "file"
      ? (row.mediaKind as CrmWinbackMediaKind)
      : undefined;
  return {
    id: row.id,
    name: row.name,
    channel: "whatsapp",
    body: row.body,
    status: row.status as CrmWinbackCampaignStatus,
    scheduledAt: row.scheduledAt ?? undefined,
    waveSize: row.waveSize || CRM_WINBACK_WAVE_LIMIT,
    mediaKind,
    mediaFilename: row.mediaFilename ?? undefined,
    mediaMimetype: row.mediaMimetype ?? undefined,
    hasMedia: Boolean(row.mediaStorageKey && mediaKind),
    createdByUserId: row.createdByUserId ?? undefined,
    createdByName: row.createdByName ?? undefined,
    startedAt: row.startedAt ?? undefined,
    finishedAt: row.finishedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...counts,
  };
}

function mapTemplate(row: typeof t.crmWinbackTemplates.$inferSelect): CrmWinbackTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category || "General",
    body: row.body,
    active: Boolean(row.active),
    sortOrder: row.sortOrder || 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDelivery(row: typeof t.crmWinbackDeliveries.$inferSelect): CrmWinbackDelivery {
  return {
    id: row.id,
    campaignId: row.campaignId,
    contactId: row.contactId,
    companyName: row.companyName,
    contactPerson: row.contactPerson,
    mobile: row.mobile,
    renderedBody: row.renderedBody ?? undefined,
    status: row.status as CrmWinbackDeliveryStatus,
    errorMessage: row.errorMessage ?? undefined,
    waveNumber: row.waveNumber || 1,
    sentAt: row.sentAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertWinbackGap(db: ReturnType<typeof getDb>, scheduledAtIso: string, ignoreId?: string) {
  const busy = db
    .select()
    .from(t.crmWinbackCampaigns)
    .where(inArray(t.crmWinbackCampaigns.status, ["scheduled", "running"]))
    .all();
  const conflict = winbackScheduleConflict(Date.parse(scheduledAtIso), busy, ignoreId);
  if (!conflict) return;
  throw new ApiError(
    400,
    `Another Win-back campaign is already scheduled for ${formatWhen(conflict.scheduledAt ?? "")}. Leave at least 30 minutes between waves.`,
  );
}

function requireCrmAccess() {
  const user = requireUser();
  if (!isAdminRoleKey(user.role) && user.productScope !== "crm") {
    throw new ApiError(403, "CRM access required");
  }
  return user;
}

export const listCrmWinbackContacts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        search: z.string().optional(),
        outcome: outcomeSchema.optional(),
        includeArchived: z.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(2000).optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const limit = data?.limit ?? 500;
    let rows = db.select().from(t.crmWinbackContacts).orderBy(desc(t.crmWinbackContacts.updatedAt)).all();
    if (!data?.includeArchived) rows = rows.filter((row) => !row.archived);
    if (data?.outcome) rows = rows.filter((row) => row.outcome === data.outcome);
    if (data?.search?.trim()) {
      const q = data.search.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.companyName.toLowerCase().includes(q) ||
          row.contactPerson.toLowerCase().includes(q) ||
          row.mobile.toLowerCase().includes(q) ||
          (row.city ?? "").toLowerCase().includes(q),
      );
    }
    return { contacts: rows.slice(0, limit).map(mapContact), total: rows.length };
  });

export const importCrmWinbackContacts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              companyName: z.string().min(1),
              contactPerson: z.string().optional(),
              mobile: z.string().min(5),
              email: z.string().optional(),
              city: z.string().optional(),
            }),
          )
          .min(1)
          .max(5000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const now = nowIso();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of data.rows) {
      const companyName = row.companyName.trim();
      const contactPerson = (row.contactPerson ?? "").trim();
      const mobile = row.mobile.trim();
      const normalized = normalizeIndiaPhone(mobile);
      if (!companyName || !normalized) {
        skipped += 1;
        if (errors.length < 20) errors.push(`Skipped invalid row: ${companyName || "?"} / ${mobile}`);
        continue;
      }
      const existing = db
        .select()
        .from(t.crmWinbackContacts)
        .where(eq(t.crmWinbackContacts.mobileNormalized, normalized))
        .get();
      if (existing) {
        db.update(t.crmWinbackContacts)
          .set({
            companyName,
            contactPerson: contactPerson || existing.contactPerson,
            mobile,
            email: row.email?.trim() || existing.email,
            city: row.city?.trim() || existing.city,
            archived: false,
            updatedAt: now,
          })
          .where(eq(t.crmWinbackContacts.id, existing.id))
          .run();
        updated += 1;
      } else {
        db.insert(t.crmWinbackContacts)
          .values({
            id: newId(),
            companyName,
            contactPerson,
            mobile,
            mobileNormalized: normalized,
            email: row.email?.trim() || null,
            city: row.city?.trim() || null,
            outcome: "none",
            notes: null,
            ownerName: null,
            tagsJson: null,
            lastContactedAt: null,
            archived: false,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        created += 1;
      }
    }

    return { created, updated, skipped, errors };
  });

export const updateCrmWinbackContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        outcome: outcomeSchema.optional(),
        notes: z.string().optional().nullable(),
        ownerName: z.string().optional().nullable(),
        archived: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const existing = db.select().from(t.crmWinbackContacts).where(eq(t.crmWinbackContacts.id, data.id)).get();
    if (!existing) throw new ApiError(404, "Contact not found");
    const now = nowIso();
    db.update(t.crmWinbackContacts)
      .set({
        outcome: data.outcome ?? existing.outcome,
        notes: data.notes === undefined ? existing.notes : data.notes?.trim() || null,
        ownerName: data.ownerName === undefined ? existing.ownerName : data.ownerName?.trim() || null,
        archived: data.archived ?? existing.archived,
        updatedAt: now,
      })
      .where(eq(t.crmWinbackContacts.id, data.id))
      .run();
    const row = db.select().from(t.crmWinbackContacts).where(eq(t.crmWinbackContacts.id, data.id)).get()!;
    return mapContact(row);
  });

export const bulkUpdateCrmWinbackContacts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        ids: z.array(z.string().min(1)).min(1).max(500),
        outcome: outcomeSchema.optional(),
        archived: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    if (data.outcome === undefined && data.archived === undefined) {
      throw new ApiError(400, "Nothing to update");
    }
    const db = getDb();
    const now = nowIso();
    const patch: Partial<typeof t.crmWinbackContacts.$inferInsert> = { updatedAt: now };
    if (data.outcome) patch.outcome = data.outcome;
    if (data.archived !== undefined) patch.archived = data.archived;
    db.update(t.crmWinbackContacts).set(patch).where(inArray(t.crmWinbackContacts.id, data.ids)).run();
    return { ok: true as const, count: data.ids.length };
  });

export const listCrmWinbackCampaigns = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const rows = db
      .select()
      .from(t.crmWinbackCampaigns)
      .orderBy(desc(t.crmWinbackCampaigns.createdAt))
      .limit(data?.limit ?? 50)
      .all();
    return {
      campaigns: rows.map((row) => mapCampaign(row, campaignCounts(db, row.id))),
    };
  });

export const getCrmWinbackCampaign = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const row = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, data.id)).get();
    if (!row) throw new ApiError(404, "Campaign not found");
    const deliveries = db
      .select()
      .from(t.crmWinbackDeliveries)
      .where(eq(t.crmWinbackDeliveries.campaignId, data.id))
      .orderBy(desc(t.crmWinbackDeliveries.updatedAt))
      .all();
    return {
      campaign: mapCampaign(row, campaignCounts(db, row.id)),
      deliveries: deliveries.map(mapDelivery),
    };
  });

export const createCrmWinbackCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        body: z.string().max(4000).optional().default(""),
        contactIds: z.array(z.string().min(1)).min(1).max(5000),
        scheduledAt: z.string().optional(),
        sendNow: z.boolean().optional(),
        waveSize: z.coerce.number().int().min(1).max(CRM_WINBACK_WAVE_LIMIT).optional(),
        media: z
          .object({
            filename: z.string().min(1).max(180),
            mimetype: z.string().min(1).max(120),
            dataBase64: z.string().min(1),
          })
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireCrmAccess();
    const db = getDb();
    const config = loadCrmAutomationConfig(db);
    if (!config.waha.isEnabled || !config.waha.apiUrl?.trim() || !config.waha.apiKey?.trim()) {
      throw new ApiError(400, "Enable CRM WhatsApp (WAHA) before scheduling Win-back campaigns");
    }

    const body = (data.body ?? "").trim();
    const hasMedia = Boolean(data.media?.dataBase64);
    if (!body && !hasMedia) {
      throw new ApiError(400, "Message body or media is required");
    }

    const uniqueIds = [...new Set(data.contactIds)];
    const contacts = db
      .select()
      .from(t.crmWinbackContacts)
      .where(inArray(t.crmWinbackContacts.id, uniqueIds))
      .all()
      .filter((c) => !c.archived && c.outcome !== "do_not_contact");

    if (contacts.length === 0) {
      throw new ApiError(400, "No eligible contacts (archived and do-not-contact are excluded)");
    }

    const sendNow = Boolean(data.sendNow);
    const scheduledAt = sendNow
      ? nowIso()
      : data.scheduledAt?.trim() || new Date(Date.now() + 60_000).toISOString();
    if (!sendNow && Date.parse(scheduledAt) < Date.now() - 30_000) {
      throw new ApiError(400, "Schedule time must be in the future");
    }
    assertWinbackGap(db, scheduledAt);

    const now = nowIso();
    const id = newId();
    const waveSize = data.waveSize ?? CRM_WINBACK_WAVE_LIMIT;

    let mediaKind: string | null = null;
    let mediaFilename: string | null = null;
    let mediaMimetype: string | null = null;
    let mediaStorageKey: string | null = null;
    if (data.media?.dataBase64) {
      const buffer = decodeWinbackMediaBase64(data.media.dataBase64);
      mediaFilename = data.media.filename.trim() || "file";
      mediaMimetype = data.media.mimetype.trim() || "application/octet-stream";
      mediaKind = inferWinbackMediaKind(mediaMimetype);
      mediaStorageKey = saveWinbackMedia({
        campaignId: id,
        fileName: mediaFilename,
        mimeType: mediaMimetype,
        buffer,
      }).storageKey;
    }

    db.insert(t.crmWinbackCampaigns)
      .values({
        id,
        name: data.name.trim(),
        channel: "whatsapp",
        body,
        status: "scheduled",
        scheduledAt,
        waveSize,
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

    for (const contact of contacts) {
      db.insert(t.crmWinbackDeliveries)
        .values({
          id: newId(),
          campaignId: id,
          contactId: contact.id,
          companyName: contact.companyName,
          contactPerson: contact.contactPerson,
          mobile: contact.mobile,
          renderedBody: renderWinbackTemplate(body, {
            companyName: contact.companyName,
            contactPerson: contact.contactPerson,
            mobile: contact.mobile,
          }),
          status: "pending",
          errorMessage: null,
          waveNumber: 1,
          sentAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    if (sendNow) {
      await processWinbackCampaigns(db);
    }

    const row = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, id)).get()!;
    return mapCampaign(row, campaignCounts(db, id));
  });

export const listCrmWinbackTemplates = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ includeInactive: z.boolean().optional() })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    let rows = db
      .select()
      .from(t.crmWinbackTemplates)
      .orderBy(asc(t.crmWinbackTemplates.sortOrder), asc(t.crmWinbackTemplates.name))
      .all();
    if (!data?.includeInactive) rows = rows.filter((row) => row.active);
    return { templates: rows.map(mapTemplate) };
  });

export const upsertCrmWinbackTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1).optional(),
        name: z.string().min(1).max(120),
        category: z.string().max(80).optional(),
        body: z.string().min(1).max(4000),
        active: z.boolean().optional(),
        sortOrder: z.coerce.number().int().min(1).max(999).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const now = nowIso();
    const name = data.name.trim();
    const body = data.body.trim();
    const category = (data.category ?? "General").trim() || "General";
    const active = data.active ?? true;
    const sortOrder = data.sortOrder ?? 1;

    if (data.id) {
      const existing = db
        .select()
        .from(t.crmWinbackTemplates)
        .where(eq(t.crmWinbackTemplates.id, data.id))
        .get();
      if (!existing) throw new ApiError(404, "Template not found");
      db.update(t.crmWinbackTemplates)
        .set({ name, category, body, active, sortOrder, updatedAt: now })
        .where(eq(t.crmWinbackTemplates.id, data.id))
        .run();
      const row = db.select().from(t.crmWinbackTemplates).where(eq(t.crmWinbackTemplates.id, data.id)).get()!;
      return mapTemplate(row);
    }

    const id = newId();
    db.insert(t.crmWinbackTemplates)
      .values({
        id,
        name,
        category,
        body,
        active,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const row = db.select().from(t.crmWinbackTemplates).where(eq(t.crmWinbackTemplates.id, id)).get()!;
    return mapTemplate(row);
  });

export const deleteCrmWinbackTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const existing = db
      .select()
      .from(t.crmWinbackTemplates)
      .where(eq(t.crmWinbackTemplates.id, data.id))
      .get();
    if (!existing) throw new ApiError(404, "Template not found");
    db.delete(t.crmWinbackTemplates).where(eq(t.crmWinbackTemplates.id, data.id)).run();
    return { ok: true as const };
  });

export const pauseCrmWinbackCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const row = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, data.id)).get();
    if (!row) throw new ApiError(404, "Campaign not found");
    if (row.status !== "scheduled" && row.status !== "running") {
      throw new ApiError(400, "Only scheduled or running campaigns can be paused");
    }
    const now = nowIso();
    db.update(t.crmWinbackCampaigns)
      .set({ status: "paused", updatedAt: now })
      .where(eq(t.crmWinbackCampaigns.id, data.id))
      .run();
    const next = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, data.id)).get()!;
    return mapCampaign(next, campaignCounts(db, data.id));
  });

export const resumeCrmWinbackCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1), scheduledAt: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const row = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, data.id)).get();
    if (!row) throw new ApiError(404, "Campaign not found");
    if (row.status !== "paused") throw new ApiError(400, "Only paused campaigns can be resumed");
    const scheduledAt = data.scheduledAt?.trim() || new Date(Date.now() + CRM_WINBACK_GAP_MS).toISOString();
    assertWinbackGap(db, scheduledAt, data.id);
    const now = nowIso();
    db.update(t.crmWinbackCampaigns)
      .set({ status: "scheduled", scheduledAt, updatedAt: now })
      .where(eq(t.crmWinbackCampaigns.id, data.id))
      .run();
    const next = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, data.id)).get()!;
    return mapCampaign(next, campaignCounts(db, data.id));
  });

export const cancelCrmWinbackCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const row = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, data.id)).get();
    if (!row) throw new ApiError(404, "Campaign not found");
    if (row.status === "done" || row.status === "cancelled") {
      throw new ApiError(400, "Campaign is already finished");
    }
    const now = nowIso();
    db.update(t.crmWinbackCampaigns)
      .set({ status: "cancelled", finishedAt: now, updatedAt: now })
      .where(eq(t.crmWinbackCampaigns.id, data.id))
      .run();
    db.update(t.crmWinbackDeliveries)
      .set({ status: "skipped", errorMessage: "Campaign cancelled", updatedAt: now })
      .where(
        and(
          eq(t.crmWinbackDeliveries.campaignId, data.id),
          eq(t.crmWinbackDeliveries.status, "pending"),
        ),
      )
      .run();
    const next = db.select().from(t.crmWinbackCampaigns).where(eq(t.crmWinbackCampaigns.id, data.id)).get()!;
    return mapCampaign(next, campaignCounts(db, data.id));
  });

export const listCrmWinbackActivity = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireCrmAccess();
    const db = getDb();
    const rows = db
      .select()
      .from(t.crmWinbackDeliveries)
      .where(inArray(t.crmWinbackDeliveries.status, ["sent", "failed", "skipped"]))
      .orderBy(desc(t.crmWinbackDeliveries.updatedAt))
      .limit(data?.limit ?? 100)
      .all();
    return { deliveries: rows.map(mapDelivery) };
  });
