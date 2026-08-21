import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError, newId, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { canViewCrmAccount, crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { sortCrmAccountsByStartDateDesc } from "@/lib/crm-account-sort";
import { isAdminRoleKey } from "@/lib/permissions";
import type { CrmAccount } from "@/types/crm-account";
import type { CompanyType } from "@/types/company";

function mapRow(row: typeof t.crmAccounts.$inferSelect): CrmAccount {
  const status = row.status === "churned" ? "closed" : row.status;
  return {
    id: row.id,
    name: row.name,
    userId: row.userId ?? undefined,
    companyType: row.companyType as CompanyType,
    contact: row.contact,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    region: row.region ?? undefined,
    ownerName: row.ownerName ?? undefined,
    ownerPhone: row.ownerPhone ?? undefined,
    ownerEmail: row.ownerEmail ?? undefined,
    pocName: row.pocName ?? undefined,
    pocMobile: row.pocMobile ?? undefined,
    pocEmail: row.pocEmail ?? undefined,
    salesManagerName: row.salesManagerName ?? undefined,
    accountManagerName: row.accountManagerName ?? undefined,
    supportManager1: row.supportManager1 ?? undefined,
    supportManager2: row.supportManager2 ?? undefined,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    annualLicense: row.annualLicense ?? undefined,
    dealSize: row.dealSize ?? undefined,
    usersPurchased: row.usersPurchased ?? undefined,
    totalCost: row.totalCost ?? undefined,
    paymentReceived: row.paymentReceived ?? undefined,
    pendingAmount: row.pendingAmount ?? undefined,
    healthScore: row.healthScore ?? undefined,
    status: status as CrmAccount["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const accountInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  userId: z.string().optional().nullable(),
  companyType: z.string().min(1),
  contact: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  ownerEmail: z.string().optional().nullable(),
  pocName: z.string().optional().nullable(),
  pocMobile: z.string().optional().nullable(),
  pocEmail: z.string().optional().nullable(),
  salesManagerName: z.string().optional().nullable(),
  accountManagerName: z.string().optional().nullable(),
  supportManager1: z.string().optional().nullable(),
  supportManager2: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  annualLicense: z.boolean().optional().nullable(),
  dealSize: z.number().optional().nullable(),
  usersPurchased: z.number().int().optional().nullable(),
  totalCost: z.number().optional().nullable(),
  paymentReceived: z.number().optional().nullable(),
  pendingAmount: z.number().optional().nullable(),
  healthScore: z.number().int().optional().nullable(),
  status: z.enum(["active", "onboarding", "live", "suspended", "inactive", "closed"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

function toRowValues(
  data: z.infer<typeof accountInput>,
  id: string,
  createdAt: string,
  updatedAt: string,
) {
  return {
    id,
    name: data.name,
    userId: data.userId || null,
    companyType: data.companyType,
    contact: data.contact,
    phone: data.phone,
    email: data.email,
    city: data.city,
    state: data.state || null,
    country: data.country || null,
    region: data.region || null,
    ownerName: data.ownerName || null,
    ownerPhone: data.ownerPhone || null,
    ownerEmail: data.ownerEmail || null,
    pocName: data.pocName || null,
    pocMobile: data.pocMobile || null,
    pocEmail: data.pocEmail || null,
    salesManagerName: data.salesManagerName || null,
    accountManagerName: data.accountManagerName || null,
    supportManager1: data.supportManager1 || null,
    supportManager2: data.supportManager2 || null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    annualLicense: data.annualLicense ?? null,
    dealSize: data.dealSize ?? null,
    usersPurchased: data.usersPurchased ?? null,
    totalCost: data.totalCost ?? null,
    paymentReceived: data.paymentReceived ?? null,
    pendingAmount: data.pendingAmount ?? null,
    healthScore: data.healthScore ?? null,
    status: data.status ?? "onboarding",
    createdAt,
    updatedAt,
  };
}

export const listCrmAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireUser();
  const db = getDb();
  const rows = sortCrmAccountsByStartDateDesc(
    db.select().from(t.crmAccounts).all().map(mapRow),
  );

  if (isAdminRoleKey(user.role)) return rows;
  return rows.filter((a) => canViewCrmAccount(a, user));
});

function assertCanMutateAccount(
  user: { name: string; role: string },
  existing:
    | {
        salesManagerName: string | null;
        supportManager1: string | null;
        supportManager2: string | null;
      }
    | undefined,
  nextSalesManagerName: string | null | undefined,
) {
  if (isAdminRoleKey(user.role)) return;
  if (existing) {
    if (
      !canViewCrmAccount(
        {
          salesManagerName: existing.salesManagerName ?? undefined,
          supportManager1: existing.supportManager1 ?? undefined,
          supportManager2: existing.supportManager2 ?? undefined,
        },
        user,
      )
    ) {
      throw new ApiError(403, "You can only manage accounts assigned to you");
    }
    return;
  }
  // New accounts must be created with the current user as sales manager.
  if (!crmSalesManagerNamesMatch(nextSalesManagerName ?? undefined, user.name)) {
    throw new ApiError(403, "Sales manager must be you for accounts you manage");
  }
}

export const upsertCrmAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => accountInput.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const now = nowIso();
    const id = data.id ?? newId();
    const existing = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, id)).get();

    assertCanMutateAccount(user, existing, data.salesManagerName);

    if (existing) {
      const updatedAt = data.updatedAt ?? now;
      db.update(t.crmAccounts)
        .set({
          ...toRowValues(data, id, existing.createdAt, updatedAt),
          id,
          createdAt: existing.createdAt,
          updatedAt,
        })
        .where(eq(t.crmAccounts.id, id))
        .run();
    } else {
      const createdAt = data.createdAt ?? now;
      const updatedAt = data.updatedAt ?? now;
      db.insert(t.crmAccounts)
        .values(toRowValues(data, id, createdAt, updatedAt))
        .run();
    }

    const row = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, id)).get();
    if (!row) throw new ApiError(500, "Failed to save CRM account");
    return mapRow(row);
  });

export const upsertCrmAccountsBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ accounts: z.array(accountInput) }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const now = nowIso();
    const saved: CrmAccount[] = [];

    for (const item of data.accounts) {
      const id = item.id ?? newId();
      const existing = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, id)).get();
      assertCanMutateAccount(user, existing, item.salesManagerName);
      if (existing) {
        const updatedAt = item.updatedAt ?? now;
        db.update(t.crmAccounts)
          .set({
            ...toRowValues(item, id, existing.createdAt, updatedAt),
            id,
            createdAt: existing.createdAt,
            updatedAt,
          })
          .where(eq(t.crmAccounts.id, id))
          .run();
      } else {
        const createdAt = item.createdAt ?? now;
        const updatedAt = item.updatedAt ?? now;
        db.insert(t.crmAccounts)
          .values(toRowValues(item, id, createdAt, updatedAt))
          .run();
      }
      const row = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, id)).get();
      if (row) saved.push(mapRow(row));
    }

    return saved;
  });

export const deleteCrmAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    const db = getDb();
    const existing = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, data.id)).get();
    if (!existing) throw new ApiError(404, "CRM account not found");
    if (
      !isAdminRoleKey(user.role) &&
      !canViewCrmAccount(
        {
          salesManagerName: existing.salesManagerName ?? undefined,
          supportManager1: existing.supportManager1 ?? undefined,
          supportManager2: existing.supportManager2 ?? undefined,
        },
        user,
      )
    ) {
      throw new ApiError(403, "You can only delete accounts assigned to you");
    }
    db.delete(t.crmOnboardingRecords).where(eq(t.crmOnboardingRecords.companyId, data.id)).run();
    db.delete(t.crmAccounts).where(eq(t.crmAccounts.id, data.id)).run();
    return mapRow(existing);
  });
