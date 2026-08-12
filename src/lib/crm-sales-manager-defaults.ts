import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import type { CrmAccount } from "@/types/crm-account";

type NamedUser = { id: string; name: string; active?: boolean };

export type CrmSalesManagerDefaults = {
  userId?: string;
  name?: string;
};

/** Resolve the account's sales manager to a CRM user id + display name. */
export function resolveCrmSalesManagerDefaults(
  account: Pick<CrmAccount, "salesManagerName"> | null | undefined,
  users: NamedUser[],
): CrmSalesManagerDefaults {
  const name = account?.salesManagerName?.trim();
  if (!name) return {};
  const match = users.find((u) => u.active !== false && crmSalesManagerNamesMatch(name, u.name));
  return { userId: match?.id, name: match?.name ?? name };
}

/** Select value: stored assignee, else sales manager. */
export function crmAssigneeSelectValue(
  stored: string | undefined,
  salesManagerUserId?: string,
) {
  return stored ?? salesManagerUserId ?? "";
}

/**
 * Persist only when the user picks someone other than the default sales manager.
 * Keeping the default virtual means a later manager change still flows through.
 */
export function crmAssigneeSelectPatch(
  value: string,
  salesManagerUserId?: string,
): string | undefined {
  if (!value) return undefined;
  if (salesManagerUserId && value === salesManagerUserId) return undefined;
  return value;
}

/** Input value: stored trainer, else sales manager name. */
export function crmTrainerInputValue(stored: string | undefined, salesManagerName?: string) {
  return stored?.trim() ? stored : (salesManagerName ?? "");
}

/** Persist blank when it still matches the default sales manager name. */
export function crmTrainerInputPatch(value: string, salesManagerName?: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (salesManagerName && crmSalesManagerNamesMatch(trimmed, salesManagerName)) return "";
  return value;
}

/** Ensure the sales manager appears in assignee dropdowns. */
export function withCrmSalesManagerOption<T extends NamedUser>(
  users: T[],
  salesManager: CrmSalesManagerDefaults,
  allUsers: NamedUser[] = [],
): T[] {
  if (!salesManager.userId) return users;
  if (users.some((u) => u.id === salesManager.userId)) return users;
  const fromAll = allUsers.find((u) => u.id === salesManager.userId);
  if (fromAll) return [fromAll as T, ...users];
  return [
    { id: salesManager.userId, name: salesManager.name ?? "Sales manager", active: true } as T,
    ...users,
  ];
}
