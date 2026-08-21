import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
import type { CrmAccount } from "@/types/crm-account";

type NamedUser = { id: string; name: string; active?: boolean };

export type CrmSalesManagerDefaults = {
  userId?: string;
  name?: string;
};

/** Resolve the account's support manager 1 to a CRM user id + display name. */
export function resolveCrmSalesManagerDefaults(
  account: Pick<CrmAccount, "supportManager1"> | null | undefined,
  users: NamedUser[],
): CrmSalesManagerDefaults {
  const name = account?.supportManager1?.trim();
  if (!name) return {};
  const match = users.find((u) => u.active !== false && crmSalesManagerNamesMatch(name, u.name));
  return { userId: match?.id, name: match?.name ?? name };
}

/** Select value: stored assignee, else support manager 1. */
export function crmAssigneeSelectValue(
  stored: string | undefined,
  salesManagerUserId?: string,
) {
  return stored ?? salesManagerUserId ?? "";
}

/**
 * Persist only when the user picks someone other than the default support manager 1.
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

/** Input value: stored trainer, else support manager 1 name. */
export function crmTrainerInputValue(stored: string | undefined, salesManagerName?: string) {
  return stored?.trim() ? stored : (salesManagerName ?? "");
}

/** Persist blank when it still matches the default support manager 1 name. */
export function crmTrainerInputPatch(value: string, salesManagerName?: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (salesManagerName && crmSalesManagerNamesMatch(trimmed, salesManagerName)) return "";
  return value;
}

/** Ensure support manager 1 appears in assignee dropdowns. */
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
    { id: salesManager.userId, name: salesManager.name ?? "Support manager 1", active: true } as T,
    ...users,
  ];
}
