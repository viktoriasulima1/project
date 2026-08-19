import { createClerkClient } from '@clerk/backend';

/**
 * A standalone Clerk Backend API client for E2E setup scripts — deliberately
 * NOT the app's own `clerkClient()` (that one requires Next.js request
 * context via next/headers and can't run from a plain Node script).
 */
export function getClerkBackendClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to manage E2E test users.');
  }
  if (secretKey.startsWith('sk_live_')) {
    throw new Error('Refusing to run E2E user setup against a live Clerk secret key.');
  }
  return createClerkClient({ secretKey });
}
