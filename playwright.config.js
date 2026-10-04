import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:3384', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testIgnore: '**/layout.spec.js', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testIgnore: '**/layout.spec.js', use: { viewport: { width: 390, height: 844 } } },
    { name: 'compact', testMatch: '**/layout.spec.js', use: { viewport: { width: 320, height: 740 } } },
  ],
  webServer: { command: 'node scripts/browser-server.mjs', url: 'http://127.0.0.1:3384/health', reuseExistingServer: false },
});
