export function drizzle(): never {
  throw new Error("drizzle/better-sqlite3 is only available on the server");
}

export class BetterSQLite3Database {
  constructor() {
    throw new Error("drizzle/better-sqlite3 is only available on the server");
  }
}
