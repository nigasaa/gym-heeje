import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30000,
  },
  outputDir: "../../work/e2e-results",
  reporter: [["line"], ["json", { outputFile: "../../work/e2e-report.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "edge-mobile-size",
      use: {
        browserName: "chromium",
        channel: process.env.CI ? undefined : "msedge",
      },
    },
    { name: "webkit-mobile-size", use: { browserName: "webkit" } },
  ],
});
