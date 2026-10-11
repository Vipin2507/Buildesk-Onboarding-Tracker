/**
 * Pick one primary recipient (prefer admin) and put everyone else in CC
 * so internal-team email automation sends a single message.
 */
export type InternalTeamEmailPerson = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isAdmin?: boolean;
};

export function pickInternalTeamEmailTargets(
  people: InternalTeamEmailPerson[],
): { to: InternalTeamEmailPerson; ccEmails: string[] } | null {
  const withEmail = people.filter((p) => Boolean(p.email?.trim()));
  if (withEmail.length === 0) return null;

  const admins = withEmail.filter((p) => p.isAdmin);
  const to = admins[0] ?? withEmail[0]!;
  const toKey = to.email.trim().toLowerCase();
  const ccEmails = withEmail
    .filter((p) => p.email.trim().toLowerCase() !== toKey)
    .map((p) => p.email.trim());

  return { to, ccEmails };
}
