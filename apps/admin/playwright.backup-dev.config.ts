import { defineConfig, devices } from '@playwright/test';

// This isolated server uses a synthetic endpoint; the test intercepts every sync request.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'backup-concurrency.spec.ts',
  timeout: 60_000,
  use: { baseURL: 'https://127.0.0.1:5183', ignoreHTTPSErrors: true },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 5183 --strictPort',
    url: 'https://127.0.0.1:5183',
    env: { VITE_API_MODE: 'live', VITE_API_URL: '/synthetic-api' },
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
