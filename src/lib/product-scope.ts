import type { ProductScope, User } from "@/types/user";

export function isCrmUser(user: Pick<User, "productScope"> | null | undefined): boolean {
  return user?.productScope === "crm";
}

export function homePathForUser(user: Pick<User, "productScope"> | null | undefined): "/" | "/crm" {
  return isCrmUser(user) ? "/crm" : "/";
}

export function productScopeOf(user: Pick<User, "productScope"> | null | undefined): ProductScope {
  return user?.productScope === "crm" ? "crm" : "erp";
}
