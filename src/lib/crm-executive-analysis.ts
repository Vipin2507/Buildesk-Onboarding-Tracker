import type { CrmAccount } from "@/types/crm-account";
import { isCrmAccountEnded } from "@/lib/crm-account-status";

export type ExecutiveRole = "sales" | "support1" | "support2";

export type ExecutiveAccountRow = {
  name: string;
  accounts: number;
};

export type GroupedAccountRow = {
  key: string;
  accounts: number;
  byRole: { name: string; accounts: number }[];
};

export type CrmExecutiveAnalysis = {
  bySalesManager: ExecutiveAccountRow[];
  bySupport1: ExecutiveAccountRow[];
  bySupport2: ExecutiveAccountRow[];
  byLocation: GroupedAccountRow[];
  byYear: GroupedAccountRow[];
  totals: {
    activeAccounts: number;
  };
};

export const EXECUTIVE_ROLE_LABEL: Record<ExecutiveRole, string> = {
  sales: "Sales manager",
  support1: "Support 1",
  support2: "Support 2",
};

function label(value: string | undefined) {
  const name = value?.trim();
  return name || "Unassigned";
}

function locationOf(account: CrmAccount) {
  return (
    account.city?.trim() ||
    account.region?.trim() ||
    account.state?.trim() ||
    account.country?.trim() ||
    "Unknown"
  );
}

function yearOf(account: CrmAccount) {
  const raw = account.startDate?.trim() || account.createdAt?.slice(0, 10) || "";
  const m = raw.match(/^(\d{4})/);
  return m?.[1] ?? "Unknown";
}

function roleName(account: CrmAccount, role: ExecutiveRole) {
  if (role === "support1") return label(account.supportManager1);
  if (role === "support2") return label(account.supportManager2);
  return label(account.salesManagerName);
}

function countBy(
  accounts: CrmAccount[],
  pick: (a: CrmAccount) => string | undefined,
): ExecutiveAccountRow[] {
  const map = new Map<string, number>();
  for (const a of accounts) {
    const key = label(pick(a));
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, accounts]) => ({ name, accounts }))
    .sort((a, b) => b.accounts - a.accounts || a.name.localeCompare(b.name));
}

function countByKeyWithRole(
  accounts: CrmAccount[],
  pickKey: (a: CrmAccount) => string,
  role: ExecutiveRole,
): GroupedAccountRow[] {
  const map = new Map<string, { accounts: number; roles: Map<string, number> }>();
  for (const a of accounts) {
    const key = pickKey(a);
    const person = roleName(a, role);
    const entry = map.get(key) ?? { accounts: 0, roles: new Map() };
    entry.accounts += 1;
    entry.roles.set(person, (entry.roles.get(person) ?? 0) + 1);
    map.set(key, entry);
  }
  return [...map.entries()].map(([key, v]) => ({
    key,
    accounts: v.accounts,
    byRole: [...v.roles.entries()]
      .map(([name, accounts]) => ({ name, accounts }))
      .sort((a, b) => b.accounts - a.accounts || a.name.localeCompare(b.name)),
  }));
}

/** Active accounts (not closed/suspended/inactive) by manager, location, and year. */
export function buildCrmExecutiveAnalysis(
  accounts: CrmAccount[],
  opts?: { locationRole?: ExecutiveRole; yearRole?: ExecutiveRole },
): CrmExecutiveAnalysis {
  const active = accounts.filter((a) => !isCrmAccountEnded(a.status));
  const locationRole = opts?.locationRole ?? "sales";
  const yearRole = opts?.yearRole ?? "sales";

  const byLocation = countByKeyWithRole(active, locationOf, locationRole).sort(
    (a, b) => b.accounts - a.accounts || a.key.localeCompare(b.key),
  );

  const byYear = countByKeyWithRole(active, yearOf, yearRole).sort((a, b) => {
    if (a.key === "Unknown") return 1;
    if (b.key === "Unknown") return -1;
    return b.key.localeCompare(a.key);
  });

  return {
    bySalesManager: countBy(active, (a) => a.salesManagerName),
    bySupport1: countBy(active, (a) => a.supportManager1),
    bySupport2: countBy(active, (a) => a.supportManager2),
    byLocation,
    byYear,
    totals: { activeAccounts: active.length },
  };
}
