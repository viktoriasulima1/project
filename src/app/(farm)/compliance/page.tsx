export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/layout/Topbar';
import { StubPage } from '@/components/layout/StubPage';
import { requireFarm } from '@/lib/require-farm';
import { db } from '@/lib/db';
import { getEffectiveComplianceRecords, type ComplianceFilters } from '@/lib/compliance-data';
import { getActivityFormContext } from '@/lib/activity-form-context';
import { CompliancePageClient } from '@/components/compliance/CompliancePageClient';

export const metadata = { title: 'Compliance — FarmOS' };

interface SearchParams {
  season?: string;
  dateFrom?: string;
  dateTo?: string;
  field?: string;
  crop?: string;
  product?: string;
  operator?: string;
  status?: string;
  includeReversed?: string;
}

export default async function CompliancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const farm = await requireFarm();
  const sp = await searchParams;

  const totalActivityCount = await db.activity.count({
    where: { type: 'spray', deletedAt: null, fieldSeason: { field: { farmId: farm.id } } },
  });

  if (totalActivityCount === 0) {
    return (
      <>
        <Topbar title="Compliance" subtitle="EU spray diary, corrections and export" farmName={farm.name} />
        <StubPage
          icon="✓"
          title="No compliance records yet"
          description="Records are created automatically after a spraying activity is completed."
          action={{ label: 'Record an activity', href: '/activities' }}
        />
      </>
    );
  }

  const activeSeason = await db.season.findFirst({ where: { farmId: farm.id, isActive: true }, orderBy: { year: 'desc' } });

  const [seasons, fields, fieldSeasonsForCrops, products, operatorRows] = await Promise.all([
    db.season.findMany({ where: { farmId: farm.id }, orderBy: { year: 'desc' }, select: { id: true, year: true } }),
    db.field.findMany({ where: { farmId: farm.id, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.fieldSeason.findMany({ where: { field: { farmId: farm.id } }, select: { crop: true }, distinct: ['crop'] }),
    db.inventoryItem.findMany({ where: { farmId: farm.id }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.activity.findMany({
      where: { type: 'spray', deletedAt: null, fieldSeason: { field: { farmId: farm.id } }, operatorName: { not: '' } },
      select: { operatorName: true },
      distinct: ['operatorName'],
    }),
  ]);

  // Filters — defaults per Sprint 19 Part 12: current active season,
  // effective records only, reversed excluded, incomplete included.
  const filters: ComplianceFilters = {
    seasonId: sp.season || activeSeason?.id,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    fieldId: sp.field || undefined,
    crop: sp.crop || undefined,
    productId: sp.product || undefined,
    operatorName: sp.operator || undefined,
    effectiveOnly: true,
    includeReversed: sp.includeReversed === 'true',
    includeIncomplete: true,
  };

  const records = await getEffectiveComplianceRecords(farm.id, filters);
  const visibleRecords = sp.status && sp.status !== 'all'
    ? records.filter((r) => r.completeness.status === sp.status)
    : records;

  const summary = {
    total: records.length,
    complete: records.filter((r) => r.completeness.status === 'complete').length,
    incomplete: records.filter((r) => r.completeness.status === 'incomplete').length,
    corrected: records.filter((r) => r.completeness.status === 'corrected').length,
    reversed: records.filter((r) => r.completeness.status === 'reversed').length,
    verificationUnavailable: records.filter((r) => r.completeness.status === 'verification_unavailable').length,
  };

  const formContext = await getActivityFormContext(farm);

  return (
    <>
      <Topbar title="Compliance" subtitle="EU spray diary, corrections and export" farmName={farm.name} />
      <CompliancePageClient
        records={visibleRecords}
        summary={summary}
        seasons={seasons.map((s) => ({ id: s.id, year: s.year }))}
        fields={fields}
        crops={fieldSeasonsForCrops.map((f) => f.crop)}
        products={products}
        operators={operatorRows.map((o) => o.operatorName)}
        currentFilters={{
          season: filters.seasonId ?? '',
          dateFrom: sp.dateFrom ?? '',
          dateTo: sp.dateTo ?? '',
          field: sp.field ?? '',
          crop: sp.crop ?? '',
          product: sp.product ?? '',
          operator: sp.operator ?? '',
          status: sp.status ?? 'all',
          includeReversed: sp.includeReversed === 'true',
        }}
        farmId={farm.id}
        correctionProducts={formContext.products}
        correctionMachines={formContext.machines}
      />
    </>
  );
}
