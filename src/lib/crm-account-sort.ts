import type { CrmAccount } from "@/types/crm-account";

export type CrmAccountSortField =
  | "startDate"
  | "endDate"
  | "name"
  | "userId"
  | "users"
  | "city"
  | "dealSize"
  | "progress";

export type CrmAccountSortDir = "asc" | "desc";

export type CrmAccountSortBy = `${CrmAccountSortField}:${CrmAccountSortDir}`;

export const CRM_ACCOUNT_SORT_FIELDS: { value: CrmAccountSortField; label: string }[] = [
  { value: "startDate", label: "Start date" },
  { value: "endDate", label: "End date" },
  { value: "name", label: "Account name" },
  { value: "userId", label: "User ID" },
  { value: "users", label: "Users" },
  { value: "city", label: "City" },
  { value: "dealSize", label: "Deal size" },
  { value: "progress", label: "Progress" },
];

export const CRM_ACCOUNT_SORT_DIRS: { value: CrmAccountSortDir; label: string }[] = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

/** @deprecated Prefer CRM_ACCOUNT_SORT_FIELDS + CRM_ACCOUNT_SORT_DIRS */
export const CRM_ACCOUNT_SORT_OPTIONS: { value: CrmAccountSortBy; label: string }[] =
  CRM_ACCOUNT_SORT_FIELDS.flatMap((field) =>
    CRM_ACCOUNT_SORT_DIRS.map((dir) => ({
      value: `${field.value}:${dir.value}` as CrmAccountSortBy,
      label: `${field.label} (${dir.label.toLowerCase()})`,
    })),
  );

export const DEFAULT_CRM_ACCOUNT_SORT: CrmAccountSortBy = "startDate:desc";

export function parseCrmAccountSortBy(sortBy: string): {
  field: CrmAccountSortField;
  dir: CrmAccountSortDir;
} {
  const [fieldRaw, dirRaw] = sortBy.split(":");
  const field = (fieldRaw ?? "startDate") as CrmAccountSortField;
  const dir: CrmAccountSortDir = dirRaw === "asc" ? "asc" : "desc";
  const known: CrmAccountSortField[] = [
    "startDate",
    "endDate",
    "name",
    "userId",
    "users",
    "city",
    "dealSize",
    "progress",
  ];
  return {
    field: known.includes(field) ? field : "startDate",
    dir,
  };
}

export function composeCrmAccountSortBy(
  field: CrmAccountSortField,
  dir: CrmAccountSortDir,
): CrmAccountSortBy {
  return `${field}:${dir}`;
}

function parseSortBy(sortBy: string): { field: CrmAccountSortField; dir: CrmAccountSortDir } {
  return parseCrmAccountSortBy(sortBy);
}

function dateKey(value: string | undefined | null) {
  return value?.trim().slice(0, 10) ?? "";
}

function cmpText(a: string, b: string, dir: CrmAccountSortDir) {
  const result = a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return dir === "asc" ? result : -result;
}

function cmpNumber(a: number, b: number, dir: CrmAccountSortDir) {
  if (a === b) return 0;
  const result = a < b ? -1 : 1;
  return dir === "asc" ? result : -result;
}

/** Empty dates sort last regardless of direction. */
function cmpDate(a: string, b: string, dir: CrmAccountSortDir) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const result = a.localeCompare(b);
  return dir === "asc" ? result : -result;
}

type SortableAccount = Pick<
  CrmAccount,
  "name" | "userId" | "usersPurchased" | "startDate" | "endDate" | "city" | "dealSize"
> & { progress?: number };

function compareCrmAccounts(
  a: SortableAccount,
  b: SortableAccount,
  field: CrmAccountSortField,
  dir: CrmAccountSortDir,
) {
  switch (field) {
    case "startDate":
      return cmpDate(dateKey(a.startDate), dateKey(b.startDate), dir);
    case "endDate":
      return cmpDate(dateKey(a.endDate), dateKey(b.endDate), dir);
    case "name":
      return cmpText(a.name ?? "", b.name ?? "", dir);
    case "userId":
      return cmpText(a.userId?.trim() ?? "", b.userId?.trim() ?? "", dir);
    case "users":
      return cmpNumber(a.usersPurchased ?? 0, b.usersPurchased ?? 0, dir);
    case "city":
      return cmpText(a.city ?? "", b.city ?? "", dir);
    case "dealSize":
      return cmpNumber(a.dealSize ?? 0, b.dealSize ?? 0, dir);
    case "progress":
      return cmpNumber(a.progress ?? 0, b.progress ?? 0, dir);
    default:
      return 0;
  }
}

/** Latest start date first; missing dates last; tie-break by name. */
export function compareCrmAccountsByStartDateDesc(
  a: Pick<CrmAccount, "startDate" | "name">,
  b: Pick<CrmAccount, "startDate" | "name">,
) {
  return (
    cmpDate(dateKey(a.startDate), dateKey(b.startDate), "desc") ||
    cmpText(a.name, b.name, "asc")
  );
}

export function sortCrmAccountsByStartDateDesc<T extends Pick<CrmAccount, "startDate" | "name">>(
  accounts: T[],
): T[] {
  return [...accounts].sort(compareCrmAccountsByStartDateDesc);
}

export function sortCrmAccounts<T extends SortableAccount>(
  accounts: T[],
  sortBy: string = DEFAULT_CRM_ACCOUNT_SORT,
): T[] {
  const { field, dir } = parseSortBy(sortBy);
  return [...accounts].sort((a, b) => {
    const primary = compareCrmAccounts(a, b, field, dir);
    if (primary !== 0) return primary;
    // Stable tie-breakers
    const byName = cmpText(a.name ?? "", b.name ?? "", "asc");
    if (byName !== 0) return byName;
    return cmpText(a.userId?.trim() ?? "", b.userId?.trim() ?? "", "asc");
  });
}
