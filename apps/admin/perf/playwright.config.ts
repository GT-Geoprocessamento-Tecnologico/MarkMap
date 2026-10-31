import { defineConfig, devices } from '@playwright/test';
import appConfig from '../playwright.config';

/** Manual diagnostic suite; never runs as part of the default E2E testDir. */
export default defineConfig(appConfig, {
  testDir: '.',
  testMatch: '**/*.perf.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: [
    { name: 'chromium-emulated', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-emulated', use: { ...devices['Desktop Safari'] } },
  ],
});
