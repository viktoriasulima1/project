import { checkClerkProductionSafety } from '@/lib/clerk-config';

/**
 * Sprint 18 Final E2E Stabilization Part 7 — Clerk's own browser console
 * warning ("Clerk has been loaded with development keys") is expected and
 * harmless for local dev and this project's own E2E run, which deliberately
 * uses a test-mode Clerk instance (see docs/E2E_Clerk_User_Quota_Audit.md).
 * It is NOT acceptable for a real pilot or production deployment.
 *
 * This runs once at server boot (Next.js instrumentation `register()`),
 * before the server accepts any requests, and fails loudly rather than
 * silently limping along with the wrong key type.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const result = checkClerkProductionSafety({
    nodeEnv: process.env.NODE_ENV,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    isE2eRun: process.env.E2E_RUN === 'true',
  });

  if (!result.safe) {
    throw new Error(`Refusing to start: ${result.message}`);
  }
}
