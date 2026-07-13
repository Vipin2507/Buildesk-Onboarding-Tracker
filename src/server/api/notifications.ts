import { createServerFn } from "@tanstack/react-start";
import { desc, eq, or, isNull } from "drizzle-orm";
import { z } from "zod";

import { newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { AppNotification } from "@/types";

function mapNotification(row: typeof t.notifications.$inferSelect): AppNotification {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    title: row.title,
    body: row.body,
    kind: row.kind as AppNotification["kind"],
    href: row.href ?? undefined,
    readAt: row.readAt ?? undefined,
    companyId: row.companyId ?? undefined,
    ticketId: row.ticketId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const listNotifications = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const limit = data?.limit ?? 80;
    const rows = getDb()
      .select()
      .from(t.notifications)
      .where(or(eq(t.notifications.userId, user.id), isNull(t.notifications.userId)))
      .orderBy(desc(t.notifications.createdAt))
      .limit(limit)
      .all();
    return rows.map(mapNotification);
  });

export const createNotification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        userId: z.string().optional(),
        title: z.string().min(1),
        body: z.string().optional(),
        kind: z.enum(["success", "info", "warning", "danger"]).optional(),
        href: z.string().optional(),
        companyId: z.string().optional(),
        ticketId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    const now = nowIso();
    const id = data.id ?? newId();
    getDb()
      .insert(t.notifications)
      .values({
        id,
        userId: data.userId,
        title: data.title,
        body: data.body ?? "",
        kind: data.kind ?? "info",
        href: data.href,
        readAt: null,
        companyId: data.companyId,
        ticketId: data.ticketId,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const row = getDb().select().from(t.notifications).where(eq(t.notifications.id, id)).get()!;
    return mapNotification(row);
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    requireUser();
    const now = nowIso();
    getDb()
      .update(t.notifications)
      .set({ readAt: now, updatedAt: now })
      .where(eq(t.notifications.id, data.id))
      .run();
    return { ok: true as const, readAt: now };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const user = requireUser();
  const now = nowIso();
  const db = getDb();
  const rows = db
    .select()
    .from(t.notifications)
    .where(or(eq(t.notifications.userId, user.id), isNull(t.notifications.userId)))
    .all()
    .filter((r) => !r.readAt);
  for (const row of rows) {
    db.update(t.notifications)
      .set({ readAt: now, updatedAt: now })
      .where(eq(t.notifications.id, row.id))
      .run();
  }
  return { ok: true as const, count: rows.length, readAt: now };
});
