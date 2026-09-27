import { eq } from "drizzle-orm";

import {
  isCrmAccountInRenewalWindow,
  nextRenewalStartDate,
  todayYmd,
} from "@/lib/crm-account-renewal";
import { formatDate } from "@/lib/utils";
import { insertNotificationsForUserIds, resolveNotificationRecipientIds } from "@/server/api/notifications";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

/** Bell notifications when CRM accounts enter the 30-day renewal window (deduped per endDate). */
export function processCrmAccountRenewalReminders(db: ReturnType<typeof getDb>): number {
  const today = todayYmd();
  const accounts = db.select().from(t.crmAccounts).all();
  let sent = 0;

  for (const account of accounts) {
    const endDate = account.endDate?.slice(0, 10);
    if (!endDate) continue;
    if (account.status === "closed" || account.status === "inactive") continue;
    if (!isCrmAccountInRenewalWindow({ endDate }, today)) continue;
    if (account.renewalWindowNotifiedForEndDate?.slice(0, 10) === endDate) continue;

    const recipientIds = resolveNotificationRecipientIds(db, {
      companyId: account.id,
      productScope: "crm",
    });
    if (recipientIds.length === 0) continue;

    const nextStart = nextRenewalStartDate(endDate);
    insertNotificationsForUserIds(db, recipientIds, {
      title: `Renewal window · ${account.name}`,
      body: nextStart
        ? `Service ends ${formatDate(endDate)}. Next period starts ${formatDate(nextStart)}. Open Renew on Accounts or Payments.`
        : `Service ends ${formatDate(endDate)}. Open Renew on Accounts or Payments.`,
      kind: "warning",
      href: `/crm/accounts/${account.id}`,
      companyId: account.id,
    });

    db.update(t.crmAccounts)
      .set({
        renewalWindowNotifiedForEndDate: endDate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(t.crmAccounts.id, account.id))
      .run();
    sent += 1;
  }

  return sent;
}
