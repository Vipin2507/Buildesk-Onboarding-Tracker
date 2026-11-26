import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { newId, nowIso } from "@/types";

const seatRowSchema = z.object({
  accountName: z.string(),
  userId: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  dealValue: z.number().nullable(),
  dealValueWithGst: z.number().nullable(),
  users: z.number().nullable(),
  upgrade: z.number().nullable(),
  degrade: z.number().nullable(),
});

function norm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export const listCrmSeatSheets = createServerFn({ method: "GET" }).handler(async () => {
    const user = requireUser();
    const db = getDb();
    const accounts = db
      .select({
        id: t.crmAccounts.id,
        salesManagerName: t.crmAccounts.salesManagerName,
        supportManager1: t.crmAccounts.supportManager1,
        supportManager2: t.crmAccounts.supportManager2,
      })
      .from(t.crmAccounts)
      .all();
    const visible = new Set(
      accounts
        .filter(
          (account) =>
            isAdminRoleKey(user.role) ||
            canViewCrmAccount(
              {
                salesManagerName: account.salesManagerName ?? undefined,
                supportManager1: account.supportManager1 ?? undefined,
                supportManager2: account.supportManager2 ?? undefined,
              },
              user,
            ),
        )
        .map((account) => account.id),
    );
    const managers = new Map(accounts.map((account) => [account.id, account.salesManagerName]));
    const sheets = db.select().from(t.crmAccountSeatSheets).all();
    return {
      rows: sheets
        .filter((row) => visible.has(row.accountId))
        .map((row) => ({
          id: row.id,
          accountId: row.accountId,
          accountName: row.accountName,
          userId: row.userId ?? "",
          startDate: row.startDate,
          endDate: row.endDate,
          dealValue: row.dealValue,
          dealValueWithGst: row.dealValueWithGst,
          users: row.users,
          upgrade: row.upgrade,
          degrade: row.degrade,
          salesManagerName: managers.get(row.accountId) ?? null,
          updatedAt: row.updatedAt,
        })),
    };
  });

export const importCrmSeatSheets = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ rows: z.array(seatRowSchema).max(5000) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    if (!isAdminRoleKey(user.role)) {
      throw new ApiError(403, "Only an admin can upload the seat sheet.");
    }
    const db = getDb();
    const accounts = db
      .select({ id: t.crmAccounts.id, name: t.crmAccounts.name, userId: t.crmAccounts.userId })
      .from(t.crmAccounts)
      .all();
    const byUser = new Map<string, string>();
    const byName = new Map<string, string[]>();
    for (const account of accounts) {
      const userKey = norm(account.userId ?? "");
      if (userKey) byUser.set(userKey, account.id);
      const nameKey = norm(account.name);
      const list = byName.get(nameKey) ?? [];
      list.push(account.id);
      byName.set(nameKey, list);
    }

    const unmatched: { accountName: string; userId: string; reason: string }[] = [];
    let saved = 0;
    const now = nowIso();

    for (const row of data.rows) {
      const userKey = norm(row.userId);
      const nameKey = norm(row.accountName);
      let accountId = userKey ? byUser.get(userKey) : undefined;
      if (!accountId && nameKey) {
        const matches = byName.get(nameKey) ?? [];
        if (matches.length === 1) accountId = matches[0];
        else if (matches.length > 1) {
          unmatched.push({
            accountName: row.accountName,
            userId: row.userId,
            reason: "More than one account has this name. Add a User Id.",
          });
          continue;
        }
      }
      if (!accountId) {
        unmatched.push({
          accountName: row.accountName || "—",
          userId: row.userId,
          reason: "No matching CRM account.",
        });
        continue;
      }

      const existing = db
        .select({ id: t.crmAccountSeatSheets.id })
        .from(t.crmAccountSeatSheets)
        .where(eq(t.crmAccountSeatSheets.accountId, accountId))
        .get();
      const values = {
        accountId,
        userId: row.userId || null,
        accountName: row.accountName || row.userId,
        startDate: row.startDate,
        endDate: row.endDate,
        dealValue: row.dealValue,
        dealValueWithGst: row.dealValueWithGst,
        users: row.users,
        upgrade: row.upgrade,
        degrade: row.degrade,
        updatedAt: now,
      };
      if (existing) {
        db.update(t.crmAccountSeatSheets).set(values).where(eq(t.crmAccountSeatSheets.id, existing.id)).run();
      } else {
        db.insert(t.crmAccountSeatSheets)
          .values({ id: newId(), ...values, createdAt: now })
          .run();
      }
      saved += 1;
    }

    return { saved, unmatched };
  });
