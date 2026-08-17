import type { Employee, User } from "@/types";

/** Active ERP login users available for onboarding-manager / assignee dropdowns. */
export function assignableManagerUsers(users: User[]) {
  return [...users]
    .filter((u) => u.active && u.productScope !== "crm")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve display name for onboardingManagerId / csmId.
 * Prefers users (current source of truth), falls back to employees for legacy IDs.
 */
export function resolveAssigneeName(
  id: string | undefined | null,
  users: User[],
  employees: Employee[] = [],
) {
  if (!id) return undefined;
  const user = users.find((u) => u.id === id);
  if (user) return user.name;
  const employee = employees.find((e) => e.id === id);
  return employee?.name;
}

export function resolveAssigneeLabel(
  id: string | undefined | null,
  users: User[],
  employees: Employee[] = [],
) {
  return resolveAssigneeName(id, users, employees) ?? "—";
}
