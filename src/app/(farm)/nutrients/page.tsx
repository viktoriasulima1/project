import { Topbar } from '@/components/layout/Topbar';
import { NutrientsManager, type BalanceRow, type NormRow, type IncompleteProduct } from '@/components/nutrients/NutrientsManager';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { getSeasonNutrientBalance } from '@/lib/nutrient-balance';
import { getServerI18n } from '@/i18n/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nutrient balance — FarmOS' };

export default async function NutrientsPage() {
  const farm = await requireFarm();
  const { t } = await getServerI18n(['nutrients']);
  const activeSeason = await db.season.findFirst({ where: { farmId: farm.id, isActive: true } });

  const balanceByField = activeSeason ? await getSeasonNutrientBalance(farm.id, activeSeason.id) : [];

  const [normReferences, incompleteItems] = await Promise.all([
    db.nutrientNormReference.findMany({ where: { farmId: farm.id } }),
    activeSeason
      ? db.inventoryItem.findMany({
          where: {
            farmId: farm.id,
            category: 'fertiliser',
            nitrogenPercent: null,
            phosphorusPercent: null,
            activities: { some: { type: 'fertilise', deletedAt: null, fieldSeason: { seasonId: activeSeason.id } } },
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const normByCrop = new Map(normReferences.map((n) => [n.crop, n]));
  const distinctCrops = [...new Set(balanceByField.map((r) => r.crop))];

  const balance: BalanceRow[] = balanceByField.map((row) => {
    const norm = normByCrop.get(row.crop as never);
    return {
      ...row,
      nitrogenNormKgPerHa: norm?.nitrogenNormKgPerHa != null ? Number(norm.nitrogenNormKgPerHa) : null,
      phosphateNormKgPerHa: norm?.phosphateNormKgPerHa != null ? Number(norm.phosphateNormKgPerHa) : null,
    };
  });

  const norms: NormRow[] = distinctCrops.map((crop) => {
    const existing = normByCrop.get(crop as never);
    return {
      crop,
      nitrogenNormKgPerHa: existing?.nitrogenNormKgPerHa != null ? existing.nitrogenNormKgPerHa.toString() : null,
      phosphateNormKgPerHa: existing?.phosphateNormKgPerHa != null ? existing.phosphateNormKgPerHa.toString() : null,
      source: existing?.source ?? null,
      verifiedAt: existing?.verifiedAt ? existing.verifiedAt.toISOString().slice(0, 10) : null,
    };
  });

  const incompleteProducts: IncompleteProduct[] = incompleteItems;

  return (
    <>
      <Topbar title={t('title')} subtitle={t('subtitle')} farmName={farm.name} />
      <NutrientsManager balance={balance} norms={norms} incompleteProducts={incompleteProducts} />
    </>
  );
}
