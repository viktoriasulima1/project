/**
 * Whether a real Clerk publishable key is configured, as opposed to an
 * empty/placeholder value. Deliberately does NOT check for one specific
 * placeholder string (e.g. the literal text in .env.local.example) — any
 * placeholder text is one edit away from silently drifting out of sync with
 * a hardcoded check like that. Instead this requires the key to actually
 * look like a real Clerk key: correct prefix, and long enough that no
 * plausible placeholder ("...", "REPLACE_ME", "xxx", etc.) could pass.
 */
export function isClerkConfigured(publishableKey: string | undefined): boolean {
  if (!publishableKey) return false;
  return /^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(publishableKey);
}

export interface ClerkProductionSafetyEnv {
  nodeEnv: string | undefined;
  publishableKey: string | undefined;
  secretKey: string | undefined;
  /** Set by playwright.config.ts on its own spawned server (E2E_RUN=true) —
   * this project's E2E run deliberately produces a NODE_ENV=production
   * server (via `next start`) that uses test-mode Clerk keys on purpose. */
  isE2eRun: boolean;
}

/**
 * Sprint 18 Final E2E Stabilization Part 7 — a real pilot/production
 * deployment must use a production Clerk instance (`pk_live_`/`sk_live_`).
 * Development/test keys (`pk_test_`/`sk_test_`) are only acceptable in local
 * dev or this project's own E2E run — never in a real production
 * environment, where they'd mean every "signed-up" farmer is really just a
 * Clerk development-instance user sharing that instance's 100-user cap.
 */
export function checkClerkProductionSafety(env: ClerkProductionSafetyEnv): { safe: boolean; message?: string } {
  if (env.nodeEnv !== 'production') return { safe: true };
  if (env.isE2eRun) return { safe: true };
  if (!isClerkConfigured(env.publishableKey)) return { safe: true }; // Clerk not enabled — nothing to check

  const usesTestKey = env.publishableKey?.startsWith('pk_test_') || env.secretKey?.startsWith('sk_test_');
  if (!usesTestKey) return { safe: true };

  return {
    safe: false,
    message:
      'Clerk development/test keys (pk_test_/sk_test_) are configured in a production environment ' +
      '(NODE_ENV=production, E2E_RUN not set). Pilot and production deployments must use a ' +
      'production Clerk instance (pk_live_/sk_live_ keys). See docs/E2E_Clerk_User_Quota_Audit.md.',
  };
}
