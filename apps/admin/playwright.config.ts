import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60 * 1000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: true,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "pnpm build && pnpm preview --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    env: { VITE_API_MODE: "mock", VITE_API_URL: "/api/v1" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "iphone-13",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
