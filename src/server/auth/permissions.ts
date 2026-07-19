import { eq } from "drizzle-orm";

import {
  DEFAULT_ROLES,
  roleHasPermission,
  rolesFromLegacyPermissions,
} from "@/lib/permissions";
import { ApiError, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";
import type { RoleDefinition, RolePermissionKey, RolePermissions, User } from "@/types";

/** Load role definitions from app settings JSON (same source as client). */
export function loadServerRoles(): RoleDefinition[] {
  try {
    const row = getDb().select().from(t.appConfig).where(eq(t.appConfig.key, "settings")).get();
    if (!row?.valueJson) return DEFAULT_ROLES.map((r) => ({ ...r, permissions: { ...r.permissions } }));
    const parsed = JSON.parse(row.valueJson) as {
      roles?: RoleDefinition[];
      permissions?: RolePermissions;
    };
    if (Array.isArray(parsed.roles) && parsed.roles.length > 0) {
      return parsed.roles;
    }
    if (parsed.permissions) {
      return rolesFromLegacyPermissions(parsed.permissions);
    }
  } catch {
    // Missing/invalid settings — use defaults so Admin/Manager still work.
  }
  return DEFAULT_ROLES.map((r) => ({ ...r, permissions: { ...r.permissions } }));
}

/**
 * Server-side permission gate aligned with client `usePermissions().can`.
 * Admin always passes. Falls back to Manager defaults when settings are missing
 * so hard-coded Admin/Manager CRM mutations stay compatible during rollout.
 */
export function requirePermission(permission: RolePermissionKey): User {
  const user = requireUser();
  if (user.role === "Admin") return user;

  const roles = loadServerRoles();
  if (roleHasPermission(roles, user.role, permission)) {
    return user;
  }

  throw new ApiError(403, "You do not have permission for this action");
}

export function requireActiveUserId(userId: string | null | undefined, label = "User") {
  if (!userId) return;
  const row = getDb().select().from(t.users).where(eq(t.users.id, userId)).get();
  if (!row || !row.active) {
    throw new ApiError(400, `${label} must be an active login user`);
  }
}
