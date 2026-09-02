import { crmSalesManagerNamesMatch, normalizeCrmManagerLabel } from "@/lib/crm-account-access";

export type CrmQueryMentionCandidate = {
  id: string;
  name: string;
};

/** Matches @First or @First Last style mentions in message text. */
const MENTION_REGEX = /@([A-Za-z][A-Za-z0-9._-]*(?:\s+[A-Za-z][A-Za-z0-9._-]*)*)/g;

export function extractCrmQueryMentionTokens(body: string): string[] {
  const tokens: string[] = [];
  for (const match of body.matchAll(MENTION_REGEX)) {
    const token = match[1]?.trim();
    if (token) tokens.push(token);
  }
  return tokens;
}

export function mentionMatchesUser(token: string, userName: string): boolean {
  const t = normalizeCrmManagerLabel(token);
  const n = normalizeCrmManagerLabel(userName);
  if (!t || !n) return false;
  if (t === n) return true;
  if (n.startsWith(`${t} `)) return true;
  if (t.replace(/\s+/g, "") === n.replace(/\s+/g, "")) return true;
  const first = userName.trim().split(/\s+/)[0];
  if (first && normalizeCrmManagerLabel(first) === t) return true;
  return crmSalesManagerNamesMatch(userName, token);
}

export function resolveCrmQueryMentionUserIds(
  body: string,
  candidates: CrmQueryMentionCandidate[],
): string[] {
  const tokens = extractCrmQueryMentionTokens(body);
  const ids = new Set<string>();
  for (const token of tokens) {
    const match = candidates.find((c) => mentionMatchesUser(token, c.name));
    if (match) ids.add(match.id);
  }
  return [...ids];
}

export type CrmQueryMentionContext = {
  query: string;
  start: number;
};

/** Active @-mention being typed at the cursor (for autocomplete). */
export function getCrmQueryMentionContext(
  value: string,
  cursor: number,
): CrmQueryMentionContext | null {
  const before = value.slice(0, cursor);
  const match = /(?:^|\s)@([A-Za-z0-9._-]*)$/.exec(before);
  if (!match) return null;
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;
  return { query: match[1] ?? "", start: atIndex };
}

export function applyCrmQueryMention(
  value: string,
  start: number,
  cursor: number,
  userName: string,
): { value: string; cursor: number } {
  const before = value.slice(0, start);
  const after = value.slice(cursor);
  const mention = `@${userName} `;
  return {
    value: `${before}${mention}${after}`,
    cursor: before.length + mention.length,
  };
}

export function filterCrmQueryMentionCandidates(
  candidates: CrmQueryMentionCandidate[],
  query: string,
  excludeUserId?: string,
): CrmQueryMentionCandidate[] {
  const q = query.trim().toLowerCase();
  return candidates
    .filter((c) => c.id !== excludeUserId)
    .filter((c) => {
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    })
    .slice(0, 8);
}

export type CrmQueryMessagePart =
  | { type: "text"; text: string }
  | { type: "mention"; text: string };

export function splitCrmQueryMessageMentions(body: string): CrmQueryMessagePart[] {
  const parts: CrmQueryMessagePart[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", text: body.slice(lastIndex, index) });
    }
    parts.push({ type: "mention", text: match[1] ?? "" });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push({ type: "text", text: body.slice(lastIndex) });
  }
  return parts.length ? parts : [{ type: "text", text: body }];
}
