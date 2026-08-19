export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/layout/Topbar';
import { FieldsListClient } from '@/components/fields/FieldsListClient';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { getServerI18n } from '@/i18n/server';

export const metadata = { title: 'Fields — FarmOS' };

export default async function FieldsPage() {
  // Redirects to /onboarding if there is no farm at all. Deliberately does
  // NOT redirect when the farm simply has zero fields yet — this page is
  // itself the tool for fixing that, via FieldsListClient's own empty state.
  const farm = await requireFarm();

  // Exclude soft-deleted fields
  const rawFields = await db.field.findMany({
    where: { farmId: farm.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  // Prisma Decimal instances cannot cross the Server → Client Component
  // boundary (only plain serializable values can) — convert to number here.
  const fields = rawFields.map((f) => ({ ...f, hectares: Number(f.hectares) }));

  const totalHa = fields.reduce((sum, f) => sum + f.hectares, 0);
  const { t } = await getServerI18n(['fields']);

  return (
    <>
      <Topbar
        title={t('title')}
        subtitle={`${fields.length} · ${totalHa.toFixed(1)} ha`}
        farmName={farm.name}
      />
      <FieldsListClient fields={fields} totalHa={totalHa} />
    </>
  );
}
