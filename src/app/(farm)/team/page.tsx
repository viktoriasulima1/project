import { Topbar } from '@/components/layout/Topbar';
import { TeamManager, type TeamMember } from '@/components/team/TeamManager';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { resolveCertStatus } from '@/lib/employee-cert-status';
import { getServerI18n } from '@/i18n/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team — FarmOS' };

export default async function TeamPage() {
  const farm = await requireFarm();
  const employees = await db.employee.findMany({ where: { farmId: farm.id }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  const { t } = await getServerI18n(['team']);

  const members: TeamMember[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    hasSpraying: e.hasSpraying,
    certNumber: e.certNumber,
    certExpiry: e.certExpiry ? e.certExpiry.toISOString().slice(0, 10) : null,
    isActive: e.isActive,
    certStatus: resolveCertStatus(e),
  }));

  return (
    <>
      <Topbar title={t('title')} subtitle={t('subtitle')} farmName={farm.name} />
      <TeamManager members={members} />
    </>
  );
}
