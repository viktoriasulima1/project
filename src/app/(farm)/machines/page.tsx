import { Topbar } from '@/components/layout/Topbar';
import { MachineManager, type MachineRow } from '@/components/machines/MachineManager';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { resolveServiceStatus } from '@/lib/machine-service-status';
import { getServerI18n } from '@/i18n/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Machinery — FarmOS' };

export default async function MachinesPage() {
  const farm = await requireFarm();
  const machines = await db.machine.findMany({ where: { farmId: farm.id }, orderBy: { name: 'asc' } });
  const { t } = await getServerI18n(['machines']);

  const rows: MachineRow[] = machines.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    make: m.make,
    model: m.model,
    year: m.year,
    hoursSinceService: m.hoursSinceService,
    nextServiceDueHours: m.nextServiceDueHours,
    isCertified: m.isCertified,
    serviceStatus: resolveServiceStatus(m),
  }));

  return (
    <>
      <Topbar title={t('title')} subtitle={t('subtitle')} farmName={farm.name} />
      <MachineManager machines={rows} />
    </>
  );
}
