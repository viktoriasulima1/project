import { Topbar } from '@/components/layout/Topbar';
import { requireFarm } from '@/lib/require-farm';
import { db } from '@/lib/db';
import { searchBrpNearFarmAction } from '@/lib/actions/brp-import';
import { BrpImportClient } from '@/components/fields/BrpImportClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import field from BRP — FarmOS' };

const FALLBACK_LAT = parseFloat(process.env.NEXT_PUBLIC_FARM_LATITUDE ?? '51.9652');
const FALLBACK_LON = parseFloat(process.env.NEXT_PUBLIC_FARM_LONGITUDE ?? '5.9307');

export default async function BrpImportPage() {
  const farm = await requireFarm();
  const activeSeason = await db.season.findFirst({ where: { farmId: farm.id, isActive: true }, select: { id: true } });

  const lat = farm.latitude != null ? Number(farm.latitude) : FALLBACK_LAT;
  const lon = farm.longitude != null ? Number(farm.longitude) : FALLBACK_LON;

  const initialResult = await searchBrpNearFarmAction(1500);

  return (
    <>
      <Topbar
        title="Import field from BRP"
        subtitle="Public national parcel data — review and confirm before importing"
        farmName={farm.name}
      />
      <BrpImportClient
        centerLat={lat}
        centerLon={lon}
        initialResult={initialResult}
        activeSeasonId={activeSeason?.id ?? null}
      />
    </>
  );
}
