/** Shared department choices for user admin / profile forms. */
export const USER_DEPARTMENT_OPTIONS = [
  "Accounts",
  "CRM",
  "Customer Success",
  "Implementation",
  "Operations",
  "Sales",
  "Support",
] as const;

export type UserDepartmentOption = (typeof USER_DEPARTMENT_OPTIONS)[number];

/** Options for a department `<select>`, preserving any legacy custom value. */
export function departmentSelectOptions(current?: string | null): string[] {
  const opts: string[] = [...USER_DEPARTMENT_OPTIONS];
  const cur = current?.trim();
  if (cur && !opts.includes(cur)) opts.unshift(cur);
  return opts;
}
