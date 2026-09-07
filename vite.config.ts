import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Keep native SQLite off the browser bundle (TanStack Start still analyzes server imports on the client). */
function stubServerDbForClient(): Plugin {
  const dbClientStub = path.resolve(root, "src/server/db/client.stub.ts");
  const betterSqlite3Stub = path.resolve(root, "src/lib/stubs/better-sqlite3.ts");
  const drizzleBetterSqlite3Stub = path.resolve(root, "src/lib/stubs/drizzle-better-sqlite3.ts");

  const isBetterSqlite3 = (source: string) =>
    source === "better-sqlite3" ||
    source.startsWith("better-sqlite3/") ||
    /(?:^|\/)node_modules\/better-sqlite3(?:\/|$)/.test(source);

  const isDrizzleBetterSqlite3 = (source: string) =>
    source === "drizzle-orm/better-sqlite3" ||
    source.startsWith("drizzle-orm/better-sqlite3/") ||
    /(?:^|\/)node_modules\/drizzle-orm\/better-sqlite3(?:\/|$)/.test(source);

  const isDbClient = (source: string) =>
    source === "@/server/db/client" ||
    /(?:^|\/)server\/db\/client(?:\.ts)?$/.test(source);

  return {
    name: "stub-server-db-for-client",
    enforce: "pre",
    resolveId(source, _importer, options) {
      if (options?.ssr) return null;
      if (isBetterSqlite3(source)) return betterSqlite3Stub;
      if (isDrizzleBetterSqlite3(source)) return drizzleBetterSqlite3Stub;
      if (isDbClient(source)) return dbClientStub;
      return null;
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    proxy: {
      "/n8n": {
        target: "http://72.60.200.185:5678",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n/, ""),
      },
      "/waha": {
        target: "http://72.60.200.185:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/waha/, ""),
      },
    },
  },
  // Downlevel modern syntax (?. , ?? , #private) so production
  // bundles don't throw "Unexpected token '.'" in older browsers / WebViews.
  build: {
    target: "es2019",
    cssTarget: "chrome80",
  },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-hook-form",
      "@hookform/resolvers/zod",
      "zustand",
      "zustand/middleware",
    ],
    exclude: ["better-sqlite3", "drizzle-orm/better-sqlite3"],
  },
  ssr: {
    external: ["better-sqlite3"],
  },
  plugins: [
    stubServerDbForClient(),
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro({
      preset: "node-server",
    }),
    viteReact(),
    tailwindcss(),
  ],
});
