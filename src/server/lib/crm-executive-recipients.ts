import { eq } from "drizzle-orm";

import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { resolveUserWorkEmail } from "@/lib/user-email";
import { listActiveAdminUserIds } from "@/server/api/notifications";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

export type CrmExecutiveRecipient = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isAdmin: boolean;
};

function listActiveCrmUsers(db: ReturnType<typeof getDb>) {
  return db
    .select()
    .from(t.users)
    .all()
    .filter((u) => u.active !== false && (u.productScope || "erp") === "crm");
}

/**
 * CRM Admins + Support 1 / Support 2 / Sales manager matched by display name.
 * Shared by payment executive reminders and onboarding SLA.
 */
export function resolveExecutiveRecipients(
  db: ReturnType<typeof getDb>,
  account: typeof t.crmAccounts.$inferSelect,
  options?: { includeSalesManager?: boolean },
): CrmExecutiveRecipient[] {
  const includeSales = options?.includeSalesManager !== false;
  const roles: { label: string; name?: string | null }[] = [
    { label: "Support 1", name: account.supportManager1 },
    { label: "Support 2", name: account.supportManager2 },
  ];
  if (includeSales) {
    roles.push({ label: "Sales manager", name: account.salesManagerName });
  }

  const seen = new Set<string>();
  const recipients: CrmExecutiveRecipient[] = [];

  for (const adminId of listActiveAdminUserIds(db, "crm")) {
    const user = db.select().from(t.users).where(eq(t.users.id, adminId)).get();
    if (!user || user.active === false) continue;
    const email = resolveUserWorkEmail(user);
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    recipients.push({
      id: user.id,
      name: user.name,
      email,
      phone: user.phone ?? undefined,
      role: "Admin",
      isAdmin: true,
    });
  }

  for (const role of roles) {
    const displayName = role.name?.trim();
    if (!displayName) continue;
    for (const user of listActiveCrmUsers(db)) {
      if (!crmSalesManagerNamesMatch(displayName, user.name)) continue;
      const email = resolveUserWorkEmail(user);
      if (!email || seen.has(email.toLowerCase())) continue;
      seen.add(email.toLowerCase());
      recipients.push({
        id: user.id,
        name: user.name,
        email,
        phone: user.phone ?? undefined,
        role: role.label,
        isAdmin: false,
      });
    }
  }

  return recipients;
}

/** Onboarding SLA: Admins + Support 1 + Support 2 only (per product request). */
export function resolveOnboardingSlaRecipients(
  db: ReturnType<typeof getDb>,
  account: typeof t.crmAccounts.$inferSelect,
): CrmExecutiveRecipient[] {
  return resolveExecutiveRecipients(db, account, { includeSalesManager: false });
}
