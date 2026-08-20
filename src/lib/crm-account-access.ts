import { isAdminRoleKey } from "@/lib/permissions";
import type { CrmAccount } from "@/types/crm-account";

export function normalizeCrmManagerLabel(name: string) {
  return name
    .trim()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** True when assigned manager label matches the logged-in user name. */
export function crmSalesManagerNamesMatch(
  assigned: string | undefined,
  userName: string | undefined,
) {
  if (!assigned?.trim() || !userName?.trim()) return false;
  const a = normalizeCrmManagerLabel(assigned);
  const b = normalizeCrmManagerLabel(userName);
  if (a === b) return true;
  return a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
}

export type CrmAccountAssignmentFields = Pick<
  CrmAccount,
  "salesManagerName" | "supportManager1" | "supportManager2"
>;

/** True when the user is sales manager or support manager 1/2 on the account. */
export function isCrmAccountAssignedToUser(
  account: CrmAccountAssignmentFields,
  userName: string | undefined,
) {
  return (
    crmSalesManagerNamesMatch(account.salesManagerName, userName) ||
    crmSalesManagerNamesMatch(account.supportManager1, userName) ||
    crmSalesManagerNamesMatch(account.supportManager2, userName)
  );
}

export function canViewCrmAccount(
  account: CrmAccountAssignmentFields,
  user: { name: string; role?: string } | null | undefined,
) {
  if (!user) return false;
  if (isAdminRoleKey(user.role)) return true;
  return isCrmAccountAssignedToUser(account, user.name);
}

export function filterCrmAccountsForUser<T extends CrmAccountAssignmentFields>(
  accounts: T[],
  user: { name: string; role?: string } | null | undefined,
): T[] {
  if (!user) return [];
  if (isAdminRoleKey(user.role)) return accounts;
  return accounts.filter((a) => isCrmAccountAssignedToUser(a, user.name));
}
