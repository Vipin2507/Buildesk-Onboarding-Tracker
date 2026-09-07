/** Browser stub — real DB access exists only on the server. */
export function getProjectRoot() {
  return "";
}

export function resolveDbPath() {
  return "";
}

export function getSqlite(): never {
  throw new Error("SQLite is only available on the server");
}

export function getDb(): never {
  throw new Error("Database is only available on the server");
}

export type Db = never;
