import type { CrmAccount } from "@/types/crm-account";
import { isCrmAccountEnded } from "@/lib/crm-account-status";

export type ExecutiveAccountRow = {
  name: string;
  accounts: number;
};

export type CrmExecutiveAnalysis = {
  bySalesManager: ExecutiveAccountRow[];
  bySupport1: ExecutiveAccountRow[];
  bySupport2: ExecutiveAccountRow[];
  totals: {
    activeAccounts: number;
  };
};

function label(value: string | undefined) {
  const name = value?.trim();
  return name || "Unassigned";
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

/** Active accounts (not closed/suspended/inactive) grouped by sales & support managers. */
export function buildCrmExecutiveAnalysis(accounts: CrmAccount[]): CrmExecutiveAnalysis {
  const active = accounts.filter((a) => !isCrmAccountEnded(a.status));

  return {
    bySalesManager: countBy(active, (a) => a.salesManagerName),
    bySupport1: countBy(active, (a) => a.supportManager1),
    bySupport2: countBy(active, (a) => a.supportManager2),
    totals: { activeAccounts: active.length },
  };
}
