import { and, eq } from "drizzle-orm";

import { financialYearStartFromYmd } from "@/lib/crm-renewal-years";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { newId, nowIso } from "@/types";

type Db = ReturnType<typeof getDb>;

function upsertYear(
  db: Db,
  accountId: string,
  fyStartYear: number,
  dealValue: number,
  now: string,
) {
  const existing = db
    .select({ id: t.crmAccountRenewalYears.id })
    .from(t.crmAccountRenewalYears)
    .where(
      and(
        eq(t.crmAccountRenewalYears.accountId, accountId),
        eq(t.crmAccountRenewalYears.fyStartYear, fyStartYear),
      ),
    )
    .get();
  if (existing) {
    db.update(t.crmAccountRenewalYears)
      .set({ dealValue, updatedAt: now })
      .where(eq(t.crmAccountRenewalYears.id, existing.id))
      .run();
    return;
  }
  db.insert(t.crmAccountRenewalYears)
    .values({
      id: newId(),
      accountId,
      fyStartYear,
      dealValue,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/**
 * Keep the closed year's deal (only if that year is not already on file)
 * and write the new period's deal. Does not touch the payment ledger.
 */
export function recordRenewalYearsOnRenew(
  db: Db,
  input: {
    accountId: string;
    previousStart: string | null;
    previousDeal: number | null;
    nextStart: string;
    nextDeal: number;
  },
) {
  const now = nowIso();
  const previousFy = financialYearStartFromYmd(input.previousStart);
  const nextFy = financialYearStartFromYmd(input.nextStart);
  if (
    previousFy != null &&
    previousFy !== nextFy &&
    input.previousDeal != null &&
    Number.isFinite(input.previousDeal)
  ) {
    const existing = db
      .select({ id: t.crmAccountRenewalYears.id })
      .from(t.crmAccountRenewalYears)
      .where(
        and(
          eq(t.crmAccountRenewalYears.accountId, input.accountId),
          eq(t.crmAccountRenewalYears.fyStartYear, previousFy),
        ),
      )
      .get();
    if (!existing) upsertYear(db, input.accountId, previousFy, input.previousDeal, now);
  }
  if (nextFy != null && Number.isFinite(input.nextDeal)) {
    upsertYear(db, input.accountId, nextFy, input.nextDeal, now);
  }
}
