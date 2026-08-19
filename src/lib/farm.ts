import { db } from './db';
import type { Farm } from '@prisma/client';

let _clerkAuth: (() => Promise<{ userId: string | null }>) | null = null;

async function tryGetClerkUserId(): Promise<string | null> {
  try {
    if (!_clerkAuth) {
      const mod = await import('@clerk/nextjs/server');
      _clerkAuth = mod.auth as unknown as () => Promise<{ userId: string | null }>;
    }
    const { userId } = await _clerkAuth();
    return userId;
  } catch {
    return null;
  }
}

/**
 * The current request's real Clerk user id, or null if there is no session.
 * Server Actions that create farm-owned data must derive ownership from
 * this — never from a client-submitted value — to prevent mass assignment
 * of `clerkUserId`/`farmId` onto arbitrary records.
 */
export async function getClerkUserId(): Promise<string | null> {
  return tryGetClerkUserId();
}

export async function getActiveFarm(): Promise<Farm | null> {
  const clerkUserId = await tryGetClerkUserId();

  try {
    if (clerkUserId) {
      return await db.farm.findUnique({ where: { clerkUserId } });
    }

    // Dev-only fallback, for local testing without Clerk configured. Gated
    // by TWO conditions, not one: NODE_ENV alone is not a strong enough
    // guard (a misconfigured deploy can leave NODE_ENV unset or wrong), so
    // this also requires an explicit opt-in env flag. This only ever
    // triggers when there is NO Clerk session at all — a real signed-in
    // user whose farm lookup comes up empty gets null here, never this
    // fallback (see the `if (clerkUserId)` branch above, which returns
    // unconditionally). The preferred flow for local dev is the explicit
    // "Load demo farm" action (src/lib/actions/dev-demo-farm.ts), not this.
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_FARM_FALLBACK === 'true') {
      return await db.farm.findFirst({ orderBy: { createdAt: 'asc' } });
    }

    return null;
  } catch {
    return null;
  }
}

export async function getActiveFarmOrThrow(): Promise<Farm> {
  const farm = await getActiveFarm();
  if (!farm) {
    throw new Error('No farm found. Please complete onboarding.');
  }
  return farm;
}
