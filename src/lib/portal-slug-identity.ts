/** Normalize Client ID / userId for stable comparisons across imports and forms. */
export function normalizeClientId(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

export function normalizeAccountName(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function crmAccountsShareClientId(
  a?: { userId?: string | null },
  b?: { userId?: string | null },
): boolean {
  const left = normalizeClientId(a?.userId);
  const right = normalizeClientId(b?.userId);
  return Boolean(left && right && left === right);
}

export function crmAccountsShareName(
  a?: { name?: string | null },
  b?: { name?: string | null },
): boolean {
  const left = normalizeAccountName(a?.name);
  const right = normalizeAccountName(b?.name);
  return Boolean(left && right && left === right);
}

export type CrmAccountIdentityLookup = (
  companyId: string,
) => { name?: string | null; userId?: string | null } | undefined;

export type CrmAccountIdentityHints = {
  ownerPortalCompanyName?: string | null;
  /** Fallback when the target CRM row is not loaded yet (e.g. async server sync). */
  targetCompanyName?: string | null;
  targetClientId?: string | null;
};

/** True when slug owner and target row refer to the same CRM account (incl. stale portal companyId). */
export function isSameCrmAccountIdentity(
  ownerCompanyId: string,
  targetCompanyId: string,
  getAccount?: CrmAccountIdentityLookup,
  opts?: CrmAccountIdentityHints,
): boolean {
  if (ownerCompanyId === targetCompanyId) return true;

  const owner = getAccount?.(ownerCompanyId);
  const target = getAccount?.(targetCompanyId);
  const targetIdentity = {
    name: target?.name ?? opts?.targetCompanyName,
    userId: target?.userId ?? opts?.targetClientId,
  };

  if (crmAccountsShareClientId(owner, targetIdentity)) return true;
  if (crmAccountsShareName(owner, targetIdentity)) return true;

  const portalName = normalizeAccountName(opts?.ownerPortalCompanyName);
  const targetName = normalizeAccountName(targetIdentity.name);
  if (portalName && targetName && portalName === targetName) return true;

  return false;
}
