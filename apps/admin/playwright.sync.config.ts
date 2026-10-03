import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-sync",
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "pnpm build && pnpm preview --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    env: {
      VITE_API_MODE: "live",
      VITE_API_URL: "/api/v1",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    {
      name: "chromium-sync",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
