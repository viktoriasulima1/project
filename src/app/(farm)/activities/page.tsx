export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/layout/Topbar';
import { ActivitiesClient } from '@/components/activities/ActivitiesClient';
import { SetupGuide } from '@/components/activities/SetupGuide';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { getActivityFormContext } from '@/lib/activity-form-context';
import type { ActivityType } from '@prisma/client';

export const metadata = { title: 'Activities — FarmOS' };

const PAGE_SIZE = 50;
const VALID_FILTERS = ['all', 'spray', 'fertilise', 'harvest', 'tillage', 'sow', 'scout'] as const;
type FilterType = (typeof VALID_FILTERS)[number];

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string; workOrder?: string; fieldSeason?: string; type?: string }>;
}) {
  // Redirects to /onboarding if there is no farm at all. No active season /
  // no field seasons are handled inline below via SetupGuide instead of a
  // redirect — see requireFarm's doc comment for why.
  const farm = await requireFarm();

  const { page: pageStr = '1', filter: rawFilter = 'all', workOrder, fieldSeason, type } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const filter: FilterType = VALID_FILTERS.includes(rawFilter as FilterType)
    ? (rawFilter as FilterType)
    : 'all';

  // Active season — deterministic: most recent year wins if multiple are active
  const activeSeason = await db.season.findFirst({
    where: { farmId: farm.id, isActive: true },
    orderBy: { year: 'desc' },
  });

  // Fields for setup guide (only needed in the pre-setup branch below)
  const fields = await db.field.findMany({
    where: { farmId: farm.id, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, hectares: true },
  });

  const needsSeasonSetup = !activeSeason;
  const fieldSeasonCountForGuide = activeSeason
    ? await db.fieldSeason.count({ where: { seasonId: activeSeason.id, field: { deletedAt: null } } })
    : 0;
  const needsFieldSetup = !!activeSeason && fieldSeasonCountForGuide === 0;

  // Sprint 13 finding: fieldSeasonCountForGuide === 0 only catches a season
  // with NO fields assigned at all — a farm that already has one assigned
  // field (the common case once onboarding is done) but then adds a SECOND
  // field had no UI path whatsoever to ever assign it a crop. Computed
  // separately from needsFieldSetup so it doesn't hide the rest of the page
  // for a farm that already has real activity history.
  let unassignedFields: { id: string; name: string; hectares: number }[] = [];
  if (activeSeason && !needsFieldSetup) {
    const assignedFieldSeasons = await db.fieldSeason.findMany({
      where: { seasonId: activeSeason.id },
      select: { fieldId: true },
    });
    const assignedIds = new Set(assignedFieldSeasons.map((fs) => fs.fieldId));
    unassignedFields = fields
      .filter((f) => !assignedIds.has(f.id))
      .map((f) => ({ id: f.id, name: f.name, hectares: Number(f.hectares) }));
  }

  if (needsSeasonSetup || needsFieldSetup) {
    const fieldOptions = fields.map((f) => ({
      id: f.id,
      name: f.name,
      hectares: Number(f.hectares),
    }));

    return (
      <>
        <Topbar title="Activities" subtitle="Spray diary and field operations" farmName={farm.name} />
        <SetupGuide
          activeSeason={activeSeason ? { id: activeSeason.id, year: activeSeason.year } : null}
          fields={fieldOptions}
        />
      </>
    );
  }

  // Shared context — same helper Quick Log uses, so both get identical
  // field/product/machine lists and the same safe prefills.
  const formContext = await getActivityFormContext(farm);

  // Activities query — exclude soft-deleted, apply server-side filter
  const activityWhere = {
    fieldSeason: { field: { farmId: farm.id } },
    deletedAt: null, // Critical: always exclude soft-deleted
    ...(filter !== 'all' ? { type: filter as ActivityType } : {}),
  };

  const [totalCount, rawActivities] = await Promise.all([
    db.activity.count({ where: activityWhere }),
    db.activity.findMany({
      where: activityWhere,
      include: {
        fieldSeason: { include: { field: { select: { name: true } } } },
        product: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const activities = rawActivities.map((a) => ({
    id: a.id,
    type: a.type,
    status: a.status,
    date: a.date,
    operatorName: a.operatorName,
    areaHa: Number(a.areaHa),
    fieldName: a.fieldSeason.field.name,
    fieldSeasonId: a.fieldSeasonId,
    crop: a.fieldSeason.crop,
    productId: a.productId ?? undefined,
    productName: a.product?.name,
    machineId: a.machineId ?? undefined,
    dosePerHa: a.dosePerHa ? Number(a.dosePerHa) : undefined,
    doseUnit: a.doseUnit ?? undefined,
    weatherTempC: a.weatherTempC ? Number(a.weatherTempC) : undefined,
    weatherWindKmh: a.weatherWindKmh ?? undefined,
    weatherWindDir: a.weatherWindDir ?? undefined,
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <Topbar
        title="Activities"
        subtitle={`${totalCount} record${totalCount !== 1 ? 's' : ''} · EU-compliant spray diary`}
        farmName={farm.name}
      />
      <ActivitiesClient
        activities={activities}
        fieldSeasons={formContext.fieldSeasons}
        products={formContext.products}
        machines={formContext.machines}
        farmId={farm.id}
        recentOperatorName={formContext.recentOperatorName}
        recentMachineId={formContext.recentMachineId}
        weather={formContext.weather}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        currentFilter={filter}
        unassignedFields={unassignedFields}
        activeSeasonId={activeSeason!.id}
        activeSeasonYear={activeSeason!.year}
        initialWorkOrderId={workOrder}
        initialFieldSeasonId={fieldSeason}
        initialType={['spray','fertilise','sow','tillage','scout','harvest','other'].includes(type ?? '') ? type as 'spray' | 'fertilise' | 'sow' | 'tillage' | 'scout' | 'harvest' | 'other' : undefined}
      />
    </>
  );
}
