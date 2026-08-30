import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    exclude: ["e2e/**"]
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src")
    }
  }
});
