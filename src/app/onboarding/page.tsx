export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getFarmSetupState } from '@/lib/farm-setup';
import { db } from '@/lib/db';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { logProductEvent } from '@/lib/product-events';

export const metadata = { title: 'Set up your farm — FarmOS' };

/**
 * Already fully set up — nothing left to onboard. `done=1` is the one-time
 * landing right after completion; an explicit `step` (e.g. a link from
 * Inventory's empty state to add a product) is a deliberate request to
 * reuse a specific step's form post-setup. Only auto-redirect a bare,
 * unparameterized /onboarding visit once setup is complete — otherwise a
 * ready user would never be able to revisit an optional step.
 */
export function shouldRedirectReadyUserToDashboard(
  state: string,
  done: string | undefined,
  requestedStep: string | undefined,
): boolean {
  return state === 'ready' && done !== '1' && !requestedStep;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; done?: string }>;
}) {
  const { step: requestedStep, done } = await searchParams;
  const setupState = await getFarmSetupState();

  if (shouldRedirectReadyUserToDashboard(setupState.state, done, requestedStep)) {
    redirect('/dashboard');
  }

  // Reuse the farm already resolved by getFarmSetupState() — avoid a second
  // Clerk auth() + farm query in the same request.
  const farm = setupState.farm;

  // The wizard navigates to exactly this URL once, right after Finish — but
  // `done=1` can still be re-visited (refresh, browser back/forward, or a
  // second detour through an optional step's own Finish click), so the
  // event itself is additionally gated on `farm.onboardingCompletedAt`
  // (Sprint 12: found firing on every render before this guard existed).
  if (setupState.state === 'ready' && done === '1' && farm && !farm.onboardingCompletedAt) {
    await db.farm.update({ where: { id: farm.id }, data: { onboardingCompletedAt: new Date() } });
    logProductEvent({ event: 'onboarding_completed', farmId: farm.id });
  }

  const fields = farm
    ? await db.field.findMany({
        where: { farmId: farm.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const activeSeason = setupState.activeSeasonId
    ? await db.season.findUnique({ where: { id: setupState.activeSeasonId } })
    : null;

  const serializableFarm = farm
    ? {
        id: farm.id,
        name: farm.name,
        location: farm.location,
        country: farm.country,
        totalHectares: farm.totalHectares ? Number(farm.totalHectares) : null,
        brpNumber: farm.brpNumber,
        vatNumber: farm.vatNumber,
        latitude: farm.latitude ? Number(farm.latitude) : null,
        longitude: farm.longitude ? Number(farm.longitude) : null,
      }
    : null;

  const serializableFields = fields.map((f) => ({
    id: f.id,
    name: f.name,
    hectares: Number(f.hectares),
  }));

  return (
    <OnboardingWizard
      setupStateName={setupState.state}
      requestedStep={requestedStep}
      farm={serializableFarm}
      fields={serializableFields}
      activeSeason={activeSeason ? { id: activeSeason.id, year: activeSeason.year } : null}
    />
  );
}
