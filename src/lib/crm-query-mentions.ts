import { crmSalesManagerNamesMatch, normalizeCrmManagerLabel } from "@/lib/crm-account-access";

export type CrmQueryMentionCandidate = {
  id: string;
  name: string;
};

/**
 * Fallback display-only regex: at most 4 name words, then stop.
 * Prefer candidate-based matching via {@link findCrmQueryMentionMatches}.
 */
const MENTION_REGEX =
  /@([A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Za-z][A-Za-z0-9_-]*){0,3})(?=$|[\s,.!?;:')"])/g;

export type CrmQueryMentionMatch = {
  start: number;
  end: number;
  token: string;
  userId: string;
  userName: string;
};

/** True when `@` at index is a mention start (start of string or whitespace before). */
function isMentionAt(body: string, index: number) {
  if (body[index] !== "@") return false;
  if (index === 0) return true;
  return /\s/.test(body[index - 1] ?? "");
}

function namesEqual(a: string, b: string) {
  return normalizeCrmManagerLabel(a) === normalizeCrmManagerLabel(b);
}

/**
 * Resolve @mentions by longest known candidate name after `@`.
 * Avoids `@Vipin Tomar please check` swallowing the whole sentence as one token.
 */
export function findCrmQueryMentionMatches(
  body: string,
  candidates: CrmQueryMentionCandidate[],
): CrmQueryMentionMatch[] {
  if (!body || !candidates.length) return [];

  const ranked = [...candidates]
    .map((c) => ({ ...c, name: c.name.trim() }))
    .filter((c) => c.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name));

  const matches: CrmQueryMentionMatch[] = [];
  let i = 0;
  while (i < body.length) {
    if (!isMentionAt(body, i)) {
      i += 1;
      continue;
    }

    const rest = body.slice(i + 1);
    let token = "";
    let hit: CrmQueryMentionCandidate | null = null;

    for (const candidate of ranked) {
      const name = candidate.name;
      if (rest.length < name.length) continue;
      const slice = rest.slice(0, name.length);
      if (!namesEqual(slice, name)) continue;
      const next = rest[name.length] ?? "";
      if (next && /[A-Za-z0-9_-]/.test(next)) continue;
      hit = candidate;
      token = slice;
      break;
    }

    if (!hit) {
      // First-name fallback when unique among candidates (e.g. `@Vipin please…`).
      const firstWord = /^[A-Za-z][A-Za-z0-9_-]*/.exec(rest)?.[0];
      if (firstWord) {
        const firstHits = ranked.filter((c) => {
          const first = c.name.split(/\s+/)[0] ?? "";
          return namesEqual(first, firstWord);
        });
        const next = rest[firstWord.length] ?? "";
        if (firstHits.length === 1 && (!next || !/[A-Za-z0-9_-]/.test(next))) {
          hit = firstHits[0]!;
          token = firstWord;
        }
      }
    }

    if (!hit || !token) {
      i += 1;
      continue;
    }

    const end = i + 1 + token.length;
    matches.push({
      start: i,
      end,
      token,
      userId: hit.id,
      userName: hit.name,
    });
    i = end;
  }

  return matches;
}

export function extractCrmQueryMentionTokens(
  body: string,
  candidates?: CrmQueryMentionCandidate[],
): string[] {
  if (candidates?.length) {
    return findCrmQueryMentionMatches(body, candidates).map((m) => m.token);
  }
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
  const matches = findCrmQueryMentionMatches(body, candidates);
  if (matches.length) {
    return [...new Set(matches.map((m) => m.userId))];
  }
  // Legacy fallback for odd tokens if candidate scan missed.
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

export function splitCrmQueryMessageMentions(
  body: string,
  candidates?: CrmQueryMentionCandidate[],
): CrmQueryMessagePart[] {
  if (candidates?.length) {
    const matches = findCrmQueryMentionMatches(body, candidates);
    if (!matches.length) return [{ type: "text", text: body }];
    const parts: CrmQueryMessagePart[] = [];
    let lastIndex = 0;
    for (const match of matches) {
      if (match.start > lastIndex) {
        parts.push({ type: "text", text: body.slice(lastIndex, match.start) });
      }
      parts.push({ type: "mention", text: match.token });
      lastIndex = match.end;
    }
    if (lastIndex < body.length) {
      parts.push({ type: "text", text: body.slice(lastIndex) });
    }
    return parts.length ? parts : [{ type: "text", text: body }];
  }

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
