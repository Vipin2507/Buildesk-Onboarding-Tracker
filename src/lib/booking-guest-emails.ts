import { isValidEmail } from "@/lib/utils";

export function parseAdditionalGuestEmailsJson(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

export function serializeAdditionalGuestEmails(emails: string[] | undefined): string {
  const list = (emails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  return JSON.stringify(list);
}

/** Dedupe additional emails and exclude the primary guest email. */
export function normalizeAdditionalGuestEmails(primaryEmail: string, additional: string[]): string[] {
  const primary = primaryEmail.trim().toLowerCase();
  const seen = new Set(primary ? [primary] : []);
  const out: string[] = [];
  for (const raw of additional) {
    const email = raw.trim().toLowerCase();
    if (!email || !isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function allGuestEmails(input: {
  guestEmail: string;
  additionalGuestEmails?: string[];
}): string[] {
  const primary = input.guestEmail.trim().toLowerCase();
  const additional = normalizeAdditionalGuestEmails(primary, input.additionalGuestEmails ?? []);
  return primary ? [primary, ...additional] : additional;
}

export function formatGuestEmailsLabel(input: {
  guestEmail: string;
  additionalGuestEmails?: string[];
}): string {
  return allGuestEmails(input).join(", ");
}
