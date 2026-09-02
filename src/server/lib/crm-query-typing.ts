/** Ephemeral in-memory typing indicators per query thread (single-node SQLite deploy). */

const TYPING_TTL_MS = 5_000;

type TypingEntry = {
  userId: string;
  userName: string;
  expiresAt: number;
};

const typingByQuery = new Map<string, Map<string, TypingEntry>>();

function pruneQuery(queryId: string, now = Date.now()) {
  const map = typingByQuery.get(queryId);
  if (!map) return;
  for (const [userId, entry] of map) {
    if (entry.expiresAt <= now) map.delete(userId);
  }
  if (map.size === 0) typingByQuery.delete(queryId);
}

export function setCrmQueryTyping(
  queryId: string,
  userId: string,
  userName: string,
  typing: boolean,
) {
  const now = Date.now();
  pruneQuery(queryId, now);
  if (!typing) {
    typingByQuery.get(queryId)?.delete(userId);
    pruneQuery(queryId, now);
    return;
  }
  let map = typingByQuery.get(queryId);
  if (!map) {
    map = new Map();
    typingByQuery.set(queryId, map);
  }
  map.set(userId, {
    userId,
    userName,
    expiresAt: now + TYPING_TTL_MS,
  });
}

export function getCrmQueryTypingUsers(queryId: string, excludeUserId?: string) {
  const now = Date.now();
  pruneQuery(queryId, now);
  const map = typingByQuery.get(queryId);
  if (!map) return [];
  return [...map.values()]
    .filter((entry) => entry.userId !== excludeUserId)
    .map((entry) => ({ userId: entry.userId, userName: entry.userName }));
}
