import type { CrmAccount } from "@/types/crm-account";
import { crmSalesManagerNamesMatch } from "@/lib/crm-account-access";
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

/** Year → month → executive hierarchy for the Year tab. */
export type ExecutiveYearMonthRow = {
  name: string;
  accounts: number;
  months: {
    name: string;
    monthKey: string;
    accounts: number;
    executives: ExecutiveAccountRow[];
  }[];
};

export type CrmExecutiveAnalysis = {
  bySalesManager: ExecutiveAccountRow[];
  bySupport1: ExecutiveAccountRow[];
  bySupport2: ExecutiveAccountRow[];
  byLocation: ExecutiveDetailRow[];
  byYear: ExecutiveYearMonthRow[];
  totals: {
    activeAccounts: number;
  };
  /** When set, analysis is scoped to this executive only (non-admin). */
  scopedToName?: string;
};

export const EXECUTIVE_ROLE_LABEL: Record<ExecutiveRole, string> = {
  sales: "Sales manager",
  support1: "Support 1",
  support2: "Support 2",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function label(value: string | undefined) {
  const name = value?.trim();
  return name || "Unassigned";
}

function locationOf(account: CrmAccount) {
  return (
    account.region?.trim() ||
    account.state?.trim() ||
    account.city?.trim() ||
    account.country?.trim() ||
    "Unknown"
  );
}

function accountDateRaw(account: CrmAccount) {
  return account.startDate?.trim() || account.createdAt?.slice(0, 10) || "";
}

/** Returns `{ year, monthKey, monthName }` — monthKey is `01`–`12` or `Unknown`. */
function yearMonthOf(account: CrmAccount): {
  year: string;
  monthKey: string;
  monthName: string;
} {
  const raw = accountDateRaw(account);
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const monthIdx = Number(m[2]) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return { year: m[1], monthKey: m[2], monthName: MONTH_NAMES[monthIdx] };
    }
  }
  const yearOnly = raw.match(/^(\d{4})/);
  if (yearOnly) {
    return { year: yearOnly[1], monthKey: "Unknown", monthName: "Unknown" };
  }
  return { year: "Unknown", monthKey: "Unknown", monthName: "Unknown" };
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

/** Group by executive first; nested breakdown is location. */
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

function sortMonthKey(a: string, b: string) {
  if (a === "Unknown") return 1;
  if (b === "Unknown") return -1;
  return a.localeCompare(b);
}

function sortLocationLabel(a: string, b: string) {
  return a.localeCompare(b);
}

function keepOwnRows<T extends { name: string }>(rows: T[], viewerName: string | undefined): T[] {
  if (!viewerName?.trim()) return [];
  return rows.filter((r) => crmSalesManagerNamesMatch(r.name, viewerName));
}

function accountMatchesViewer(account: CrmAccount, role: ExecutiveRole, viewerName: string) {
  return crmSalesManagerNamesMatch(roleName(account, role), viewerName);
}

/** Year → month → executive. */
function yearsWithMonthsAndExecutives(
  accounts: CrmAccount[],
  role: ExecutiveRole,
): ExecutiveYearMonthRow[] {
  type MonthBucket = {
    monthName: string;
    accounts: number;
    executives: Map<string, number>;
  };
  const years = new Map<string, { accounts: number; months: Map<string, MonthBucket> }>();

  for (const a of accounts) {
    const { year, monthKey, monthName } = yearMonthOf(a);
    const person = roleName(a, role);
    const yearEntry = years.get(year) ?? { accounts: 0, months: new Map() };
    yearEntry.accounts += 1;
    const monthEntry = yearEntry.months.get(monthKey) ?? {
      monthName,
      accounts: 0,
      executives: new Map(),
    };
    monthEntry.accounts += 1;
    monthEntry.executives.set(person, (monthEntry.executives.get(person) ?? 0) + 1);
    yearEntry.months.set(monthKey, monthEntry);
    years.set(year, yearEntry);
  }

  return [...years.entries()]
    .map(([name, v]) => ({
      name,
      accounts: v.accounts,
      months: [...v.months.entries()]
        .map(([monthKey, m]) => ({
          name: m.monthName,
          monthKey,
          accounts: m.accounts,
          executives: [...m.executives.entries()]
            .map(([execName, accounts]) => ({ name: execName, accounts }))
            .sort((a, b) => b.accounts - a.accounts || a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => sortMonthKey(a.monthKey, b.monthKey)),
    }))
    .sort((a, b) => sortYearLabel(a.name, b.name) || b.accounts - a.accounts);
}

/**
 * Active accounts by manager / region / year.
 * Admins see everyone; non-admins only see rows matching their own name.
 */
export function buildCrmExecutiveAnalysis(
  accounts: CrmAccount[],
  opts?: {
    locationRole?: ExecutiveRole;
    yearRole?: ExecutiveRole;
    /** Logged-in user name — used when `isAdmin` is false */
    viewerName?: string;
    isAdmin?: boolean;
  },
): CrmExecutiveAnalysis {
  const active = accounts.filter((a) => !isCrmAccountEnded(a.status));
  const locationRole = opts?.locationRole ?? "sales";
  const yearRole = opts?.yearRole ?? "sales";
  const isAdmin = opts?.isAdmin ?? true;
  const viewerName = opts?.viewerName?.trim();

  let bySalesManager = countBy(active, (a) => a.salesManagerName);
  let bySupport1 = countBy(active, (a) => a.supportManager1);
  let bySupport2 = countBy(active, (a) => a.supportManager2);
  let byLocation = executivesWithBreakdown(active, locationRole, locationOf, sortLocationLabel);

  const yearAccounts =
    !isAdmin && viewerName
      ? active.filter((a) => accountMatchesViewer(a, yearRole, viewerName))
      : active;
  const byYear = yearsWithMonthsAndExecutives(yearAccounts, yearRole);

  if (!isAdmin) {
    bySalesManager = keepOwnRows(bySalesManager, viewerName);
    bySupport1 = keepOwnRows(bySupport1, viewerName);
    bySupport2 = keepOwnRows(bySupport2, viewerName);
    byLocation = keepOwnRows(byLocation, viewerName);
  }

  return {
    bySalesManager,
    bySupport1,
    bySupport2,
    byLocation,
    byYear,
    totals: { activeAccounts: active.length },
    scopedToName: isAdmin ? undefined : viewerName || undefined,
  };
}
