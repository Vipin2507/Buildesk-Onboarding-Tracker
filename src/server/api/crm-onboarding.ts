import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { canViewCrmAccount } from "@/lib/crm-account-access";
import { isAdminRoleKey } from "@/lib/permissions";
import { ApiError, nowIso, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { CrmOnboardingRecord } from "@/types/crm-onboarding";

function parsePayload(raw: string): CrmOnboardingRecord {
  return JSON.parse(raw) as CrmOnboardingRecord;
}

function assertCanAccessCompany(user: { name: string; role: string }, companyId: string) {
  const account = getDb()
    .select()
    .from(t.crmAccounts)
    .where(eq(t.crmAccounts.id, companyId))
    .get();
  if (!account) throw new ApiError(404, "CRM account not found");
  if (
    !canViewCrmAccount(
      {
        salesManagerName: account.salesManagerName ?? undefined,
        supportManager1: account.supportManager1 ?? undefined,
        supportManager2: account.supportManager2 ?? undefined,
      },
      user,
    )
  ) {
    throw new ApiError(403, "You can only access accounts assigned to you");
  }
  return account;
}

export const listCrmOnboardingRecords = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireUser();
  const db = getDb();
  const rows = db
    .select()
    .from(t.crmOnboardingRecords)
    .orderBy(asc(t.crmOnboardingRecords.companyId))
    .all();

  const records = rows.map((row) => parsePayload(row.payloadJson));
  if (isAdminRoleKey(user.role)) return records;

  const accounts = db.select().from(t.crmAccounts).all();
  const allowed = new Set(
    accounts
      .filter((a) =>
        canViewCrmAccount(
          {
            salesManagerName: a.salesManagerName ?? undefined,
            supportManager1: a.supportManager1 ?? undefined,
            supportManager2: a.supportManager2 ?? undefined,
          },
          user,
        ),
      )
      .map((a) => a.id),
  );
  return records.filter((r) => allowed.has(r.companyId));
});

const recordSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyTypeHint: z.string().optional(),
  productModules: z.array(z.any()),
  masterChecklist: z.array(z.any()),
  masterProjects: z.array(z.any()).optional(),
  masterSources: z.array(z.any()).optional(),
  masterStatuses: z.array(z.any()).optional(),
  masterFollowUps: z.array(z.any()).optional(),
  masterTeams: z.array(z.any()).optional(),
  migrationChecklist: z.array(z.any()),
  trainingSessions: z.array(z.any()),
  reportChecklist: z.array(z.any()),
  goLiveChecklist: z.array(z.any()),
  tracker: z.any(),
  commLog: z.array(z.any()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const upsertCrmOnboardingRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => recordSchema.parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanAccessCompany(user, data.companyId);

    const db = getDb();
    const now = nowIso();
    const payload = JSON.stringify(data);
    const existing = db
      .select()
      .from(t.crmOnboardingRecords)
      .where(eq(t.crmOnboardingRecords.companyId, data.companyId))
      .get();

    if (existing) {
      db.update(t.crmOnboardingRecords)
        .set({
          payloadJson: payload,
          updatedAt: data.updatedAt || now,
        })
        .where(eq(t.crmOnboardingRecords.companyId, data.companyId))
        .run();
    } else {
      db.insert(t.crmOnboardingRecords)
        .values({
          companyId: data.companyId,
          payloadJson: payload,
          createdAt: data.createdAt || now,
          updatedAt: data.updatedAt || now,
        })
        .run();
    }

    const row = db
      .select()
      .from(t.crmOnboardingRecords)
      .where(eq(t.crmOnboardingRecords.companyId, data.companyId))
      .get();
    if (!row) throw new ApiError(500, "Failed to save CRM onboarding");
    return parsePayload(row.payloadJson);
  });

export const deleteCrmOnboardingRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ companyId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = requireUser();
    assertCanAccessCompany(user, data.companyId);
    const db = getDb();
    db.delete(t.crmOnboardingRecords)
      .where(eq(t.crmOnboardingRecords.companyId, data.companyId))
      .run();
    return { ok: true as const };
  });
