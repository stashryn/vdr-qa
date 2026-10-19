import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'api', testDir: './tests/api', use: { baseURL: process.env.API_URL } },
    { name: 'e2e', testDir: './tests/e2e', use: { baseURL: process.env.WEB_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' } },
  ],
});
