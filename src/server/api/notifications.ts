import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
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

type NotificationProductScope = "erp" | "crm";

function scopeFromHref(href?: string | null): NotificationProductScope {
  return href?.startsWith("/crm") ? "crm" : "erp";
}

export function listActiveAdminUserIds(
  db: ReturnType<typeof getDb> = getDb(),
  productScope?: NotificationProductScope,
): string[] {
  return db
    .select({
      id: t.users.id,
      role: t.users.role,
      active: t.users.active,
      productScope: t.users.productScope,
    })
    .from(t.users)
    .all()
    .filter(
      (u) =>
        u.active &&
        isAdminRoleKey(u.role) &&
        (!productScope || (u.productScope || "erp") === productScope),
    )
    .map((u) => u.id);
}

/**
 * Recipients for a notification:
 * - all active Admins (always)
 * - explicit extra user ids (assignees, etc.)
 * - CRM account sales / support managers (name match)
 * - ERP company onboarding / CSM / support managers
 * - optional actor (so they see their own activity)
 */
export function resolveNotificationRecipientIds(
  db: ReturnType<typeof getDb>,
  opts: {
    companyId?: string;
    extraUserIds?: Array<string | undefined | null>;
    includeActorId?: string;
    productScope?: NotificationProductScope;
  },
): string[] {
  const ids = new Set<string>(listActiveAdminUserIds(db, opts.productScope));

  for (const id of opts.extraUserIds ?? []) {
    if (id?.trim()) ids.add(id.trim());
  }
  if (opts.includeActorId?.trim()) ids.add(opts.includeActorId.trim());

  if (opts.companyId) {
    const users = db
      .select({
        id: t.users.id,
        name: t.users.name,
        active: t.users.active,
        productScope: t.users.productScope,
      })
      .from(t.users)
      .all()
      .filter(
        (u) =>
          u.active &&
          (!opts.productScope || (u.productScope || "erp") === opts.productScope),
      );

    const account = db
      .select()
      .from(t.crmAccounts)
      .where(eq(t.crmAccounts.id, opts.companyId))
      .get();
    if (account) {
      for (const label of [
        account.salesManagerName,
        account.supportManager1,
        account.supportManager2,
      ]) {
        if (!label?.trim()) continue;
        for (const u of users) {
          if (crmSalesManagerNamesMatch(label, u.name)) ids.add(u.id);
        }
      }
    }

    const company = db
      .select()
      .from(t.companies)
      .where(eq(t.companies.id, opts.companyId))
      .get();
    if (company) {
      for (const id of [
        company.onboardingManagerId,
        company.csmId,
        company.supportManager1Id,
        company.supportManager2Id,
      ]) {
        if (id?.trim()) ids.add(id.trim());
      }
    }
  }

  return [...ids];
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

function eventKey(n: Pick<AppNotification, "title" | "body" | "companyId" | "ticketId" | "createdAt">) {
  return `${n.title}\0${n.body}\0${n.companyId ?? ""}\0${n.ticketId ?? ""}\0${n.createdAt}`;
}

function insertForUserIds(
  db: ReturnType<typeof getDb>,
  data: NotificationInsert,
  userIds: string[],
  preferUserId?: string,
): AppNotification[] {
  const now = nowIso();

  if (userIds.length === 0) {
    const id = data.id ?? newId();
    db.insert(t.notifications)
      .values({
        id,
        userId: null,
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
    return [mapNotification(db.select().from(t.notifications).where(eq(t.notifications.id, id)).get()!)];
  }

  const created: AppNotification[] = [];
  for (let i = 0; i < userIds.length; i++) {
    const id = i === 0 && data.id ? data.id : newId();
    db.insert(t.notifications)
      .values({
        id,
        userId: userIds[i],
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
    created.push(
      mapNotification(db.select().from(t.notifications).where(eq(t.notifications.id, id)).get()!),
    );
  }

  if (preferUserId) {
    const preferred = created.find((n) => n.userId === preferUserId);
    if (preferred) return [preferred, ...created.filter((n) => n.id !== preferred.id)];
  }
  return created;
}

/** Targeted in-app notifications for specific users (e.g. task assignees). */
export function insertNotificationsForUserIds(
  db: ReturnType<typeof getDb>,
  userIds: string[],
  data: NotificationInsert,
): AppNotification[] {
  const ids = userIds.filter((id) => id?.trim());
  return insertForUserIds(db, data, ids);
}

/** @deprecated name kept for design-ticket callers — fans out to admins + account stakeholders. */
export function insertNotificationsForAdmins(
  db: ReturnType<typeof getDb>,
  data: NotificationInsert,
  preferUserId?: string,
): AppNotification[] {
  const recipientIds = resolveNotificationRecipientIds(db, {
    companyId: data.companyId,
    includeActorId: preferUserId,
    productScope: scopeFromHref(data.href),
  });
  return insertForUserIds(db, data, recipientIds, preferUserId);
}

/** In-app bell alert when a portal guest requests a call (host + admins + account managers). */
export function insertBookingRequestNotification(
  db: ReturnType<typeof getDb>,
  opts: {
    appointment: {
      id: string;
      companyId: string;
      hostUserId: string;
      guestName: string;
      startsAt: string;
    };
    eventTitle: string;
    accountName: string;
  },
): AppNotification[] {
  const when = `${opts.appointment.startsAt.slice(0, 10)} · ${opts.appointment.startsAt.slice(11, 16)}`;
  const recipientIds = resolveNotificationRecipientIds(db, {
    companyId: opts.appointment.companyId,
    extraUserIds: [opts.appointment.hostUserId],
    productScope: "crm",
  });
  return insertForUserIds(
    db,
    {
      title: `New meeting request — ${opts.appointment.guestName}`,
      body: `${opts.eventTitle} · ${opts.accountName} · ${when}`,
      kind: "info",
      href: "/crm/bookings?tab=pending",
      companyId: opts.appointment.companyId,
      ticketId: opts.appointment.id,
    },
    recipientIds,
    opts.appointment.hostUserId,
  );
}

function dedupeAdminFeed(rows: AppNotification[], viewerId: string, limit: number) {
  const groups = new Map<string, AppNotification[]>();
  for (const n of rows) {
    const key = eventKey(n);
    const list = groups.get(key);
    if (list) list.push(n);
    else groups.set(key, [n]);
  }

  const feed: AppNotification[] = [];
  for (const group of groups.values()) {
    const preferred =
      group.find((n) => n.userId === viewerId) ??
      group.find((n) => !n.userId) ??
      group[0];
    feed.push(preferred);
  }

  return feed.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export const listNotifications = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    const limit = data?.limit ?? 80;
    const db = getDb();

    // Admins see the full feed for their product only (ERP and CRM stay isolated).
    if (isAdminRoleKey(user.role)) {
      const rows = db
        .select()
        .from(t.notifications)
        .orderBy(desc(t.notifications.createdAt))
        .limit(Math.min(limit * 8, 500))
        .all()
        .filter(
          (row) =>
            scopeFromHref(row.href) ===
            (((user.productScope as NotificationProductScope | undefined) ?? "erp")),
        )
        .map(mapNotification);
      return dedupeAdminFeed(rows, user.id, limit);
    }

    // Everyone else: only their own user-scoped notifications.
    return db
      .select()
      .from(t.notifications)
      .where(eq(t.notifications.userId, user.id))
      .orderBy(desc(t.notifications.createdAt))
      .limit(limit)
      .all()
      .map(mapNotification);
  });

export const createNotification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        userId: z.string().optional(),
        recipientUserIds: z.array(z.string()).optional(),
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
    const recipientIds = resolveNotificationRecipientIds(db, {
      companyId: data.companyId,
      extraUserIds: [...(data.recipientUserIds ?? []), data.userId],
      includeActorId: actor.id,
      productScope: scopeFromHref(data.href),
    });
    const created = insertForUserIds(
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
      recipientIds,
      actor.id,
    );
    return created[0]!;
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const row = db.select().from(t.notifications).where(eq(t.notifications.id, data.id)).get();
    if (!row) throw new ApiError(404, "Notification not found");

    const isAdmin = isAdminRoleKey(user.role);
    if (!isAdmin && row.userId !== user.id) {
      throw new ApiError(404, "Notification not found");
    }

    if (isAdmin && row.userId && row.userId !== user.id) {
      const twin = db
        .select()
        .from(t.notifications)
        .where(
          and(
            eq(t.notifications.userId, user.id),
            eq(t.notifications.title, row.title),
            eq(t.notifications.body, row.body),
            eq(t.notifications.createdAt, row.createdAt),
          ),
        )
        .get();
      const targetId = twin?.id ?? row.id;
      const now = nowIso();
      db.update(t.notifications)
        .set({ readAt: now, updatedAt: now })
        .where(eq(t.notifications.id, targetId))
        .run();
      return { ok: true as const, readAt: now };
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
  const now = nowIso();
  const db = getDb();
  const rows = db
    .select()
    .from(t.notifications)
    .where(
      and(
        isNull(t.notifications.readAt),
        isAdminRoleKey(user.role)
          ? or(eq(t.notifications.userId, user.id), isNull(t.notifications.userId))
          : eq(t.notifications.userId, user.id),
      ),
    )
    .all();
  for (const row of rows) {
    db.update(t.notifications)
      .set({ readAt: now, updatedAt: now })
      .where(eq(t.notifications.id, row.id))
      .run();
  }
  return { ok: true as const, count: rows.length, readAt: now };
});
