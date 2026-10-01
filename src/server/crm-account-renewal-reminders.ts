import { eq } from "drizzle-orm";

import {
  isCrmAccountInRenewalWindow,
  nextRenewalStartDate,
  todayYmd,
} from "@/lib/crm-account-renewal";
import { formatDate } from "@/lib/utils";
import { insertNotificationsForUserIds, resolveNotificationRecipientIds } from "@/server/api/notifications";
import { dispatchCrmAccountRenewalAutomation } from "@/server/crm-account-renewal-automation";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

/**
 * Bell notifications (admins + account team) and WhatsApp to CRM admins
 * when accounts enter the 30-day renewal window (deduped per endDate).
 */
export async function processCrmAccountRenewalReminders(
  db: ReturnType<typeof getDb>,
): Promise<number> {
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

    const nextStart = nextRenewalStartDate(endDate);
    if (recipientIds.length > 0) {
      insertNotificationsForUserIds(db, recipientIds, {
        title: `Renewal window · ${account.name}`,
        body: nextStart
          ? `Service ends ${formatDate(endDate)}. Next period starts ${formatDate(nextStart)}. Sales: ${account.salesManagerName?.trim() || "—"}. Support 1: ${account.supportManager1?.trim() || "—"}. Support 2: ${account.supportManager2?.trim() || "—"}. Open Renew on Accounts or Payments.`
          : `Service ends ${formatDate(endDate)}. Sales: ${account.salesManagerName?.trim() || "—"}. Support 1: ${account.supportManager1?.trim() || "—"}. Support 2: ${account.supportManager2?.trim() || "—"}. Open Renew on Accounts or Payments.`,
        kind: "warning",
        href: `/crm/accounts/${account.id}`,
        companyId: account.id,
      });
    }

    await dispatchCrmAccountRenewalAutomation(db, {
      accountId: account.id,
      accountName: account.name,
      endDate,
      salesManagerName: account.salesManagerName,
      supportManager1: account.supportManager1,
      supportManager2: account.supportManager2,
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
