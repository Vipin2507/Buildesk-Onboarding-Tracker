/** Email used for CRM automation / executive notifications (falls back to login email). */
export function resolveUserWorkEmail(user?: {
  email?: string | null;
  workEmail?: string | null;
}): string | undefined {
  if (!user) return undefined;
  const work = user.workEmail?.trim();
  if (work) return work.toLowerCase();
  const login = user.email?.trim();
  return login ? login.toLowerCase() : undefined;
}
