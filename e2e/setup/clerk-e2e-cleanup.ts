/**
 * Optional, manual cleanup of legacy E2E throwaway Clerk users (Sprint 18
 * Final E2E Stabilization Part 5).
 *
 * Before this sprint, `createThrowawayUser(label)` minted a brand-new Clerk
 * user on every call (`e2e-${label}-${Date.now()}+clerk_test@example.com`),
 * which is what exhausted this project's 100-user Clerk development-instance
 * quota — see docs/E2E_Clerk_User_Quota_Audit.md. That function no longer
 * exists, so no NEW debris of this kind accumulates going forward — but the
 * old debris already created still occupies quota slots. This script is the
 * one-time (or occasional) manual mechanism to clear it.
 *
 * Run via `npm run clerk:e2e:cleanup`.
 *
 * Safety:
 *   - Dry-run by default: always lists what it WOULD delete; only actually
 *     deletes when CLERK_E2E_CLEANUP_CONFIRM=true is set.
 *   - Only ever matches the strict legacy throwaway pattern
 *     `e2e-<label>-<timestamp>+clerk_test@example.com` — never an arbitrary
 *     Clerk user, and never one of the current fixed-pool identities
 *     (E2E_USER_NEW/READY/OTHER/PILOT), which are explicitly excluded even
 *     though they would never match the timestamp pattern anyway.
 *   - Never invoked automatically by global.setup.ts or any spec file — this
 *     file has no test.* calls and Playwright will not pick it up as a test.
 *   - Reuses getClerkBackendClient(), which itself refuses to run against a
 *     live (`sk_live_`) secret key.
 */
import { getClerkBackendClient } from './clerk-backend-client';

// Matches exactly the shape the old createThrowawayUser(label) generated:
// e2e-<label>-<millisecond timestamp>+clerk_test@example.com
const LEGACY_THROWAWAY_PATTERN = /^e2e-[a-z0-9-]+-\d{10,}\+clerk_test@example\.com$/i;

function fixedPoolEmails(): Set<string> {
  return new Set(
    [
      process.env.E2E_USER_NEW_EMAIL,
      process.env.E2E_USER_READY_EMAIL,
      process.env.E2E_USER_OTHER_EMAIL,
      process.env.E2E_USER_PILOT_EMAIL,
    ].filter((email): email is string => Boolean(email)),
  );
}

interface MatchedUser {
  id: string;
  email: string;
}

async function findLegacyThrowawayUsers(): Promise<MatchedUser[]> {
  const clerk = getClerkBackendClient();
  const protectedEmails = fixedPoolEmails();
  const matches: MatchedUser[] = [];
  const limit = 100;
  let offset = 0;

  for (;;) {
    const page = await clerk.users.getUserList({ limit, offset });
    for (const user of page.data) {
      const email = user.emailAddresses[0]?.emailAddress ?? '';
      if (LEGACY_THROWAWAY_PATTERN.test(email) && !protectedEmails.has(email)) {
        matches.push({ id: user.id, email });
      }
    }
    if (page.data.length < limit) break;
    offset += limit;
  }

  return matches;
}

async function main(): Promise<void> {
  const matches = await findLegacyThrowawayUsers();

  console.log(`[clerk:e2e:cleanup] found ${matches.length} legacy throwaway E2E user(s) matching the old createThrowawayUser() pattern:`);
  for (const m of matches) {
    console.log(`  ${m.email}  (${m.id})`);
  }

  if (matches.length === 0) {
    console.log('[clerk:e2e:cleanup] nothing to clean up.');
    return;
  }

  if (process.env.CLERK_E2E_CLEANUP_CONFIRM !== 'true') {
    console.log(
      '\n[clerk:e2e:cleanup] DRY RUN — no users were deleted. ' +
      'Re-run with CLERK_E2E_CLEANUP_CONFIRM=true to actually delete the users listed above.',
    );
    return;
  }

  const clerk = getClerkBackendClient();
  for (const m of matches) {
    await clerk.users.deleteUser(m.id);
    console.log(`[clerk:e2e:cleanup] deleted ${m.email}`);
  }
  console.log(`[clerk:e2e:cleanup] deleted ${matches.length} user(s).`);
}

if (require.main === module) {
  import('dotenv').then(({ config }) => {
    config({ path: require('node:path').resolve(__dirname, '../../.env.e2e') });
    main().catch((err) => {
      console.error('[clerk:e2e:cleanup] failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
  });
}
