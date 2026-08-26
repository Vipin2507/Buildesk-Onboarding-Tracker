import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getTaskWebPushDiagnostics, processTaskWebPushReminders } from "@/server/crm-task-web-push";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  getWebPushPublicKey,
  isWebPushConfigured,
  sendPushToUser,
} from "@/server/lib/web-push";

export const getWebPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  const publicKey = getWebPushPublicKey();
  return {
    configured: isWebPushConfigured(),
    publicKey,
  };
});

export const getWebPushSubscriptionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireUser();
  const count = getDb()
    .select({ id: t.pushSubscriptions.id })
    .from(t.pushSubscriptions)
    .where(eq(t.pushSubscriptions.userId, user.id))
    .all().length;
  return { subscribed: count > 0, deviceCount: count };
});

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const subscribeWebPush = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        subscription: subscriptionSchema,
        userAgent: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    if (!isWebPushConfigured()) {
      throw new ApiError(503, "Web push is not configured on this server");
    }

    const db = getDb();
    const now = nowIso();
    const existing = db
      .select()
      .from(t.pushSubscriptions)
      .where(eq(t.pushSubscriptions.endpoint, data.subscription.endpoint))
      .get();

    if (existing) {
      db.update(t.pushSubscriptions)
        .set({
          userId: user.id,
          p256dh: data.subscription.keys.p256dh,
          auth: data.subscription.keys.auth,
          userAgent: data.userAgent ?? existing.userAgent,
          updatedAt: now,
        })
        .where(eq(t.pushSubscriptions.id, existing.id))
        .run();
      return { ok: true, id: existing.id };
    }

    const id = newId();
    db.insert(t.pushSubscriptions)
      .values({
        id,
        userId: user.id,
        endpoint: data.subscription.endpoint,
        p256dh: data.subscription.keys.p256dh,
        auth: data.subscription.keys.auth,
        userAgent: data.userAgent,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return { ok: true, id };
  });

export const unsubscribeWebPush = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        endpoint: z.string().url().optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();

    if (data?.endpoint) {
      db.delete(t.pushSubscriptions)
        .where(eq(t.pushSubscriptions.endpoint, data.endpoint))
        .run();
    } else {
      db.delete(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, user.id)).run();
    }

    return { ok: true };
  });

export const getWebPushDiagnostics = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireUser();
  const db = getDb();
  return getTaskWebPushDiagnostics(db, user.id);
});

export const sendTestWebPush = createServerFn({ method: "POST" }).handler(async () => {
  const user = requireUser();
  if (!isWebPushConfigured()) {
    throw new ApiError(503, "Web push is not configured on this server");
  }

  const db = getDb();
  const sent = await sendPushToUser(db, user.id, {
    title: "Buildesk CRM test",
    body: "If you see this, web push is working on this device.",
    url: "/crm/tasks",
  });

  if (sent === 0) {
    throw new ApiError(
      400,
      "No push was delivered. Enable browser notifications under My Profile first.",
    );
  }

  return { ok: true, sent };
});

export const runWebPushRemindersNow = createServerFn({ method: "POST" }).handler(async () => {
  requireUser(["Admin"]);
  const db = getDb();
  const sent = await processTaskWebPushReminders(db);
  return { ok: true, sent, diagnostics: getTaskWebPushDiagnostics(db) };
});
