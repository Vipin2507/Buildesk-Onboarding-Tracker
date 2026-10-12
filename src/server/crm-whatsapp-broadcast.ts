import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { applyCrmWhatsappTemplate, normalizeCrmWhatsappTemplates } from "@/lib/crm-whatsapp-templates";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import { PAYMENT_AUTOMATION_SEND_PAUSE_MS } from "@/server/crm-payment-reminder-automation";
import type { Db } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { nowIso } from "@/server/auth/session";
import type { AutomationLog } from "@/types/automation";
import type { WahaConfig } from "@/types/automation";
import type { CrmWhatsappTemplateDef } from "@/types/crm-master";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function pauseBetweenSends() {
  return new Promise<void>((resolve) => setTimeout(resolve, PAYMENT_AUTOMATION_SEND_PAUSE_MS));
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serverLogId() {
  return `CAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeGroupId(raw: string | null | undefined) {
  const id = (raw ?? "").trim();
  if (!id) return "";
  if (id.includes("@g.us")) return id;
  if (/^\d+$/.test(id)) return `${id}@g.us`;
  return id;
}

async function sendServerWahaText(waha: WahaConfig, chatId: string, text: string) {
  const res = await fetch(`${trimSlash(waha.apiUrl)}/api/sendText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": waha.apiKey,
    },
    body: JSON.stringify({
      session: waha.sessionName,
      chatId,
      text,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, text: body };
}

function loadWhatsappTemplates(db: Db): CrmWhatsappTemplateDef[] {
  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "crm-master")).get();
  if (!row?.valueJson) return normalizeCrmWhatsappTemplates(null);
  try {
    const parsed = JSON.parse(row.valueJson) as { whatsappTemplates?: CrmWhatsappTemplateDef[] };
    return normalizeCrmWhatsappTemplates(parsed.whatsappTemplates);
  } catch {
    return normalizeCrmWhatsappTemplates(null);
  }
}

function claimDueBroadcasts(db: Db, broadcastId?: string) {
  const now = nowIso();
  const due = broadcastId
    ? db
        .select()
        .from(t.crmWhatsappBroadcasts)
        .where(eq(t.crmWhatsappBroadcasts.id, broadcastId))
        .all()
        .filter((row) => row.status === "pending" || row.status === "running")
    : db
        .select()
        .from(t.crmWhatsappBroadcasts)
        .where(
          and(
            eq(t.crmWhatsappBroadcasts.status, "pending"),
            lte(t.crmWhatsappBroadcasts.scheduledAt, now),
          ),
        )
        .limit(5)
        .all();

  const claimed: (typeof t.crmWhatsappBroadcasts.$inferSelect)[] = [];
  for (const row of due) {
    if (row.status === "running") {
      claimed.push(row);
      continue;
    }
    if (row.status !== "pending") continue;
    if (!broadcastId && row.scheduledAt > now) continue;
    const updated = db
      .update(t.crmWhatsappBroadcasts)
      .set({
        status: "running",
        startedAt: row.startedAt || now,
        updatedAt: now,
      })
      .where(
        and(
          eq(t.crmWhatsappBroadcasts.id, row.id),
          eq(t.crmWhatsappBroadcasts.status, "pending"),
        ),
      )
      .run();
    if (!updated.changes) continue;
    claimed.push({ ...row, status: "running", startedAt: row.startedAt || now });
  }
  return claimed;
}

/**
 * Process due WhatsApp group broadcasts (scheduler tick or immediate send-now).
 * Returns number of deliveries marked sent.
 */
export async function processWhatsappBroadcasts(
  db: Db,
  opts?: { broadcastId?: string },
): Promise<number> {
  const config = loadCrmAutomationConfig(db);
  // Explicit admin broadcasts only need WAHA — not the automation rules kill-switch.
  const wahaReady =
    Boolean(config.waha.isEnabled) &&
    Boolean(config.waha.apiUrl?.trim()) &&
    Boolean(config.waha.apiKey?.trim());

  const claimed = claimDueBroadcasts(db, opts?.broadcastId);
  if (claimed.length === 0) return 0;

  if (!wahaReady) {
    // Revert claim so a later tick (or Send now) can retry once WAHA is configured.
    const now = nowIso();
    for (const broadcast of claimed) {
      if (broadcast.status === "running") {
        db.update(t.crmWhatsappBroadcasts)
          .set({ status: "pending", startedAt: null, updatedAt: now })
          .where(eq(t.crmWhatsappBroadcasts.id, broadcast.id))
          .run();
      }
    }
    return 0;
  }

  let sentTotal = 0;

  for (const broadcast of claimed) {
    const deliveries = db
      .select()
      .from(t.crmWhatsappBroadcastDeliveries)
      .where(
        and(
          eq(t.crmWhatsappBroadcastDeliveries.broadcastId, broadcast.id),
          eq(t.crmWhatsappBroadcastDeliveries.status, "pending"),
        ),
      )
      .all();

    if (deliveries.length === 0) {
      const finishNow = nowIso();
      db.update(t.crmWhatsappBroadcasts)
        .set({ status: "completed", finishedAt: finishNow, updatedAt: finishNow })
        .where(eq(t.crmWhatsappBroadcasts.id, broadcast.id))
        .run();
      continue;
    }

    let sendIndex = 0;
    for (const delivery of deliveries) {
      if (sendIndex > 0) await pauseBetweenSends();
      sendIndex += 1;

      const account = db
        .select()
        .from(t.crmAccounts)
        .where(eq(t.crmAccounts.id, delivery.accountId))
        .get();

      const groupId = normalizeGroupId(account?.whatsappGroupId || delivery.groupId);
      const now = nowIso();

      if (!account || !groupId) {
        db.update(t.crmWhatsappBroadcastDeliveries)
          .set({
            status: "skipped",
            groupId: groupId || null,
            errorMessage: !account ? "Account not found" : "No WhatsApp group linked",
            updatedAt: now,
          })
          .where(eq(t.crmWhatsappBroadcastDeliveries.id, delivery.id))
          .run();
        continue;
      }

      const rendered = applyCrmWhatsappTemplate(broadcast.body, {
        name: account.name,
        contact: account.contact,
        phone: account.phone,
        email: account.email,
        city: account.city,
        status: account.status,
        ownerName: account.ownerName,
        ownerPhone: account.ownerPhone,
        ownerEmail: account.ownerEmail,
        pocName: account.pocName,
        accountManagerName: account.accountManagerName,
        salesManagerName: account.salesManagerName,
      });

      const attemptedAt = nowIso();
      const baseLog: AutomationLog = {
        id: serverLogId(),
        companyId: account.id,
        channel: "whatsapp",
        trigger: "whatsapp-broadcast",
        status: "retrying",
        requestPayload: {
          chatId: groupId,
          broadcastId: broadcast.id,
          accountId: account.id,
          templateId: broadcast.templateId,
        },
        attemptedAt,
        retryCount: 0,
      };

      try {
        const res = await sendServerWahaText(config.waha, groupId, rendered);
        if (!res.ok) {
          const err = `HTTP ${res.status}: ${summarizeResponse(res.text, 240)}`;
          db.update(t.crmWhatsappBroadcastDeliveries)
            .set({
              status: "failed",
              groupId,
              renderedBody: rendered,
              errorMessage: err,
              updatedAt: attemptedAt,
            })
            .where(eq(t.crmWhatsappBroadcastDeliveries.id, delivery.id))
            .run();
          appendServerCrmAutomationLog(db, {
            ...baseLog,
            status: "failed",
            errorMessage: err,
            responseSummary: summarizeResponse(res.text),
          });
          continue;
        }

        db.update(t.crmWhatsappBroadcastDeliveries)
          .set({
            status: "sent",
            groupId,
            renderedBody: rendered,
            errorMessage: null,
            sentAt: attemptedAt,
            updatedAt: attemptedAt,
          })
          .where(eq(t.crmWhatsappBroadcastDeliveries.id, delivery.id))
          .run();
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "success",
          responseSummary: summarizeResponse(res.text),
        });
        sentTotal += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        db.update(t.crmWhatsappBroadcastDeliveries)
          .set({
            status: "failed",
            groupId,
            renderedBody: rendered,
            errorMessage: message,
            updatedAt: attemptedAt,
          })
          .where(eq(t.crmWhatsappBroadcastDeliveries.id, delivery.id))
          .run();
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "failed",
          errorMessage: message,
        });
      }
    }

    const remaining = db
      .select({ c: sql<number>`count(*)` })
      .from(t.crmWhatsappBroadcastDeliveries)
      .where(
        and(
          eq(t.crmWhatsappBroadcastDeliveries.broadcastId, broadcast.id),
          eq(t.crmWhatsappBroadcastDeliveries.status, "pending"),
        ),
      )
      .get();

    const finishNow = nowIso();
    if ((remaining?.c ?? 0) === 0) {
      const failed = db
        .select({ c: sql<number>`count(*)` })
        .from(t.crmWhatsappBroadcastDeliveries)
        .where(
          and(
            eq(t.crmWhatsappBroadcastDeliveries.broadcastId, broadcast.id),
            eq(t.crmWhatsappBroadcastDeliveries.status, "failed"),
          ),
        )
        .get();
      const sent = db
        .select({ c: sql<number>`count(*)` })
        .from(t.crmWhatsappBroadcastDeliveries)
        .where(
          and(
            eq(t.crmWhatsappBroadcastDeliveries.broadcastId, broadcast.id),
            eq(t.crmWhatsappBroadcastDeliveries.status, "sent"),
          ),
        )
        .get();

      const allFailed = (sent?.c ?? 0) === 0 && (failed?.c ?? 0) > 0;
      db.update(t.crmWhatsappBroadcasts)
        .set({
          status: allFailed ? "failed" : "completed",
          finishedAt: finishNow,
          updatedAt: finishNow,
        })
        .where(eq(t.crmWhatsappBroadcasts.id, broadcast.id))
        .run();
    }
  }

  return sentTotal;
}

/** Resolve template body from Master (or use custom body). */
export function resolveBroadcastBody(
  db: Db,
  opts: { templateId?: string | null; body?: string | null },
): { body: string; templateId: string | null; templateName: string | null } {
  const custom = (opts.body ?? "").trim();
  const templateId = (opts.templateId ?? "").trim() || null;
  if (templateId) {
    const templates = loadWhatsappTemplates(db);
    const match = templates.find((t) => t.id === templateId && t.active);
    if (!match) {
      throw new Error("Template not found or inactive");
    }
    return {
      body: custom || match.body,
      templateId: match.id,
      templateName: match.name,
    };
  }
  if (!custom) throw new Error("Message body is required");
  return { body: custom, templateId: null, templateName: null };
}

export function listAccountIdsWithGroups(db: Db, accountIds: string[]) {
  if (accountIds.length === 0) return [];
  return db
    .select()
    .from(t.crmAccounts)
    .where(inArray(t.crmAccounts.id, accountIds))
    .all();
}
