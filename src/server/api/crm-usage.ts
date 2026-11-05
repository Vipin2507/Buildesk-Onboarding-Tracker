import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { isAdminRoleKey, roleHasPermission } from "@/lib/permissions";
import { ApiError, requireUser } from "@/server/auth/session";
import { loadServerRoles } from "@/server/auth/permissions";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import {
  loadUsageDays,
  loadUsageDetail,
  resolveUsageKey,
  scanUsageAccounts,
} from "@/server/lib/buildesk-usage";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function assertRange(from: string, to: string, maxDays: number) {
  if (from > to) throw new ApiError(400, "Start date must be on or before the end date");
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days > maxDays) throw new ApiError(400, `Choose ${maxDays} days or fewer`);
}

function canManageAll(user: { role: string }) {
  if (isAdminRoleKey(user.role)) return true;
  return roleHasPermission(loadServerRoles(), user.role, "manageCompanies");
}

function visibleAccounts() {
  const user = requireUser();
  const db = getDb();
  const accounts = db.select().from(t.crmAccounts).all();
  const portals = db.select().from(t.companyPortalAccess).all();
  const portalByCompany = new Map(portals.map((row) => [row.companyId, row]));
  const visible = canManageAll(user)
    ? accounts
    : accounts.filter((account) =>
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
  return visible.map((account) => {
    const portal = portalByCompany.get(account.id);
    const key = resolveUsageKey(account.name, portal?.slug);
    const licensedUsers = account.usersPurchased || key?.monitorUsers || 0;
    return {
      id: account.id,
      name: account.name,
      status: account.status === "churned" ? "closed" : account.status,
      city: account.city,
      salesManagerName: account.salesManagerName ?? "",
      supportManager1: account.supportManager1 ?? "",
      licensedUsers,
      connected: Boolean(key),
      keySource: key?.source ?? ("none" as const),
      apiKey: key?.apiKey ?? null,
    };
  });
}

function accountOrThrow(accountId: string) {
  const account = visibleAccounts().find((row) => row.id === accountId);
  if (!account) throw new ApiError(404, "Account not found");
  if (!account.apiKey) throw new ApiError(400, "This account has no Buildesk API key");
  return account;
}

export const listCrmUsageAccounts = createServerFn({ method: "GET" }).handler(async () => {
  return visibleAccounts()
    .map(({ apiKey: _apiKey, ...account }) => account)
    .sort((a, b) => a.name.localeCompare(b.name));
});

export const scanCrmUsage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        accountIds: z.array(z.string()).min(1).max(8),
        from: daySchema,
        to: daySchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    assertRange(data.from, data.to, 92);
    const byId = new Map(visibleAccounts().map((account) => [account.id, account]));
    const targets = data.accountIds.map((id) => {
      const account = byId.get(id);
      if (!account) throw new ApiError(404, "Account not found");
      return { id: account.id, apiKey: account.apiKey };
    });
    return scanUsageAccounts(targets, data.from, data.to);
  });

export const getCrmUsageDetail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ accountId: z.string().min(1), from: daySchema, to: daySchema }).parse(data),
  )
  .handler(async ({ data }) => {
    assertRange(data.from, data.to, 92);
    const account = accountOrThrow(data.accountId);
    try {
      return await loadUsageDetail(
        account.id,
        account.apiKey!,
        data.from,
        data.to,
        account.licensedUsers,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Buildesk API request failed";
      throw new ApiError(502, message.slice(0, 240));
    }
  });

export const getCrmUsageDays = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ accountId: z.string().min(1), from: daySchema, to: daySchema }).parse(data),
  )
  .handler(async ({ data }) => {
    assertRange(data.from, data.to, 31);
    const account = accountOrThrow(data.accountId);
    return loadUsageDays(account.apiKey!, data.from, data.to);
  });
