import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { crmAccountHasRenewalCycle } from "@/lib/crm-account-renewal";
import { summarizeAccountRenewals, type RenewalYearSummary } from "@/lib/crm-renewal-years";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { newId, nowIso } from "@/types";

const importRowSchema = z.object({
  accountName: z.string(),
  years: z
    .array(
      z.object({
        fyStartYear: z.number().int().min(1990).max(2100),
        dealValue: z.number().nullable(),
      }),
    )
    .max(40),
});

function norm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function yearsForAccount(accountId: string) {
  const db = getDb();
  return db
    .select({
      fyStartYear: t.crmAccountRenewalYears.fyStartYear,
      dealValue: t.crmAccountRenewalYears.dealValue,
    })
    .from(t.crmAccountRenewalYears)
    .where(eq(t.crmAccountRenewalYears.accountId, accountId))
    .all();
}

export const getCrmAccountRenewalSummary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ accountId: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<RenewalYearSummary> => {
    const user = requireUser();
    const db = getDb();
    const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, data.accountId)).get();
    if (!account) throw new ApiError(404, "Account not found");
    if (
      !isAdminRoleKey(user.role) &&
      !canViewCrmAccount(
        {
          salesManagerName: account.salesManagerName ?? undefined,
          supportManager1: account.supportManager1 ?? undefined,
          supportManager2: account.supportManager2 ?? undefined,
        },
        user,
      )
    ) {
      throw new ApiError(403, "You cannot view this account");
    }
    return summarizeAccountRenewals({
      years: yearsForAccount(account.id),
      currentDeal: account.dealSize,
      hasRenewalCycle: crmAccountHasRenewalCycle(account.paymentCycleBaseline),
      cycleStartDate: account.startDate,
    });
  });

export const importCrmAccountRenewalYears = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ rows: z.array(importRowSchema).max(5000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = requireUser();
    if (!isAdminRoleKey(user.role)) {
      throw new ApiError(403, "Only an admin can upload renewal years.");
    }
    const db = getDb();
    const accounts = db
      .select({ id: t.crmAccounts.id, name: t.crmAccounts.name })
      .from(t.crmAccounts)
      .all();
    const byName = new Map<string, string[]>();
    for (const account of accounts) {
      const key = norm(account.name);
      const list = byName.get(key) ?? [];
      list.push(account.id);
      byName.set(key, list);
    }

    const unmatched: { accountName: string; reason: string }[] = [];
    let saved = 0;
    const now = nowIso();

    for (const row of data.rows) {
      const nameKey = norm(row.accountName);
      if (!nameKey) {
        unmatched.push({ accountName: "—", reason: "Missing account name." });
        continue;
      }
      let accountId: string | undefined;
      const exact = byName.get(nameKey) ?? [];
      if (exact.length === 1) accountId = exact[0];
      else if (exact.length > 1) {
        unmatched.push({
          accountName: row.accountName,
          reason: "More than one account has this name.",
        });
        continue;
      } else if (nameKey.length >= 4) {
        const fuzzy = accounts.filter((account) => {
          const name = norm(account.name);
          return name.includes(nameKey) || nameKey.includes(name);
        });
        if (fuzzy.length === 1) accountId = fuzzy[0]?.id;
        else if (fuzzy.length > 1) {
          unmatched.push({
            accountName: row.accountName,
            reason: "Several accounts look like this name.",
          });
          continue;
        }
      }
      if (!accountId) {
        unmatched.push({ accountName: row.accountName, reason: "No matching CRM account." });
        continue;
      }

      for (const year of row.years) {
        const where = and(
          eq(t.crmAccountRenewalYears.accountId, accountId),
          eq(t.crmAccountRenewalYears.fyStartYear, year.fyStartYear),
        );
        if (year.dealValue == null || year.dealValue <= 0) {
          db.delete(t.crmAccountRenewalYears).where(where).run();
          continue;
        }
        const existing = db
          .select({ id: t.crmAccountRenewalYears.id })
          .from(t.crmAccountRenewalYears)
          .where(where)
          .get();
        if (existing) {
          db.update(t.crmAccountRenewalYears)
            .set({ dealValue: year.dealValue, updatedAt: now })
            .where(eq(t.crmAccountRenewalYears.id, existing.id))
            .run();
        } else {
          db.insert(t.crmAccountRenewalYears)
            .values({
              id: newId(),
              accountId,
              fyStartYear: year.fyStartYear,
              dealValue: year.dealValue,
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }
      }
      saved += 1;
    }

    return { saved, unmatched };
  });
