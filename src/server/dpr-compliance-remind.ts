import { eq } from "drizzle-orm";

import { DEFAULT_AUTOMATION_ENDPOINTS, DEFAULT_AUTOMATION_SETTINGS, N8N_EMAIL_SEGMENT } from "@/data/automationDefaults";
import { resolveUserWorkEmail } from "@/lib/user-email";
import { insertNotificationsForUserIds } from "@/server/api/notifications";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { todayIsoDate } from "@/server/lib/dpr-map";
import { nowIso } from "@/types";

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function buildN8nEmailUrl(base: string) {
  return `${trimSlash(base)}/${N8N_EMAIL_SEGMENT.replace(/^\/+/, "")}`;
}

async function sendDprReminderEmail(userId: string, entryDate: string) {
  const db = getDb();
  const user = db.select().from(t.users).where(eq(t.users.id, userId)).get();
  if (!user) return false;
  const email = resolveUserWorkEmail(user) || user.email;
  if (!email?.trim()) return false;

  const row = db.select().from(t.appConfig).where(eq(t.appConfig.key, "automation")).get();
  let settings = DEFAULT_AUTOMATION_SETTINGS;
  let endpoints = DEFAULT_AUTOMATION_ENDPOINTS;
  if (row?.valueJson) {
    try {
      const snap = JSON.parse(row.valueJson) as {
        settings?: typeof settings;
        endpoints?: typeof endpoints;
      };
      if (snap.settings) settings = { ...settings, ...snap.settings };
      if (Array.isArray(snap.endpoints) && snap.endpoints.length > 0) {
        endpoints = snap.endpoints;
      }
    } catch {
      /* defaults */
    }
  }
  if (!settings.automationsEnabled) return false;
  const emailEp = endpoints.find((e) => e.channel === "email" && e.isEnabled);
  if (!emailEp?.webhookUrl) return false;

  const subject = `DPR reminder — ${entryDate}`;
  const body = `Hi ${user.name},\n\nYou have not logged your Daily Progress Report (DPR) for ${entryDate}.\n\nPlease open ERP → My DPR and log today's tasks.\n\nThank you.`;

  try {
    const res = await fetch(emailEp.webhookUrl || buildN8nEmailUrl(settings.n8nWebhookBase), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: email,
        subject,
        body,
        recipientName: user.name,
        recipientEmail: email,
        trigger: "dpr-compliance-remind",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function remindDprExecutives(executiveIds: string[], entryDate?: string) {
  const db = getDb();
  const date = entryDate?.slice(0, 10) || todayIsoDate();
  const unique = [...new Set(executiveIds.filter(Boolean))];
  if (unique.length === 0) return { notified: 0, emailed: 0 };

  insertNotificationsForUserIds(db, unique, {
    title: "DPR not submitted",
    body: `Please log your DPR for ${date} in My DPR.`,
    kind: "reminder",
    href: "/dpr",
  });

  let emailed = 0;
  for (const id of unique) {
    if (await sendDprReminderEmail(id, date)) emailed += 1;
  }

  return { notified: unique.length, emailed };
}
