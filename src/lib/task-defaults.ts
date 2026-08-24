import { resolveCrmSalesManagerDefaults } from "@/lib/crm-sales-manager-defaults";
import type { CrmAccount } from "@/types/crm-account";
import type { Company } from "@/types/company";
import type { User } from "@/types";

type NamedUser = Pick<User, "id" | "name" | "active">;

/** Default assignee = Support Agent / Support Manager 1 for the account or company. */
export function resolveDefaultTaskAssigneeIds(input: {
  company?: Pick<Company, "supportManager1Id"> | null;
  crmAccount?: Pick<CrmAccount, "supportManager1"> | null;
  users: NamedUser[];
}): string[] {
  if (input.company?.supportManager1Id) {
    return [input.company.supportManager1Id];
  }
  const defaults = resolveCrmSalesManagerDefaults(input.crmAccount, input.users);
  return defaults.userId ? [defaults.userId] : [];
}

export function resolveTaskAssigneeOptions(input: {
  users: NamedUser[];
  crmAccount?: Pick<CrmAccount, "supportManager1"> | null;
}): NamedUser[] {
  const defaults = resolveCrmSalesManagerDefaults(input.crmAccount, input.users);
  const active = input.users.filter((u) => u.active !== false);
  if (!defaults.userId || active.some((u) => u.id === defaults.userId)) return active;
  return [
    { id: defaults.userId, name: defaults.name ?? "Support Agent 1", active: true },
    ...active,
  ];
}
