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

function versionStampPlugin(): Plugin {
  const writeStamp = () => {
    const builtAt = Date.now();
    const buildId = new Date(builtAt).toISOString();
    const payload = JSON.stringify({ buildId, builtAt }, null, 2);
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
    plugins: [versionStampPlugin()],
  },
});
