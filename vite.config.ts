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
