import type { CrmAccount } from "@/types/crm-account";

/** Latest start date first; missing dates last; tie-break by name. */
export function compareCrmAccountsByStartDateDesc(
  a: Pick<CrmAccount, "startDate" | "name">,
  b: Pick<CrmAccount, "startDate" | "name">,
) {
  const aDate = a.startDate?.trim().slice(0, 10) ?? "";
  const bDate = b.startDate?.trim().slice(0, 10) ?? "";
  if (!aDate && !bDate) return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (!aDate) return 1;
  if (!bDate) return -1;
  const byDate = bDate.localeCompare(aDate);
  if (byDate !== 0) return byDate;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function sortCrmAccountsByStartDateDesc<T extends Pick<CrmAccount, "startDate" | "name">>(
  accounts: T[],
): T[] {
  return [...accounts].sort(compareCrmAccountsByStartDateDesc);
}
