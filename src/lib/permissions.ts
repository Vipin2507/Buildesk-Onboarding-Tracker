import { newId, nowIso } from "@/types";
import type {
  RoleDefinition,
  RolePermissionKey,
  RolePermissionMap,
  RolePermissions,
} from "@/types/settings";
import {
  ADMIN_LOCKED_PERMISSIONS,
  ALL_PERMISSION_KEYS,
} from "@/types/settings";

export function emptyPermissions(all = false): RolePermissionMap {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, all])) as RolePermissionMap;
}

export function defaultPermissionMap(
  overrides: Partial<RolePermissionMap> = {},
): RolePermissionMap {
  return { ...emptyPermissions(false), ...overrides };
}

export function slugifyRoleKey(name: string, existing: string[]): string {
  let base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "role";
  let key = base;
  let n = 2;
  while (existing.includes(key)) {
    key = `${base}-${n++}`;
  }
  return key;
}

function roleFromMap(
  key: string,
  name: string,
  isSystem: boolean,
  permissions: RolePermissionMap,
  description?: string,
): RoleDefinition {
  const now = nowIso();
  return {
    id: newId(),
    key,
    name,
    description,
    isSystem,
    permissions: normalizeAdminPermissions(key, permissions),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeAdminPermissions(
  roleKey: string,
  permissions: RolePermissionMap,
): RolePermissionMap {
  if (roleKey !== "Admin") return permissions;
  const next = { ...permissions };
  for (const key of ADMIN_LOCKED_PERMISSIONS) {
    next[key] = true;
  }
  return next;
}

export const DEFAULT_ROLES: RoleDefinition[] = [
  roleFromMap(
    "Admin",
    "Administrator",
    true,
    defaultPermissionMap({
      manageCompanies: true,
      manageProjects: true,
      approvePostSales: true,
      manageTickets: true,
      viewReports: true,
      manageEmployees: true,
      manageMaster: true,
      manageUsers: true,
      manageSettings: true,
      manageRoles: true,
    }),
    "Full platform access including administration",
  ),
  roleFromMap(
    "Manager",
    "Manager",
    true,
    defaultPermissionMap({
      manageCompanies: true,
      manageProjects: true,
      approvePostSales: false,
      manageTickets: true,
      viewReports: true,
      manageEmployees: true,
    }),
    "Onboarding leads — operations without admin controls",
  ),
  roleFromMap(
    "Viewer",
    "Viewer",
    true,
    defaultPermissionMap({
      viewReports: true,
    }),
    "Read-only access to reports and dashboards",
  ),
];

/** Migrate legacy permissions matrix into role definitions. */
export function rolesFromLegacyPermissions(legacy?: RolePermissions): RoleDefinition[] {
  if (!legacy) return DEFAULT_ROLES.map((r) => ({ ...r, permissions: { ...r.permissions } }));
  const now = nowIso();
  return (["Admin", "Manager", "Viewer"] as const).map((key) => {
    const seed = DEFAULT_ROLES.find((r) => r.key === key)!;
    const legacyMap = legacy[key] ?? seed.permissions;
    const permissions = defaultPermissionMap({
      ...legacyMap,
      manageEmployees: legacyMap.manageEmployees ?? seed.permissions.manageEmployees,
      manageRoles: legacyMap.manageRoles ?? seed.permissions.manageRoles,
    });
    return {
      ...seed,
      permissions: normalizeAdminPermissions(key, permissions),
      updatedAt: now,
    };
  });
}

export function findRoleByKey(roles: RoleDefinition[], key: string | undefined) {
  if (!key) return undefined;
  return roles.find((r) => r.key === key);
}

export function roleHasPermission(
  roles: RoleDefinition[],
  roleKey: string | undefined,
  permission: RolePermissionKey,
) {
  if (roleKey === "Admin") return true;
  const role = findRoleByKey(roles, roleKey);
  return Boolean(role?.permissions[permission]);
}

export function isAdminRoleKey(roleKey: string | undefined) {
  return roleKey === "Admin";
}

export function countEnabledPermissions(permissions: RolePermissionMap) {
  return ALL_PERMISSION_KEYS.filter((k) => permissions[k]).length;
}
