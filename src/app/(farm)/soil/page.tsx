import { Topbar } from '@/components/layout/Topbar';
import { SoilManager, type FieldOption, type SoilAnalysisRow } from '@/components/soil/SoilManager';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { getServerI18n } from '@/i18n/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Soil analyses — FarmOS' };

export default async function SoilPage() {
  const farm = await requireFarm();
  const [fields, analyses] = await Promise.all([
    db.field.findMany({ where: { farmId: farm.id, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.soilAnalysis.findMany({
      where: { field: { farmId: farm.id, deletedAt: null } },
      include: { field: { select: { name: true } } },
      orderBy: { analysisDate: 'desc' },
    }),
  ]);
  const { t } = await getServerI18n(['soil']);

  const fieldOptions: FieldOption[] = fields;
  const rows: SoilAnalysisRow[] = analyses.map((a) => ({
    id: a.id,
    fieldId: a.fieldId,
    fieldName: a.field.name,
    analysisDate: a.analysisDate.toISOString().slice(0, 10),
    phLevel: a.phLevel != null ? a.phLevel.toString() : null,
    pIndex: a.pIndex,
    kIndex: a.kIndex,
    mgIndex: a.mgIndex,
    organicMatterPct: a.organicMatterPct != null ? a.organicMatterPct.toString() : null,
    notes: a.notes,
  }));

  return (
    <>
      <Topbar title={t('title')} subtitle={t('subtitle')} farmName={farm.name} />
      <SoilManager fields={fieldOptions} analyses={rows} />
    </>
  );
}
