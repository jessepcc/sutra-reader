/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const CBETA_UPSTREAM = "https://cbdata.dila.edu.tw";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.svg"],
      manifest: {
        name: "經閣 Sutra Reader",
        short_name: "經閣",
        description:
          "經閣 / Sutra Reader — a mobile-first reader for the CBETA Chinese Buddhist canon.",
        theme_color: "#1a1a1a",
        background_color: "#f4f1ea",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/enso-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "icons/enso-512.svg", sizes: "512x512", type: "image/svg+xml" },
          {
            src: "icons/enso-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // Don't intercept the CF Pages Function path during SW navigations.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Per-juan API responses are large and stable per CBETA release.
            urlPattern: /\/api\/cbeta\/juans\b/,
            handler: "CacheFirst",
            options: {
              cacheName: "cbeta-juans",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Other CBETA API calls (search, toc) — prefer network for freshness.
            urlPattern: /\/api\/cbeta\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "cbeta-api",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/catalog\/.*\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "catalog-shards",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // Match what the deployed Pages Function does, so app code is identical
      // in dev and prod. Rewrite /api/cbeta → /stable on the upstream.
      "/api/cbeta": {
        target: CBETA_UPSTREAM,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cbeta/, "/stable"),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/types.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
