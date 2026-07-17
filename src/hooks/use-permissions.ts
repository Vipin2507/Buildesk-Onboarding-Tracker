import { useCallback, useMemo } from "react";

import { findRoleByKey, isAdminRoleKey, roleHasPermission } from "@/lib/permissions";
import { useAuthStore, useSettingsStore } from "@/stores";
import type { RoleDefinition, RolePermissionKey } from "@/types";

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const roles = useSettingsStore((s) => s.roles);

  const roleDef = useMemo(
    () => findRoleByKey(roles, user?.role) ?? findRoleByKey(roles, "Viewer"),
    [roles, user?.role],
  );

  const isAdmin = isAdminRoleKey(user?.role);

  const can = useCallback(
    (permission: RolePermissionKey) => {
      if (isAdmin) return true;
      return roleHasPermission(roles, user?.role, permission);
    },
    [isAdmin, roles, user?.role],
  );

  const canAccessAdministration = isAdmin || can("manageMaster") || can("manageRoles");

  return {
    user,
    roles,
    roleDef,
    isAdmin,
    can,
    canAccessAdministration,
  };
}

export function useRoleDefinition(roleKey: string | undefined): RoleDefinition | undefined {
  const roles = useSettingsStore((s) => s.roles);
  return useMemo(() => findRoleByKey(roles, roleKey), [roles, roleKey]);
}
