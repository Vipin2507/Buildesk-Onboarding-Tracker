import type { CrmAccount } from "@/types/crm-account";
import { isCrmAccountEnded } from "@/lib/crm-account-status";

export type ExecutiveUsersRow = {
  executive: string;
  accounts: number;
  activeUsers: number;
};

export type ExecutiveLocationRow = {
  location: string;
  users: number;
  accounts: number;
  byExecutive: { executive: string; users: number; accounts: number }[];
};

export type ExecutiveYearRow = {
  year: string;
  clients: number;
  byExecutive: { executive: string; clients: number }[];
};

export type CrmExecutiveAnalysis = {
  activeUsersByExecutive: ExecutiveUsersRow[];
  usersByLocation: ExecutiveLocationRow[];
  clientsByYear: ExecutiveYearRow[];
  totals: {
    executives: number;
    activeUsers: number;
    accounts: number;
  };
};

function execName(account: CrmAccount) {
  const name = account.salesManagerName?.trim();
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

function seats(account: CrmAccount) {
  return Math.max(0, account.usersPurchased ?? 0);
}

/** Active portfolio = not closed/suspended/inactive. Users = licensed seats (usersPurchased). */
export function buildCrmExecutiveAnalysis(accounts: CrmAccount[]): CrmExecutiveAnalysis {
  const active = accounts.filter((a) => !isCrmAccountEnded(a.status));

  const byExec = new Map<string, { accounts: number; activeUsers: number }>();
  for (const a of active) {
    const key = execName(a);
    const cur = byExec.get(key) ?? { accounts: 0, activeUsers: 0 };
    cur.accounts += 1;
    cur.activeUsers += seats(a);
    byExec.set(key, cur);
  }

  const activeUsersByExecutive = [...byExec.entries()]
    .map(([executive, v]) => ({ executive, ...v }))
    .sort((a, b) => b.activeUsers - a.activeUsers || a.executive.localeCompare(b.executive));

  const locMap = new Map<
    string,
    { users: number; accounts: number; exec: Map<string, { users: number; accounts: number }> }
  >();
  for (const a of active) {
    const loc = locationOf(a);
    const ex = execName(a);
    const entry = locMap.get(loc) ?? {
      users: 0,
      accounts: 0,
      exec: new Map(),
    };
    entry.users += seats(a);
    entry.accounts += 1;
    const ee = entry.exec.get(ex) ?? { users: 0, accounts: 0 };
    ee.users += seats(a);
    ee.accounts += 1;
    entry.exec.set(ex, ee);
    locMap.set(loc, entry);
  }

  const usersByLocation = [...locMap.entries()]
    .map(([location, v]) => ({
      location,
      users: v.users,
      accounts: v.accounts,
      byExecutive: [...v.exec.entries()]
        .map(([executive, e]) => ({ executive, users: e.users, accounts: e.accounts }))
        .sort((a, b) => b.users - a.users || a.executive.localeCompare(b.executive)),
    }))
    .sort((a, b) => b.users - a.users || a.location.localeCompare(b.location));

  const yearMap = new Map<string, { clients: number; exec: Map<string, number> }>();
  for (const a of accounts) {
    const year = yearOf(a);
    const ex = execName(a);
    const entry = yearMap.get(year) ?? { clients: 0, exec: new Map() };
    entry.clients += 1;
    entry.exec.set(ex, (entry.exec.get(ex) ?? 0) + 1);
    yearMap.set(year, entry);
  }

  const clientsByYear = [...yearMap.entries()]
    .map(([year, v]) => ({
      year,
      clients: v.clients,
      byExecutive: [...v.exec.entries()]
        .map(([executive, clients]) => ({ executive, clients }))
        .sort((a, b) => b.clients - a.clients || a.executive.localeCompare(b.executive)),
    }))
    .sort((a, b) => {
      if (a.year === "Unknown") return 1;
      if (b.year === "Unknown") return -1;
      return b.year.localeCompare(a.year);
    });

  return {
    activeUsersByExecutive,
    usersByLocation,
    clientsByYear,
    totals: {
      executives: activeUsersByExecutive.filter((r) => r.executive !== "Unassigned").length,
      activeUsers: activeUsersByExecutive.reduce((s, r) => s + r.activeUsers, 0),
      accounts: active.length,
    },
  };
}
