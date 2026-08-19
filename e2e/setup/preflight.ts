import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import net from 'node:net';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { clerkPreflight, formatPreflightFailure } from './clerk-preflight';

/**
 * Standalone E2E preflight (Sprint 25 closure hardening, Part 5). Verifies the
 * environment is ready to run the E2E suite WITHOUT touching data or creating
 * users: safe DB target, Clerk reachable, fixed-pool config present, Playwright
 * browsers installed, and the local port free-or-reusable. Read-only.
 *
 *   npm run test:e2e:preflight
 */

loadEnv({ path: path.resolve(process.cwd(), '.env.e2e') });

const PORT = 3100;
const line = (ok: boolean | 'warn', label: string, note = '') => `  ${ok === true ? 'PASS' : ok === 'warn' ? 'WARN' : 'FAIL'}  ${label}${note ? ` — ${note}` : ''}`;

function checkDbTarget(): boolean {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) { console.log(line(false, 'E2E database target', 'E2E_DATABASE_URL is not set')); return false; }
  let dbName = '';
  try { dbName = new URL(url).pathname.replace(/^\//, ''); } catch { console.log(line(false, 'E2E database target', 'E2E_DATABASE_URL is not a valid connection string')); return false; }
  const safe = /e2e|test/i.test(dbName);
  console.log(line(safe, 'E2E database target', safe ? `"${dbName}" (safe)` : `"${dbName}" does NOT contain "e2e"/"test" — refused`));
  return safe;
}

function checkPoolConfig(): boolean {
  const keys = ['E2E_USER_NEW_EMAIL', 'E2E_USER_READY_EMAIL', 'E2E_USER_OTHER_EMAIL', 'E2E_USER_PILOT_EMAIL'];
  const missing = keys.filter((k) => !process.env[k]);
  console.log(line(missing.length === 0, 'Fixed Clerk pool config', missing.length ? `missing: ${missing.join(', ')}` : '4 identities configured'));
  return missing.length === 0;
}

function checkBrowsers(): boolean {
  try {
    const execPath = chromium.executablePath();
    const installed = Boolean(execPath) && existsSync(execPath);
    console.log(line(installed, 'Playwright browsers', installed ? 'chromium installed' : 'run: npx playwright install chromium'));
    return installed;
  } catch {
    console.log(line(false, 'Playwright browsers', 'chromium executable path could not be resolved'));
    return false;
  }
}

function checkPort(): Promise<void> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: PORT });
    const done = (state: boolean | 'warn', note: string) => { socket.destroy(); console.log(line(state, `Local port ${PORT}`, note)); resolve(); };
    socket.setTimeout(2000);
    socket.once('connect', () => done('warn', 'in use — will be reused (reuseExistingServer)'));
    socket.once('timeout', () => done('warn', 'connect timed out — treat as reusable/unknown'));
    socket.once('error', (err: NodeJS.ErrnoException) => done(err.code === 'ECONNREFUSED' ? true : 'warn', err.code === 'ECONNREFUSED' ? 'free (available to bind)' : `unknown (${err.code})`));
  });
}

async function main() {
  console.log('E2E preflight — read-only; resets no data, creates no users.\n');
  const dbOk = checkDbTarget();
  const poolOk = checkPoolConfig();
  const browsersOk = checkBrowsers();
  await checkPort();

  process.stdout.write('  ....  Clerk connectivity (bounded)…\r');
  const clerk = await clerkPreflight();
  if (clerk.ok) console.log(line(true, 'Clerk connectivity', `${clerk.detail.endpointHost} reachable + authenticated (attempt ${clerk.detail.attempts})`));
  else { console.log(line(false, 'Clerk connectivity', clerk.category)); console.log('\n' + formatPreflightFailure(clerk)); }

  const hardOk = dbOk && poolOk && browsersOk && clerk.ok;
  console.log(`\nPreflight ${hardOk ? 'PASSED — ready to run the E2E suite.' : 'FAILED — resolve the FAIL items above before running E2E.'}`);
  process.exit(hardOk ? 0 : 1);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
