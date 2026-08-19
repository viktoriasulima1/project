import { Topbar } from '@/components/layout/Topbar';
import { OfflineQueueClient } from '@/components/offline/OfflineQueueClient';
import { requireFarm } from '@/lib/require-farm';
import { getClerkUserId } from '@/lib/farm';
import { ScoutingSyncCenter } from '@/components/scouting/ScoutingSyncCenter';
export const metadata = { title: 'Offline & Sync — FarmOS' };
export const dynamic = 'force-dynamic';
export default async function OfflinePage() {
  const farm = await requireFarm();
  const userRef=await getClerkUserId()??farm.clerkUserId;
  return <><Topbar title="Offline & Sync" subtitle="Drafts stored on this device and synchronization status" farmName={farm.name} /><OfflineQueueClient /><main style={{padding:24}}><ScoutingSyncCenter namespace={`${userRef}:${farm.id}`}/></main></>;
}
