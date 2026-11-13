import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.QA_PORT ?? 3100);
process.env.DATABASE_URL ??= "postgresql://postgres@localhost:5544/tas_qa";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.AUTH_SECRET ??= "qa-only-secret-not-for-production-0123456789abcdef";

export default defineConfig({
  testDir: "tests/e2e", timeout: 90_000, expect: { timeout: 10_000 }, workers: 1, retries: 0, fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "qa/reports/e2e-results.json" }], ["html", { open: "never", outputFolder: "qa/reports/e2e-html" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure", ...devices["Desktop Chrome"] },
  webServer: { command: "node tests/support/boot.mjs", url: `http://localhost:${PORT}/api/health`, timeout: 360_000, reuseExistingServer: !process.env.CI, stdout: "ignore" },
});
