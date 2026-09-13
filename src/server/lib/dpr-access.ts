import { roleHasPermission } from "@/lib/permissions";
import { loadServerRoles, requirePermission } from "@/server/auth/permissions";
import { ApiError, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import * as t from "@/server/db/schema";

export function assertCanManageDpr() {
  const user = requireUser();
  if (user.role === "Admin") return user;
  const roles = loadServerRoles();
  if (roleHasPermission(roles, user.role, "manageDpr")) return user;
  throw new ApiError(403, "You do not have permission to manage DPR");
}

export function assertCanViewDprTracker() {
  const user = requireUser();
  if (user.role === "Admin") return user;
  const roles = loadServerRoles();
  if (roleHasPermission(roles, user.role, "viewDprTracker")) return user;
  throw new ApiError(403, "You do not have permission to view the DPR tracker");
}

export function assertCanEditDprEntry(
  row: typeof t.dprEntries.$inferSelect,
  user: ReturnType<typeof requireUser>,
) {
  if (user.role === "Admin") return;
  if (row.executiveId !== user.id) {
    throw new ApiError(403, "You can only edit your own DPR entries");
  }
}

/** Active ERP login users expected to file a DPR (excludes Viewer). */
export function listExpectedDprExecutives(db: ReturnType<typeof getDb> = getDb()) {
  const roles = loadServerRoles();
  return db
    .select()
    .from(t.users)
    .all()
    .filter((u) => {
      if (!u.active) return false;
      if ((u.productScope || "erp") !== "erp") return false;
      if (u.role === "Viewer") return false;
      if (u.role === "Admin") return true;
      return roleHasPermission(roles, u.role, "manageDpr");
    });
}

export function requirePermissionOrAdmin(permission: "manageDpr" | "viewDprTracker") {
  if (permission === "manageDpr") return assertCanManageDpr();
  return assertCanViewDprTracker();
}
