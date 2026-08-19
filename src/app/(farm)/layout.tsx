import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { getActiveFarm, getClerkUserId } from '@/lib/farm';
import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';

export default async function FarmLayout({ children }: { children: ReactNode }) {
  const farm = await getActiveFarm();
  if (!farm) return children;
  const userId = (await getClerkUserId()) ?? farm.clerkUserId;
  const userRef = createHash('sha256').update(`farmos-offline:${userId}`).digest('hex').slice(0, 32);
  return <AppShell farmId={farm.id} userRef={userRef}>{children}</AppShell>;
}
