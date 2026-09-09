import { isSameCrmAccountIdentity, type CrmAccountIdentityHints } from "@/lib/portal-slug-identity";
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

function pickOwnerLabel(...candidates: (string | undefined | null)[]) {
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function resolvePortalSlugOwner(
  portals: CompanyPortalAccess[],
  companyId: string,
  fallbackName?: string,
  getAccount?: (id: string) => { name: string; userId?: string | null } | undefined,
): PortalSlugOwner {
  const portal = portals.find((p) => p.companyId === companyId);
  const account = getAccount?.(companyId);
  const companyName =
    pickOwnerLabel(account?.name, portal?.companyName, fallbackName, portal?.contactName) ??
    `account ${companyId.slice(0, 8)}…`;
  return {
    companyId,
    companyName,
    clientId: account?.userId ?? undefined,
  };
}

export function findPortalSlugConflictMessage(
  portals: CompanyPortalAccess[],
  slug: string,
  excludeCompanyId: string,
  getAccount?: (id: string) => { name: string; userId?: string | null } | undefined,
  targetHints?: Pick<CrmAccountIdentityHints, "targetCompanyName" | "targetClientId">,
): string | null {
  const taken = portals.find((p) => p.slug === slug && p.companyId !== excludeCompanyId);
  if (!taken) return null;
  if (
    isSameCrmAccountIdentity(taken.companyId, excludeCompanyId, getAccount, {
      ownerPortalCompanyName: taken.companyName,
      targetCompanyName:
        targetHints?.targetCompanyName ?? getAccount?.(excludeCompanyId)?.name,
      targetClientId: targetHints?.targetClientId ?? getAccount?.(excludeCompanyId)?.userId,
    })
  ) {
    return null;
  }
  const owner = resolvePortalSlugOwner(portals, taken.companyId, taken.companyName, getAccount);
  return formatPortalSlugInUseMessage(slug, owner);
}
