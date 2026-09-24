import type { CrmAccount } from "@/types/crm-account";
import { isCrmAccountEnded } from "@/lib/crm-account-status";

export type ExecutiveRole = "sales" | "support1" | "support2";

export type ExecutiveAccountRow = {
  name: string;
  accounts: number;
};

export type ExecutiveDetailRow = {
  name: string;
  accounts: number;
  breakdown: { label: string; accounts: number }[];
};

export type CrmExecutiveAnalysis = {
  bySalesManager: ExecutiveAccountRow[];
  bySupport1: ExecutiveAccountRow[];
  bySupport2: ExecutiveAccountRow[];
  byLocation: ExecutiveDetailRow[];
  byYear: ExecutiveDetailRow[];
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

/** Group by executive first; nested breakdown is location or year. */
function executivesWithBreakdown(
  accounts: CrmAccount[],
  role: ExecutiveRole,
  pickBreakdown: (a: CrmAccount) => string,
  sortBreakdown: (a: string, b: string) => number,
): ExecutiveDetailRow[] {
  const map = new Map<string, { accounts: number; parts: Map<string, number> }>();
  for (const a of accounts) {
    const person = roleName(a, role);
    const part = pickBreakdown(a);
    const entry = map.get(person) ?? { accounts: 0, parts: new Map() };
    entry.accounts += 1;
    entry.parts.set(part, (entry.parts.get(part) ?? 0) + 1);
    map.set(person, entry);
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      accounts: v.accounts,
      breakdown: [...v.parts.entries()]
        .map(([label, accounts]) => ({ label, accounts }))
        .sort((a, b) => sortBreakdown(a.label, b.label) || b.accounts - a.accounts),
    }))
    .sort((a, b) => b.accounts - a.accounts || a.name.localeCompare(b.name));
}

function sortYearLabel(a: string, b: string) {
  if (a === "Unknown") return 1;
  if (b === "Unknown") return -1;
  return b.localeCompare(a);
}

function sortLocationLabel(a: string, b: string) {
  return a.localeCompare(b);
}

/** Active accounts (not closed/suspended/inactive) by manager, location, and year. */
export function buildCrmExecutiveAnalysis(
  accounts: CrmAccount[],
  opts?: { locationRole?: ExecutiveRole; yearRole?: ExecutiveRole },
): CrmExecutiveAnalysis {
  const active = accounts.filter((a) => !isCrmAccountEnded(a.status));
  const locationRole = opts?.locationRole ?? "sales";
  const yearRole = opts?.yearRole ?? "sales";

  return {
    bySalesManager: countBy(active, (a) => a.salesManagerName),
    bySupport1: countBy(active, (a) => a.supportManager1),
    bySupport2: countBy(active, (a) => a.supportManager2),
    byLocation: executivesWithBreakdown(active, locationRole, locationOf, sortLocationLabel),
    byYear: executivesWithBreakdown(active, yearRole, yearOf, sortYearLabel),
    totals: { activeAccounts: active.length },
  };
}
