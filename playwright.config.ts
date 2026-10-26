import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run a real API (on the docker test database, Redis DB 4) and the dashboard dev
// server on their own ports, so they never touch dev data or a running `npm run dev`.
const API_PORT = 4020;
// Its own database: the Vitest suites truncate flagflow_test, which would break an e2e run alongside them.
const E2E_DATABASE_URL = 'postgresql://flagflow:flagflow@localhost:5432/flagflow_e2e';
// The shared global setup migrates whatever TEST_DATABASE_URL names.
process.env.TEST_DATABASE_URL = E2E_DATABASE_URL;
const DASHBOARD_PORT = 5180;
export const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;
// The demo customer app (phase 8). demo-web runs here; the demo spec starts demo-api itself, because it
// needs an API key that only exists once the test has registered an org.
export const API_URL = `http://localhost:${API_PORT}`;
export const DEMO_API_PORT = 4120;
const DEMO_WEB_PORT = 5190;
export const DEMO_WEB_URL = `http://localhost:${DEMO_WEB_PORT}`;

// E2E_BASE_URL runs the specs against a deployed build instead (DEPLOY.md): no local servers or test DB.
const DEPLOYED = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  ...(!DEPLOYED && { globalSetup: './apps/api/src/test/global-setup.ts' }),
  use: {
    baseURL: DEPLOYED ?? DASHBOARD_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true },
    },
  ],
  webServer: DEPLOYED
    ? []
    : [
        {
          command: 'node node_modules/tsx/dist/cli.mjs apps/api/src/index.ts',
          url: `http://localhost:${API_PORT}/api/health`,
          reuseExistingServer: false,
          timeout: 60_000,
          env: {
            NODE_ENV: 'test',
            LOG_LEVEL: 'warn',
            PORT: String(API_PORT),
            DATABASE_URL: E2E_DATABASE_URL,
            REDIS_URL: 'redis://localhost:6379/4',
            JWT_ACCESS_SECRET: 'e2e-only-secret-'.padEnd(64, 'e'),
            DASHBOARD_ORIGIN: DASHBOARD_URL,
            SMTP_URL: 'smtp://localhost:1025',
            MAIL_FROM: 'FlagFlow <no-reply@flagflow.local>',
            // Each spec registers fresh accounts; the real limits are covered by the API attack suite.
            RATE_LIMIT_SCALE: '20',
          },
        },
        {
          command: 'npm run dev -w apps/dashboard',
          url: DASHBOARD_URL,
          reuseExistingServer: false,
          timeout: 60_000,
          env: { DASHBOARD_PORT: String(DASHBOARD_PORT), VITE_API_URL: `http://localhost:${API_PORT}/api` },
        },
        {
          command: `npm run dev -w apps/demo-web -- --port ${DEMO_WEB_PORT}`,
          url: DEMO_WEB_URL,
          reuseExistingServer: false,
          timeout: 60_000,
          env: {
            VITE_DEMO_API_URL: `http://localhost:${DEMO_API_PORT}`,
            VITE_DASHBOARD_URL: DASHBOARD_URL,
          },
        },
      ],
});
