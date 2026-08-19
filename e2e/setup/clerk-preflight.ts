import { lookup } from 'node:dns/promises';
import { getClerkBackendClient } from './clerk-backend-client';

/**
 * Clerk connectivity preflight (Sprint 25 closure hardening).
 *
 * Runs BEFORE any destructive E2E database work so that, when the Clerk backend
 * is unreachable, global setup fails fast and unambiguously — without first
 * migrating/resetting the E2E database, and without ever pretending an
 * application scenario ran. It validates environment, checks development-key
 * shape, resolves DNS, and performs ONE harmless authenticated request
 * (`users.getUserList({ limit: 1 })`) under a short bounded timeout with a small
 * retry for transient network errors only.
 *
 * It never prints secrets — only the endpoint host, category flags, booleans and
 * a timestamp. It never bypasses authentication or mocks Clerk.
 */

export type ClerkFailureCategory =
  | 'missing_env' | 'invalid_key' | 'dns_failure' | 'network_unreachable'
  | 'timeout' | 'quota_exceeded' | 'clerk_service_error';

export interface PreflightDetail {
  timestamp: string;
  endpointHost: string;
  dnsResolved: boolean | null;
  httpsReachable: boolean | null;
  fetchCategory: string | null;
  attempts: number;
}

export interface PreflightResult {
  ok: boolean;
  category?: ClerkFailureCategory;
  message: string;
  detail: PreflightDetail;
}

// The Clerk Backend API host the @clerk/backend client talks to. Overridable for
// self-hosted/proxied Clerk, but api.clerk.com is the default.
const CLERK_API_HOST = (() => {
  const raw = process.env.CLERK_API_URL;
  if (!raw) return 'api.clerk.com';
  try { return new URL(raw).host; } catch { return 'api.clerk.com'; }
})();

const REQUIRED_ENV = [
  'CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY',
  'E2E_USER_NEW_EMAIL', 'E2E_USER_READY_EMAIL', 'E2E_USER_OTHER_EMAIL', 'E2E_USER_PILOT_EMAIL',
] as const;

// Transient categories are worth a bounded retry; credential/quota errors are not.
const RETRYABLE: ReadonlySet<ClerkFailureCategory> = new Set(['dns_failure', 'network_unreachable', 'timeout', 'clerk_service_error']);

class TimeoutError extends Error { constructor() { super('Clerk request timed out'); this.name = 'TimeoutError'; } }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new TimeoutError()), ms).unref?.()),
  ]);
}

function classify(error: unknown, dnsResolved: boolean | null): { category: ClerkFailureCategory; fetchCategory: string; httpsReachable: boolean | null } {
  const status = (error as { status?: unknown })?.status;
  if (typeof status === 'number') {
    // We received an HTTP response — the network path is fine.
    if (status === 401 || status === 403) return { category: 'invalid_key', fetchCategory: `http_${status}`, httpsReachable: true };
    if (status === 429) return { category: 'quota_exceeded', fetchCategory: 'http_429', httpsReachable: true };
    return { category: 'clerk_service_error', fetchCategory: `http_${status}`, httpsReachable: true };
  }
  const name = String((error as { name?: unknown })?.name ?? '');
  const msg = String((error as { message?: unknown })?.message ?? '');
  const causeCode = String((error as { cause?: { code?: unknown } })?.cause?.code ?? '');
  if (name === 'TimeoutError' || /abort|timed?\s?out/i.test(msg)) return { category: 'timeout', fetchCategory: 'timeout', httpsReachable: null };
  if (causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN' || dnsResolved === false) return { category: 'dns_failure', fetchCategory: causeCode || 'dns', httpsReachable: false };
  // undici surfaces a bare "fetch failed" TypeError for connect/reset errors.
  return { category: 'network_unreachable', fetchCategory: causeCode || 'fetch_failed', httpsReachable: false };
}

/** Runs the preflight. Returns a structured result — it does not throw. */
export async function clerkPreflight(opts: { timeoutMs?: number; maxAttempts?: number } = {}): Promise<PreflightResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxAttempts = Math.max(1, Math.min(opts.maxAttempts ?? 3, 5));
  const detail: PreflightDetail = { timestamp: new Date().toISOString(), endpointHost: CLERK_API_HOST, dnsResolved: null, httpsReachable: null, fetchCategory: null, attempts: 0 };

  // 1. Required environment.
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) return { ok: false, category: 'missing_env', message: `Missing E2E Clerk environment variables: ${missing.join(', ')}.`, detail };

  // 2. Development-key shape (never print the key itself).
  const pk = process.env.CLERK_PUBLISHABLE_KEY ?? '';
  const sk = process.env.CLERK_SECRET_KEY ?? '';
  if (sk.startsWith('sk_live_') || pk.startsWith('pk_live_')) return { ok: false, category: 'invalid_key', message: 'Refusing to run E2E against LIVE Clerk keys (pk_live_/sk_live_). Use development test keys.', detail };
  if (!pk.startsWith('pk_test_')) return { ok: false, category: 'invalid_key', message: 'CLERK_PUBLISHABLE_KEY does not have the expected development shape (pk_test_…).', detail };
  if (!sk.startsWith('sk_test_')) return { ok: false, category: 'invalid_key', message: 'CLERK_SECRET_KEY does not have the expected development shape (sk_test_…).', detail };

  // 3. DNS resolution (records the fact; a failure here is retried below too).
  try { await withTimeout(lookup(CLERK_API_HOST), Math.min(timeoutMs, 4000)); detail.dnsResolved = true; }
  catch { detail.dnsResolved = false; }

  // 4-5. One harmless authenticated request, bounded + retried for transient errors.
  let last: { category: ClerkFailureCategory; fetchCategory: string; httpsReachable: boolean | null } | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    detail.attempts = attempt;
    try {
      const clerk = getClerkBackendClient();
      await withTimeout(clerk.users.getUserList({ limit: 1 }), timeoutMs);
      detail.httpsReachable = true;
      return { ok: true, message: 'Clerk API reachable and authenticated.', detail };
    } catch (error) {
      last = classify(error, detail.dnsResolved);
      detail.fetchCategory = last.fetchCategory;
      detail.httpsReachable = last.httpsReachable;
      if (!RETRYABLE.has(last.category) || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)).unref?.()); // 400ms, 800ms, …
    }
  }

  return { ok: false, category: last?.category ?? 'network_unreachable', message: preflightFailureMessage(detail, last?.category), detail };
}

function preflightFailureMessage(detail: PreflightDetail, category?: ClerkFailureCategory): string {
  return [
    'E2E infrastructure unavailable: Clerk API could not be reached.',
    'No FarmOS browser scenarios were executed.',
    'Check network, DNS, VPN, proxy and Clerk service availability.',
    '',
    `  category:       ${category ?? 'network_unreachable'}`,
    `  endpoint host:  ${detail.endpointHost}`,
    `  fetch category: ${detail.fetchCategory ?? 'n/a'}`,
    `  dns resolved:   ${detail.dnsResolved === null ? 'unknown' : detail.dnsResolved}`,
    `  https reachable:${detail.httpsReachable === null ? ' unknown' : ` ${detail.httpsReachable}`}`,
    `  attempts:       ${detail.attempts}`,
    `  timestamp:      ${detail.timestamp}`,
  ].join('\n');
}

/** The full, human-facing failure text for a failed preflight (no secrets). */
export function formatPreflightFailure(result: PreflightResult): string {
  if (result.category === 'missing_env' || result.category === 'invalid_key') {
    return [`E2E preflight failed (${result.category}): ${result.message}`, `  timestamp: ${result.detail.timestamp}`].join('\n');
  }
  return result.message;
}
