import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(__dirname, '.env.e2e') });

const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const target = process.env.E2E_TARGET ?? 'dev';

if (!process.env.E2E_DATABASE_URL) {
  throw new Error('E2E_DATABASE_URL is not set — copy .env.e2e.example to .env.e2e and fill it in.');
}

// The spawned Next.js server gets its OWN environment, pointed explicitly at
// the isolated E2E database — never the app's normal DATABASE_URL — and with
// the dev-fallback flag deliberately absent (Part 10: "no dev fallback is
// active" in a production-like run).
const serverEnv: Record<string, string> = {
  ...process.env as Record<string, string>,
  DATABASE_URL: process.env.E2E_DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? '',
  PORT: String(PORT),
  // Sprint 18 — deterministic Ctgb/PDOK fixtures for the whole E2E run
  // (the brief: "do not make the normal test suite dependent on live
  // government services"). Ctgb's real API returned 403 during this
  // sprint's own research, so mocking here is the only way to exercise a
  // genuine success path at all, not just a preference for stability.
  E2E_MOCK_CTGB: 'true',
  E2E_MOCK_PDOK: 'true',
  // Sprint 18 Final E2E Stabilization Part 7 — src/instrumentation.ts fails
  // startup if a production-mode server (NODE_ENV=production, which
  // `next start` sets on its own for the E2E_TARGET=build run) is configured
  // with Clerk test-mode keys. This E2E run deliberately uses test-mode
  // keys, so it marks its own spawned server to exempt it from that check.
  E2E_RUN: 'true',
  // Sprint 26: blocking CI never calls a paid/live model. The deterministic
  // provider still exercises schema validation, persistence and UI wiring.
  AI_PROVIDER_MODE: 'deterministic_test',
};
delete serverEnv.ALLOW_DEV_FARM_FALLBACK;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Real Postgres + real Clerk backend calls in global setup, plus a single
  // shared database across the whole run — reliability over parallel speed
  // for this first harness. Revisit once tests prove stable.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.spec\.ts/,
      testIgnore: /mobile\//,
      dependencies: ['setup'],
    },
    {
      name: 'mobile-iphone12',
      use: { ...devices['iPhone 12'] },
      testDir: './e2e/mobile',
      dependencies: ['setup'],
    },
    {
      name: 'mobile-iphone14promax',
      use: { ...devices['iPhone 14 Pro Max'] },
      testDir: './e2e/mobile',
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: target === 'build' ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: serverEnv,
    timeout: 120_000,
  },
});
