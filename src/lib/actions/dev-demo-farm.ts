'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const DEV_FARM_ID = 'dev-farm-gelderland';

export type LoadDemoFarmState = {
  error?: string;
  success?: boolean;
};

/**
 * Development-only convenience: relinks the seeded demo farm to whichever
 * Clerk user is currently signed in. Lets a developer seed once and then
 * attach the demo data to their real session without hand-editing
 * DEV_SEED_USER_ID and re-running the seed every time their session changes.
 *
 * Guarded twice: by NODE_ENV here, and the caller (dashboard empty state)
 * only renders the triggering button in development too.
 */
export async function loadDemoFarm(
  _prev: LoadDemoFarmState,
  _formData: FormData
): Promise<LoadDemoFarmState> {
  if (process.env.NODE_ENV !== 'development') {
    return { error: 'Demo farm loading is only available in development.' };
  }

  let userId: string | null = null;
  try {
    const { auth } = await import('@clerk/nextjs/server');
    const result = await auth();
    userId = result.userId;
  } catch {
    // Clerk not configured in this environment — fall through to the error below.
  }

  if (!userId) {
    return { error: 'Sign in first, then load the demo farm.' };
  }

  // Never relink over a real farm this user already owns — only act when
  // they own no farm yet, or already own the demo farm itself (no-op).
  const owned = await db.farm.findUnique({ where: { clerkUserId: userId } });
  if (owned && owned.id !== DEV_FARM_ID) {
    return { error: 'You already have a farm — demo farm not loaded, to avoid overwriting it.' };
  }
  if (owned && owned.id === DEV_FARM_ID) {
    return { success: true };
  }

  try {
    await db.farm.update({
      where: { id: DEV_FARM_ID },
      data: { clerkUserId: userId },
    });
  } catch {
    return { error: 'Demo farm not found. Run `npx prisma db seed` first.' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}
