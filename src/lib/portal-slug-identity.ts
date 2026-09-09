/** Normalize Client ID / userId for stable comparisons across imports and forms. */
export function normalizeClientId(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

export function crmAccountsShareClientId(
  a?: { userId?: string | null },
  b?: { userId?: string | null },
): boolean {
  const left = normalizeClientId(a?.userId);
  const right = normalizeClientId(b?.userId);
  return Boolean(left && right && left === right);
}

/** True when slug owner and target row refer to the same CRM account (incl. stale portal companyId). */
export function isSameCrmAccountIdentity(
  ownerCompanyId: string,
  targetCompanyId: string,
  getAccount?: (companyId: string) => { userId?: string | null } | undefined,
): boolean {
  if (ownerCompanyId === targetCompanyId) return true;
  const owner = getAccount?.(ownerCompanyId);
  const target = getAccount?.(targetCompanyId);
  return crmAccountsShareClientId(owner, target);
}
