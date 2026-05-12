/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the SPA from /sutra-reader/. Deep links land on the
// server, which only knows about index.html — emit a 404.html clone so any
// unmatched path falls back to the React Router on the client.
function spaFallback(): Plugin {
  return {
    name: "spa-404-fallback",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index && index.type === "asset") {
        this.emitFile({
          type: "asset",
          fileName: "404.html",
          source: index.source,
        });
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? (process.env.VITE_BASE_PATH ?? "/sutra-reader/") : "/",
  plugins: [
    react(),
    spaFallback(),
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
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/cbeta-org\/xml-p5\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "cbeta-xml",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /\/(?:sutra-reader\/)?catalog\/.*\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "catalog-shards",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/(?:sutra-reader\/)?manifest\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "source-manifest",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
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
}));
