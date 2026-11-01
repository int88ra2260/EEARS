import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.browser.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: './test-results',
  use: {
    baseURL: 'http://127.0.0.1:3017',
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npx vite --config vite.analyticsBrowser.config.js --host 127.0.0.1 --port 3017 --strictPort',
    url: 'http://127.0.0.1:3017/browser-tests/index.html',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
