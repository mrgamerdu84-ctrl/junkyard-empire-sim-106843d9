import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Vitest standalone config (n'affecte pas le build Vite/TanStack).
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
