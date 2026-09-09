import type { CompanyPortalAccess } from "@/types/design-ticket";

export type PortalSlugOwner = {
  companyId: string;
  companyName: string;
  clientId?: string;
};

/** Human-readable message when a portal API key slug is already assigned. */
export function formatPortalSlugInUseMessage(slug: string, owner: PortalSlugOwner): string {
  const clientPart = owner.clientId?.trim()
    ? ` (Client ID: ${owner.clientId.trim()})`
    : "";
  return `Portal API key "${slug}" is already in use by ${owner.companyName}${clientPart}`;
}

export function resolvePortalSlugOwner(
  portals: CompanyPortalAccess[],
  companyId: string,
  fallbackName?: string,
  getAccount?: (id: string) => { name: string; userId?: string } | undefined,
): PortalSlugOwner {
  const portal = portals.find((p) => p.companyId === companyId);
  const account = getAccount?.(companyId);
  return {
    companyId,
    companyName: account?.name ?? portal?.companyName ?? fallbackName ?? "another account",
    clientId: account?.userId,
  };
}

export function findPortalSlugConflictMessage(
  portals: CompanyPortalAccess[],
  slug: string,
  excludeCompanyId: string,
  getAccount?: (id: string) => { name: string; userId?: string } | undefined,
): string | null {
  const taken = portals.find((p) => p.slug === slug && p.companyId !== excludeCompanyId);
  if (!taken) return null;
  const owner = resolvePortalSlugOwner(portals, taken.companyId, taken.companyName, getAccount);
  return formatPortalSlugInUseMessage(slug, owner);
}
