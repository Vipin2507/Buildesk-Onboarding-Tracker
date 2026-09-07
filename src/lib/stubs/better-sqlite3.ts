/** Browser stub for the native better-sqlite3 module. */
class Database {
  constructor(_path?: string, _options?: unknown) {
    throw new Error("better-sqlite3 is only available on the server");
  }
}

export default Database;
