import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { phoneToWahaChatId } from "@/lib/automationEndpoints";
import {
  CRM_WINBACK_GAP_MS,
  CRM_WINBACK_SEND_PAUSE_MS,
  CRM_WINBACK_WAVE_LIMIT,
} from "@/lib/crm-winback-limits";
import {
  appendServerCrmAutomationLog,
  loadCrmAutomationConfig,
} from "@/server/crm-booking-automation";
import type { Db } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { nowIso } from "@/server/auth/session";
import { readWinbackMedia } from "@/server/lib/crm-winback-media";
import type { AutomationLog, WahaConfig } from "@/types/automation";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function pauseBetweenSends() {
  return new Promise<void>((resolve) => setTimeout(resolve, CRM_WINBACK_SEND_PAUSE_MS));
}

function summarizeResponse(text: string, max = 200) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serverLogId() {
  return `WB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function wahaMediaPath(kind: "image" | "video" | "voice" | "file") {
  if (kind === "image") return "/api/sendImage";
  if (kind === "video") return "/api/sendVideo";
  if (kind === "voice") return "/api/sendVoice";
  return "/api/sendFile";
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

async function sendServerWahaMedia(
  waha: WahaConfig,
  kind: "image" | "video" | "voice" | "file",
  chatId: string,
  file: { mimetype: string; filename: string; data: string },
  caption?: string,
) {
  const payload: Record<string, unknown> = {
    session: waha.sessionName,
    chatId,
    file,
  };
  if (caption?.trim()) payload.caption = caption;
  const res = await fetch(`${trimSlash(waha.apiUrl)}${wahaMediaPath(kind)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": waha.apiKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, text: body };
}

export function renderWinbackTemplate(
  body: string,
  contact: { companyName: string; contactPerson: string; mobile: string },
) {
  return body
    .replaceAll("{{companyName}}", contact.companyName || "")
    .replaceAll("{{contactPerson}}", contact.contactPerson || "")
    .replaceAll("{{mobile}}", contact.mobile || "")
    .replaceAll("{{clientName}}", contact.contactPerson || contact.companyName || "");
}

/**
 * Process due Win-back campaigns: send one wave (up to waveSize / 30), then either
 * finish or schedule the next wave 30 minutes later.
 */
export async function processWinbackCampaigns(db: Db): Promise<number> {
  const now = nowIso();
  const due = db
    .select()
    .from(t.crmWinbackCampaigns)
    .where(
      and(
        inArray(t.crmWinbackCampaigns.status, ["scheduled", "running"]),
        lte(t.crmWinbackCampaigns.scheduledAt, now),
      ),
    )
    .orderBy(asc(t.crmWinbackCampaigns.scheduledAt))
    .all();

  if (due.length === 0) return 0;

  const config = loadCrmAutomationConfig(db);
  const wahaReady =
    Boolean(config.waha.isEnabled) &&
    Boolean(config.waha.apiUrl?.trim()) &&
    Boolean(config.waha.apiKey?.trim());

  let sentTotal = 0;

  for (const campaign of due) {
    if (campaign.status === "paused" || campaign.status === "cancelled") continue;

    const waveSize = Math.min(
      CRM_WINBACK_WAVE_LIMIT,
      Math.max(1, campaign.waveSize || CRM_WINBACK_WAVE_LIMIT),
    );

    db.update(t.crmWinbackCampaigns)
      .set({
        status: "running",
        startedAt: campaign.startedAt || now,
        updatedAt: now,
      })
      .where(eq(t.crmWinbackCampaigns.id, campaign.id))
      .run();

    const pending = db
      .select()
      .from(t.crmWinbackDeliveries)
      .where(
        and(
          eq(t.crmWinbackDeliveries.campaignId, campaign.id),
          eq(t.crmWinbackDeliveries.status, "pending"),
        ),
      )
      .orderBy(asc(t.crmWinbackDeliveries.createdAt))
      .limit(waveSize)
      .all();

    if (pending.length === 0) {
      db.update(t.crmWinbackCampaigns)
        .set({ status: "done", finishedAt: now, updatedAt: now, scheduledAt: null })
        .where(eq(t.crmWinbackCampaigns.id, campaign.id))
        .run();
      continue;
    }

    const maxWave = db
      .select({ value: sql<number>`coalesce(max(${t.crmWinbackDeliveries.waveNumber}), 0)` })
      .from(t.crmWinbackDeliveries)
      .where(
        and(
          eq(t.crmWinbackDeliveries.campaignId, campaign.id),
          inArray(t.crmWinbackDeliveries.status, ["sent", "failed", "skipped"]),
        ),
      )
      .get();
    const waveNumber = (maxWave?.value ?? 0) + 1;

    for (let i = 0; i < pending.length; i++) {
      const delivery = pending[i]!;
      if (i > 0) await pauseBetweenSends();

      const contact = db
        .select()
        .from(t.crmWinbackContacts)
        .where(eq(t.crmWinbackContacts.id, delivery.contactId))
        .get();

      const tick = nowIso();

      if (!contact || contact.archived || contact.outcome === "do_not_contact") {
        db.update(t.crmWinbackDeliveries)
          .set({
            status: "skipped",
            errorMessage: !contact
              ? "Contact missing"
              : contact.archived
                ? "Contact archived"
                : "Do not contact",
            waveNumber,
            updatedAt: tick,
          })
          .where(eq(t.crmWinbackDeliveries.id, delivery.id))
          .run();
        continue;
      }

      const rendered = renderWinbackTemplate(campaign.body, {
        companyName: contact.companyName,
        contactPerson: contact.contactPerson,
        mobile: contact.mobile,
      });

      if (!wahaReady) {
        db.update(t.crmWinbackDeliveries)
          .set({
            status: "failed",
            renderedBody: rendered,
            errorMessage: "WhatsApp (WAHA) is not enabled",
            waveNumber,
            updatedAt: tick,
          })
          .where(eq(t.crmWinbackDeliveries.id, delivery.id))
          .run();
        continue;
      }

      const chatId = phoneToWahaChatId(contact.mobileNormalized || contact.mobile);
      if (!chatId) {
        db.update(t.crmWinbackDeliveries)
          .set({
            status: "failed",
            renderedBody: rendered,
            errorMessage: "Invalid mobile for WhatsApp",
            waveNumber,
            updatedAt: tick,
          })
          .where(eq(t.crmWinbackDeliveries.id, delivery.id))
          .run();
        continue;
      }

      const baseLog: AutomationLog = {
        id: serverLogId(),
        companyId: contact.id,
        channel: "whatsapp",
        trigger: "whatsapp-broadcast",
        status: "retrying",
        requestPayload: {
          campaignId: campaign.id,
          contactId: contact.id,
          chatId,
        },
        attemptedAt: tick,
        retryCount: 0,
      };

      try {
        const mediaKind = (campaign.mediaKind ?? "").trim() as
          | "image"
          | "video"
          | "voice"
          | "file"
          | "";
        const hasMedia =
          Boolean(campaign.mediaStorageKey) &&
          (mediaKind === "image" ||
            mediaKind === "video" ||
            mediaKind === "voice" ||
            mediaKind === "file");

        let res: { ok: boolean; status: number; text: string };
        if (hasMedia) {
          const { buffer } = readWinbackMedia(campaign.mediaStorageKey!);
          res = await sendServerWahaMedia(
            config.waha,
            mediaKind,
            chatId,
            {
              mimetype: campaign.mediaMimetype || "application/octet-stream",
              filename: campaign.mediaFilename || "file",
              data: buffer.toString("base64"),
            },
            rendered || undefined,
          );
        } else if (rendered.trim()) {
          res = await sendServerWahaText(config.waha, chatId, rendered);
        } else {
          throw new Error("Empty message and no media");
        }

        if (!res.ok) {
          db.update(t.crmWinbackDeliveries)
            .set({
              status: "failed",
              renderedBody: rendered,
              errorMessage: `HTTP ${res.status}: ${summarizeResponse(res.text, 180)}`,
              waveNumber,
              updatedAt: tick,
            })
            .where(eq(t.crmWinbackDeliveries.id, delivery.id))
            .run();
          appendServerCrmAutomationLog(db, {
            ...baseLog,
            status: "failed",
            errorMessage: `HTTP ${res.status}`,
            responseSummary: summarizeResponse(res.text),
            requestPayload: { chatId, message: rendered },
          });
          continue;
        }

        db.update(t.crmWinbackDeliveries)
          .set({
            status: "sent",
            renderedBody: rendered,
            errorMessage: null,
            waveNumber,
            sentAt: tick,
            updatedAt: tick,
          })
          .where(eq(t.crmWinbackDeliveries.id, delivery.id))
          .run();
        db.update(t.crmWinbackContacts)
          .set({ lastContactedAt: tick, updatedAt: tick })
          .where(eq(t.crmWinbackContacts.id, contact.id))
          .run();
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "success",
          responseSummary: summarizeResponse(res.text),
          requestPayload: { chatId, message: rendered },
        });
        sentTotal += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        db.update(t.crmWinbackDeliveries)
          .set({
            status: "failed",
            renderedBody: rendered,
            errorMessage: message,
            waveNumber,
            updatedAt: tick,
          })
          .where(eq(t.crmWinbackDeliveries.id, delivery.id))
          .run();
        appendServerCrmAutomationLog(db, {
          ...baseLog,
          status: "failed",
          errorMessage: message,
        });
      }
    }

    const remaining = db
      .select({ id: t.crmWinbackDeliveries.id })
      .from(t.crmWinbackDeliveries)
      .where(
        and(
          eq(t.crmWinbackDeliveries.campaignId, campaign.id),
          eq(t.crmWinbackDeliveries.status, "pending"),
        ),
      )
      .limit(1)
      .get();

    const doneAt = nowIso();
    if (remaining) {
      const nextAt = new Date(Date.parse(doneAt) + CRM_WINBACK_GAP_MS).toISOString();
      db.update(t.crmWinbackCampaigns)
        .set({
          status: "scheduled",
          scheduledAt: nextAt,
          updatedAt: doneAt,
        })
        .where(eq(t.crmWinbackCampaigns.id, campaign.id))
        .run();
    } else {
      db.update(t.crmWinbackCampaigns)
        .set({
          status: "done",
          finishedAt: doneAt,
          scheduledAt: null,
          updatedAt: doneAt,
        })
        .where(eq(t.crmWinbackCampaigns.id, campaign.id))
        .run();
    }
  }

  return sentTotal;
}
