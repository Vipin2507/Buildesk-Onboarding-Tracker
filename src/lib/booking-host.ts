import { eq } from "drizzle-orm";

import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { DEFAULT_BOOKING_TIMEZONE } from "@/types/booking";

/** Resolve booking host: assigned executive → sales manager user match. */
export function resolveBookingHostUserId(companyId: string): string | undefined {
  const db = getDb();
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
        const user = db.select().from(t.users).where(eq(t.users.id, execId)).get();
        if (user?.active !== false) return execId;
      }
    } catch {
      /* ignore */
    }
  }

  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, companyId)).get();
  const managerName = account?.salesManagerName?.trim();
  if (!managerName) return undefined;

  const users = db.select().from(t.users).all();
  const match = users.find(
    (u) => u.active !== false && crmSalesManagerNamesMatch(managerName, u.name),
  );
  return match?.id;
}

export function resolveHostTimezone(hostUserId: string | undefined): string {
  if (!hostUserId) return DEFAULT_BOOKING_TIMEZONE;
  const user = getDb().select().from(t.users).where(eq(t.users.id, hostUserId)).get();
  return user?.timezone?.trim() || DEFAULT_BOOKING_TIMEZONE;
}
