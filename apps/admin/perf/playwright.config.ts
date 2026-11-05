import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import appConfig from '../playwright.config';

// Playwright defaults webServer.cwd to this config's directory (perf/).
// Keep the inherited build/preview commands rooted at apps/admin instead.
const inheritedServer = appConfig.webServer;
if (!inheritedServer || Array.isArray(inheritedServer)) {
  throw new Error('Expected a single MarkMap admin preview web server.');
}

/** Manual diagnostic suite; never runs as part of the default E2E testDir. */
export default defineConfig(appConfig, {
  testDir: '.',
  testMatch: '**/*.perf.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  webServer: {
    ...inheritedServer,
    cwd: fileURLToPath(new URL('../', import.meta.url)),
  },
  projects: [
    { name: 'chromium-emulated', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-emulated', use: { ...devices['Desktop Safari'] } },
  ],
});
