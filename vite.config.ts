// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Version du jeu - incrémenter à chaque mise à jour majeure
const GAME_VERSION = "1.0.0";

function versionStampPlugin(): Plugin {
  const writeStamp = () => {
    const builtAt = Date.now();
    const buildId = new Date(builtAt).toISOString();
    const payload = JSON.stringify({
      version: GAME_VERSION,
      buildId,
      builtAt,
      changelog: "Mise à jour automatique active",
    }, null, 2);
    try {
      mkdirSync(resolve(process.cwd(), "public"), { recursive: true });
      writeFileSync(resolve(process.cwd(), "public/version.json"), payload);
    } catch {
      // best-effort: don't break the build if we can't write
    }
  };
  return {
    name: "junky-version-stamp",
    config() {
      writeStamp();
    },
    buildStart() {
      writeStamp();
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      versionStampPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // we register from src/lib/registerSW.ts only
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false, // we ship our own /public/manifest.webmanifest
        workbox: {
          // Cache hashed client assets only; HTML is handled by NetworkFirst.
          globPatterns: ["**/*.{js,css,woff2,woff,ttf,otf,png,jpg,jpeg,svg,webp,ico,mp3}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          runtimeCaching: [
            {
              // HTML navigations: always try network first so updates ship fast.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "jce-html",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Same-origin hashed assets.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|ico|mp3)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "jce-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
