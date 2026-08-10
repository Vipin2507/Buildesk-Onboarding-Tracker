import { isAdminRoleKey } from "@/lib/permissions";
import type { CrmAccount } from "@/types/crm-account";

export function normalizeCrmManagerLabel(name: string) {
  return name
    .trim()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** True when assigned sales-manager label matches the logged-in user name. */
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

export function canViewCrmAccount(
  account: Pick<CrmAccount, "salesManagerName">,
  user: { name: string; role?: string } | null | undefined,
) {
  if (!user) return false;
  if (isAdminRoleKey(user.role)) return true;
  return crmSalesManagerNamesMatch(account.salesManagerName, user.name);
}

export function filterCrmAccountsForUser<T extends Pick<CrmAccount, "salesManagerName">>(
  accounts: T[],
  user: { name: string; role?: string } | null | undefined,
): T[] {
  if (!user) return [];
  if (isAdminRoleKey(user.role)) return accounts;
  return accounts.filter((a) => crmSalesManagerNamesMatch(a.salesManagerName, user.name));
}
