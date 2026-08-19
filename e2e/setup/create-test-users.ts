import { getClerkBackendClient } from './clerk-backend-client';

export interface E2eUser {
  id: string;
  email: string;
}

function assertTestEmail(email: string) {
  if (!email.includes('+clerk_test@')) {
    throw new Error(
      `Refusing to create/use "${email}" as an E2E user — it must contain "+clerk_test@" ` +
      'so Clerk auto-verifies it and never sends real email.',
    );
  }
}

/** Idempotent: returns the existing user if one already has this email,
 * otherwise creates it. Safe to call on every E2E run. No password is ever
 * set — sign-in happens via ticket-based `clerk.signIn({ emailAddress })`. */
export async function ensureE2eUser(email: string): Promise<E2eUser> {
  assertTestEmail(email);
  const clerk = getClerkBackendClient();

  const existing = await clerk.users.getUserList({ emailAddress: [email] });
  if (existing.data.length > 0) {
    return { id: existing.data[0].id, email };
  }

  const created = await clerk.users.createUser({
    emailAddress: [email],
    skipPasswordRequirement: true,
  });
  return { id: created.id, email };
}

/**
 * Fixed pool of 4 reusable E2E identities — created once, reused for every
 * run and every test forever after. There is deliberately no
 * "createThrowawayUser" / per-test-unique-email function in this file: a
 * prior version generated a brand-new Clerk user on every call
 * (`e2e-${label}-${Date.now()}+clerk_test@example.com`), which is what
 * exhausted this project's 100-user Clerk development-instance quota — see
 * docs/E2E_Clerk_User_Quota_Audit.md. "Freshness" for a test now comes from
 * resetting/reseeding a fixed identity's own FarmOS data
 * (e2e/setup/reset-user-data.ts), never from minting a new Clerk account.
 *
 * - NEW:   reused for every "no farm yet" / onboarding scenario. Its FarmOS
 *          data is deleted before each such test.
 * - READY: a stable, shared farm seeded once in global setup. Most
 *          read-mostly feature/failure/accessibility/mobile tests run as
 *          this user and must never destructively mutate its farm.
 * - OTHER: a second stable, separate farm, seeded once in global setup —
 *          used only for cross-farm isolation checks against READY.
 * - PILOT: reusable but freely mutable. Absorbs every scenario that used to
 *          call the old per-test throwaway-user generator; each such test
 *          resets/reseeds PILOT's own farm data at its own start. Safe
 *          under this suite's single-worker (fullyParallel: false) config.
 */
export async function ensureAllNamedE2eUsers(): Promise<{
  userNew: E2eUser;
  userReady: E2eUser;
  userOther: E2eUser;
  userPilot: E2eUser;
}> {
  const emailNew = process.env.E2E_USER_NEW_EMAIL;
  const emailReady = process.env.E2E_USER_READY_EMAIL;
  const emailOther = process.env.E2E_USER_OTHER_EMAIL;
  const emailPilot = process.env.E2E_USER_PILOT_EMAIL;
  if (!emailNew || !emailReady || !emailOther || !emailPilot) {
    throw new Error(
      'E2E_USER_NEW_EMAIL, E2E_USER_READY_EMAIL, E2E_USER_OTHER_EMAIL, and E2E_USER_PILOT_EMAIL ' +
      'must all be set (see .env.e2e.example).',
    );
  }

  const [userNew, userReady, userOther, userPilot] = await Promise.all([
    ensureE2eUser(emailNew),
    ensureE2eUser(emailReady),
    ensureE2eUser(emailOther),
    ensureE2eUser(emailPilot),
  ]);

  return { userNew, userReady, userOther, userPilot };
}
