import { assignableManagerUsers } from "@/lib/managers";
import { resolveCrmSalesManagerDefaults } from "@/lib/crm-sales-manager-defaults";
import type { CrmAccount } from "@/types/crm-account";
import type { Company } from "@/types/company";
import type { User } from "@/types";

type NamedUser = Pick<User, "id" | "name" | "active" | "productScope">;

/** Active CRM users for task assignee pickers. */
export function crmTaskAssigneeUsers(users: NamedUser[]): NamedUser[] {
  return [...users]
    .filter((u) => u.active !== false && u.productScope === "crm")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Active ERP users for task assignee pickers. */
export function erpTaskAssigneeUsers(users: NamedUser[]): NamedUser[] {
  return assignableManagerUsers(users as User[]).map((u) => ({
    id: u.id,
    name: u.name,
    active: u.active,
    productScope: u.productScope,
  }));
}

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

/** All active users, ensuring the account/company support manager 1 is listed. */
export function taskAssigneeUserOptions(input: {
  users: NamedUser[];
  company?: Pick<Company, "supportManager1Id"> | null;
  crmAccount?: Pick<CrmAccount, "supportManager1"> | null;
}): NamedUser[] {
  const active = crmTaskAssigneeUsers(input.users);
  const defaultIds = resolveDefaultTaskAssigneeIds({
    company: input.company,
    crmAccount: input.crmAccount,
    users: input.users,
  });
  const defaultId = defaultIds[0];
  if (!defaultId || active.some((u) => u.id === defaultId)) return active;

  const matched = input.users.find((u) => u.id === defaultId);
  if (matched) return [matched, ...active];

  if (input.crmAccount) {
    const crmDefaults = resolveCrmSalesManagerDefaults(input.crmAccount, input.users);
    if (crmDefaults.userId === defaultId) {
      return [
        {
          id: crmDefaults.userId,
          name: crmDefaults.name ?? "Support manager 1",
          active: true,
        },
        ...active,
      ];
    }
  }

  return active;
}

/** ERP task assignee options — defaults to company support manager 1. */
export function erpTaskAssigneeUserOptions(input: {
  users: NamedUser[];
  company?: Pick<Company, "supportManager1Id"> | null;
}): NamedUser[] {
  const active = erpTaskAssigneeUsers(input.users);
  const defaultIds = resolveDefaultTaskAssigneeIds({
    company: input.company,
    users: input.users,
  });
  const defaultId = defaultIds[0];
  if (!defaultId || active.some((u) => u.id === defaultId)) return active;

  const matched = input.users.find((u) => u.id === defaultId);
  if (matched) return [matched, ...active];
  return active;
}
