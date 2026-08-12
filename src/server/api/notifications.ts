import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
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

/** Active Admin user ids — bell notifications are admin-only. */
export function listActiveAdminUserIds(db: ReturnType<typeof getDb> = getDb()): string[] {
  return db
    .select({ id: t.users.id, role: t.users.role, active: t.users.active })
    .from(t.users)
    .all()
    .filter((u) => u.active && isAdminRoleKey(u.role))
    .map((u) => u.id);
}

type NotificationInsert = {
  id?: string;
  title: string;
  body?: string;
  kind?: AppNotification["kind"];
  href?: string;
  companyId?: string;
  ticketId?: string;
};

/**
 * Insert one row per active Admin (user-scoped). Never creates broadcast NULL userId rows.
 * Returns the row for `preferUserId` when that admin exists, else the first created row.
 */
export function insertNotificationsForAdmins(
  db: ReturnType<typeof getDb>,
  data: NotificationInsert,
  preferUserId?: string,
): AppNotification[] {
  const adminIds = listActiveAdminUserIds(db);
  if (adminIds.length === 0) return [];

  const now = nowIso();
  const created: AppNotification[] = [];
  for (let i = 0; i < adminIds.length; i++) {
    const id = i === 0 && data.id ? data.id : newId();
    db.insert(t.notifications)
      .values({
        id,
        userId: adminIds[i],
        title: data.title,
        body: data.body ?? "",
        kind: data.kind ?? "info",
        href: data.href ?? null,
        readAt: null,
        companyId: data.companyId ?? null,
        ticketId: data.ticketId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const row = db.select().from(t.notifications).where(eq(t.notifications.id, id)).get()!;
    created.push(mapNotification(row));
  }

  if (preferUserId) {
    const preferred = created.find((n) => n.userId === preferUserId);
    if (preferred) {
      return [preferred, ...created.filter((n) => n.id !== preferred.id)];
    }
  }
  return created;
}

export const listNotifications = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    // Bell feed is admin-only and strictly user-scoped (no shared NULL rows).
    if (!isAdminRoleKey(user.role)) return [];

    const limit = data?.limit ?? 80;
    const rows = getDb()
      .select()
      .from(t.notifications)
      .where(eq(t.notifications.userId, user.id))
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
    const actor = requireUser();
    const db = getDb();

    // Always fan-out to admins. Optional userId is ignored for targeting —
    // notifications are admin-only by product rule.
    const created = insertNotificationsForAdmins(
      db,
      {
        id: data.id,
        title: data.title,
        body: data.body,
        kind: data.kind,
        href: data.href,
        companyId: data.companyId,
        ticketId: data.ticketId,
      },
      actor.id,
    );

    if (created.length === 0) {
      throw new ApiError(400, "No admin recipients for notification");
    }
    return created[0];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    if (!isAdminRoleKey(user.role)) {
      throw new ApiError(403, "Notifications are admin-only");
    }
    const db = getDb();
    const row = db.select().from(t.notifications).where(eq(t.notifications.id, data.id)).get();
    if (!row || row.userId !== user.id) {
      throw new ApiError(404, "Notification not found");
    }
    const now = nowIso();
    db.update(t.notifications)
      .set({ readAt: now, updatedAt: now })
      .where(eq(t.notifications.id, data.id))
      .run();
    return { ok: true as const, readAt: now };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const user = requireUser();
  if (!isAdminRoleKey(user.role)) {
    throw new ApiError(403, "Notifications are admin-only");
  }
  const now = nowIso();
  const db = getDb();
  const rows = db
    .select()
    .from(t.notifications)
    .where(and(eq(t.notifications.userId, user.id), isNull(t.notifications.readAt)))
    .all();
  for (const row of rows) {
    db.update(t.notifications)
      .set({ readAt: now, updatedAt: now })
      .where(eq(t.notifications.id, row.id))
      .run();
  }
  return { ok: true as const, count: rows.length, readAt: now };
});
