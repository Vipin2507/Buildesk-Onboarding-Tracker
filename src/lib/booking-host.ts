import { eq } from "drizzle-orm";

import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";

/** Match a display name to an active CRM user id. */
function matchUserIdByName(name: string, users: { id: string; name: string; active: boolean | null }[]) {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return users.find((u) => u.active !== false && crmSalesManagerNamesMatch(trimmed, u.name))?.id;
}

/** Resolve booking host: Support Manager 1 → ERP support manager id → onboarding executive. */
export function resolveBookingHostUserId(companyId: string): string | undefined {
  const db = getDb();
  const users = db.select().from(t.users).all();

  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, companyId)).get();
  const supportManagerName = account?.supportManager1?.trim();
  if (supportManagerName) {
    const match = matchUserIdByName(supportManagerName, users);
    if (match) return match;
  }

  const company = db.select().from(t.companies).where(eq(t.companies.id, companyId)).get();
  if (company?.supportManager1Id) {
    const user = users.find((u) => u.id === company.supportManager1Id && u.active !== false);
    if (user) return user.id;
  }

  const onboarding = db
    .select()
    .from(t.crmOnboardingRecords)
    .where(eq(t.crmOnboardingRecords.companyId, companyId))
    .get();
  if (onboarding?.payloadJson) {
    try {
      const payload = JSON.parse(onboarding.payloadJson) as {
        tracker?: { assignedExecutiveId?: string };
      };
      const execId = payload.tracker?.assignedExecutiveId?.trim();
      if (execId) {
        const user = users.find((u) => u.id === execId && u.active !== false);
        if (user) return execId;
      }
    } catch {
      /* ignore */
    }
  }

  return undefined;
}

export function resolveHostTimezone(hostUserId: string | undefined): string {
  if (!hostUserId) return DEFAULT_BOOKING_TIMEZONE;
  const user = getDb().select().from(t.users).where(eq(t.users.id, hostUserId)).get();
  return user?.timezone?.trim() || DEFAULT_BOOKING_TIMEZONE;
}
