import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { eachIsoDay } from "@/lib/crm-usage";
import { canViewCrmAccount } from "@/lib/crm-account-access";
import { isCrmAccountEnded } from "@/lib/crm-account-status";
import { ApiError, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { resolveUsageKey } from "@/server/lib/buildesk-usage";
import {
  boardRowsForAccounts,
  readUsageAccountPage,
  readUsageSync,
  refreshUsageRange,
} from "@/server/lib/crm-usage-store";
import type { CrmAccount } from "@/types/crm-account";
import type { CrmUsageAccount } from "@/types/crm-usage";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function assertRange(from: string, to: string, maxDays: number) {
  if (from > to) throw new ApiError(400, "Start date must be on or before the end date");
  if (eachIsoDay(from, to).length > maxDays) throw new ApiError(400, `Choose ${maxDays} days or fewer`);
}

type UsageAccount = CrmUsageAccount & { apiKey: string | null };

function loadUsageAccounts(user: { name: string; role: string }): UsageAccount[] {
  const db = getDb();
  const accounts = db.select().from(t.crmAccounts).all();
  const portals = db.select().from(t.companyPortalAccess).all();
  const portalByCompany = new Map(portals.map((row) => [row.companyId, row]));
  const visible = accounts.filter((account) =>
    canViewCrmAccount(
      {
        salesManagerName: account.salesManagerName ?? undefined,
        supportManager1: account.supportManager1 ?? undefined,
        supportManager2: account.supportManager2 ?? undefined,
        accountManagerName: account.accountManagerName ?? undefined,
      },
      user,
    ),
  );
  return visible.flatMap((account) => {
    const status = account.status === "churned" ? "closed" : account.status;
    if (isCrmAccountEnded(status as CrmAccount["status"])) return [];
    const portal = portalByCompany.get(account.id);
    const key = resolveUsageKey(account.name, portal?.slug);
    return [{
      id: account.id,
      name: account.name,
      status,
      city: account.city,
      salesManagerName: account.salesManagerName ?? "",
      supportManager1: account.supportManager1 ?? "",
      supportManager2: account.supportManager2 ?? "",
      licensedUsers: account.usersPurchased || key?.monitorUsers || 0,
      connected: Boolean(key),
      keySource: key?.source ?? "none",
      apiKey: key?.apiKey ?? null,
    }];
  });
}

function accountOrThrow(accountId: string) {
  const user = requireUser();
  const account = loadUsageAccounts(user).find((row) => row.id === accountId);
  if (!account) throw new ApiError(404, "Account not found");
  return account;
}

export const getCrmUsageBoard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ from: daySchema, to: daySchema }).parse(data))
  .handler(async ({ data }) => {
    assertRange(data.from, data.to, 92);
    const user = requireUser();
    const db = getDb();
    const accounts = loadUsageAccounts(user).map(({ apiKey: _apiKey, ...account }) => account);
    return {
      from: data.from,
      to: data.to,
      expectedDays: eachIsoDay(data.from, data.to).length,
      sync: readUsageSync(db),
      rows: boardRowsForAccounts(db, accounts, data.from, data.to),
    };
  });

export const refreshCrmUsageAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().min(1),
        from: daySchema,
        to: daySchema,
        force: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    assertRange(data.from, data.to, 10);
    const account = accountOrThrow(data.accountId);
    if (!account.apiKey) throw new ApiError(400, "This account has no Buildesk API key");
    return refreshUsageRange(getDb(), account.id, account.apiKey, data.from, data.to, Boolean(data.force));
  });

export const getCrmUsageAccountPage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ accountId: z.string().min(1), from: daySchema, to: daySchema }).parse(data),
  )
  .handler(async ({ data }) => {
    assertRange(data.from, data.to, 92);
    const account = accountOrThrow(data.accountId);
    const { apiKey: _apiKey, ...publicAccount } = account;
    return readUsageAccountPage(getDb(), publicAccount, data.from, data.to);
  });
