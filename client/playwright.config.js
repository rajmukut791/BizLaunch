import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
process.env.BIZLAUNCH_E2E_DB ||= 'bizlaunch_e2e_' + randomUUID().replaceAll('-', '');
export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  reporter: 'list',
  globalSetup: './tests/setup.cjs',
  globalTeardown: './tests/cleanup.cjs',
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
