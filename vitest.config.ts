import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: process.env.DATABASE_URL ? ["tests/support/global-db.ts"] : [],
    testTimeout: 20000,
    fileParallelism: false,
    coverage: {
      provider: "v8", reporter: ["text-summary", "json-summary", "html"], reportsDirectory: "qa/reports/coverage",
      // Core business logic. db.ts, session.ts and track.ts need the Next.js runtime and are exercised by the browser tests instead.
      include: ["src/lib/**/*.ts"], exclude: ["src/lib/db.ts", "src/lib/session.ts", "src/lib/track.ts", "src/lib/format.ts"],
    },
  },
});
