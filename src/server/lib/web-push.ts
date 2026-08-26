import webpush from "web-push";
import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;

  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    "mailto:crm-noreply@buildesk.com";

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function getWebPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; statusCode?: number; gone: boolean; error: string }> {
  if (!ensureVapidConfigured()) {
    return { ok: false, gone: false, error: "Web push is not configured (missing VAPID keys)" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    const message = err instanceof Error ? err.message : "Push send failed";
    return { ok: false, statusCode, gone, error: message };
  }
}

export async function sendPushToUser(
  db: ReturnType<typeof getDb>,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const rows = db
    .select()
    .from(t.pushSubscriptions)
    .where(eq(t.pushSubscriptions.userId, userId))
    .all();

  let sent = 0;
  for (const row of rows) {
    const result = await sendPushToSubscription(
      { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
      payload,
    );
    if (result.ok) {
      sent += 1;
    } else {
      console.warn(
        `[web-push] send failed user=${userId} status=${result.statusCode ?? "?"} ${result.error}`,
      );
      if (result.gone) {
        db.delete(t.pushSubscriptions).where(eq(t.pushSubscriptions.id, row.id)).run();
      }
    }
  }
  return sent;
}
