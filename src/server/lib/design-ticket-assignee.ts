import { eq } from "drizzle-orm";

import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import { isCrmAccountCompanyStub } from "@/lib/design-ticket-portal";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * Resolve Support Manager 1 for a ticket company/account to an active user id.
 * CRM accounts store Support 1 as a free-text name; ERP companies may store supportManager1Id.
 */
export function resolveSupportManager1Assignee(
  db: Db,
  companyId: string,
): { assigneeId: string; assigneeName: string } | null {
  const company = db.select().from(t.companies).where(eq(t.companies.id, companyId)).get();

  // ERP company with explicit Support 1 user/employee id
  if (company && !isCrmAccountCompanyStub(company.billingInfo)) {
    const supportId = company.supportManager1Id?.trim();
    if (supportId) {
      const user = db.select().from(t.users).where(eq(t.users.id, supportId)).get();
      if (user && user.active !== false) {
        return { assigneeId: user.id, assigneeName: user.name };
      }
      const employee = db.select().from(t.employees).where(eq(t.employees.id, supportId)).get();
      if (employee) {
        return { assigneeId: employee.id, assigneeName: employee.name };
      }
    }
  }

  // CRM account stub (portal / CRM tickets): match supportManager1 name to active user
  const account = db.select().from(t.crmAccounts).where(eq(t.crmAccounts.id, companyId)).get();
  const supportLabel = account?.supportManager1?.trim();
  if (!supportLabel) return null;

  const users = db.select().from(t.users).all();
  const match = users.find(
    (u) => u.active !== false && crmSalesManagerNamesMatch(supportLabel, u.name),
  );
  if (!match) return null;
  return { assigneeId: match.id, assigneeName: match.name };
}
