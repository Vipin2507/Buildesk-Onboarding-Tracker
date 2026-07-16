import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    strictPort: true,
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
    exclude: ["better-sqlite3"],
  },
  ssr: {
    external: ["better-sqlite3"],
  },
  plugins: [
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
