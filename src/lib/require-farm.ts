import { redirect } from 'next/navigation';
import { getActiveFarm } from './farm';
import type { Farm } from '@prisma/client';

/**
 * Guard for protected farm-module pages (Fields, Activities, Inventory,
 * Finance, Weather, Compliance, AI). Redirects to /onboarding when the user
 * has no farm at all — the one setup gap none of those pages can do
 * anything useful about on their own.
 *
 * Deliberately does NOT redirect for the finer-grained states (no active
 * season / no fields / no field seasons): those are handled by each page's
 * own contextual empty state instead (see Sprint_8_Onboarding_Report.md for
 * why — Fields is itself the tool that fixes "no fields," so redirecting it
 * away would make its own empty state unreachable). This also keeps
 * redirect behavior to a single condition, so there is no redirect loop to
 * reason about: /onboarding never calls this guard.
 */
export async function requireFarm(): Promise<Farm> {
  const farm = await getActiveFarm();
  if (!farm) {
    redirect('/onboarding');
  }
  return farm;
}
