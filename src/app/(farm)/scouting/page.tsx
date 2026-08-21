import { Topbar } from '@/components/layout/Topbar';
import { ScoutingVisitForm } from '@/components/scouting/ScoutingVisitForm';
import { ObservationStatusControl } from '@/components/scouting/ObservationStatusControl';
import { resolveFieldHealthStatus } from '@/lib/scouting/field-health';
import { buildFieldHealthDisplayModel } from '@/i18n/adapters/field-health';
import { createTranslator } from '@/i18n/translator';
import { requireFarm } from '@/lib/require-farm';
import { db } from '@/lib/db';
import { getClerkUserId } from '@/lib/farm';
import { getServerLocale, getServerI18n } from '@/i18n/server';
import { getEnumLabels } from '@/i18n/enum-labels';
import { CROP_CONDITIONS } from '@/lib/scouting/condition';
import styles from '@/components/scouting/Scouting.module.css';

const SCOUT_SEVERITY_VALUES = ['low', 'moderate', 'high', 'critical'] as const;
const OBSERVATION_STATUS_VALUES = ['open', 'monitoring', 'action_planned', 'resolved', 'dismissed', 'superseded'] as const;

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Field scouting — FarmOS' };

export default async function ScoutingPage({ searchParams }: { searchParams: Promise<{ field?: string }> }) {
  const farm = await requireFarm(); const query = await searchParams; const userRef=await getClerkUserId()??farm.clerkUserId;
  const locale = await getServerLocale();
  const { t, messages, fallback } = await getServerI18n(['scouting', 'fields']);
  // Field Health wording lives in the `fields` namespace; bind a second translator to it.
  const tf = createTranslator(locale, { messages: (messages.fields ?? {}) as Record<string, never>, fallback: (fallback.fields ?? {}) as Record<string, never> });
  const conditionLabels = getEnumLabels(locale, 'condition', CROP_CONDITIONS);
  const severityLabels = getEnumLabels(locale, 'severity', SCOUT_SEVERITY_VALUES);
  const observationStatusLabels = getEnumLabels(locale, 'observationStatus', OBSERVATION_STATUS_VALUES);
  const statusControlLabels = {
    change: t('page.status.change'),
    cancel: t('page.status.cancel'),
    reasonPlaceholder: t('page.status.reasonPlaceholder'),
    save: t('page.status.save'),
  };
  const fieldSeasons = await db.fieldSeason.findMany({ where: { season: { farmId: farm.id, isActive: true }, field: { deletedAt: null } }, include: { field: true, cropStageRecords: { orderBy: { observedAt: 'desc' }, take: 5 }, scoutingVisits: { orderBy: { visitDate: 'desc' }, take: 8, include: { observations: true } } }, orderBy: { field: { name: 'asc' } } });
  const recent = fieldSeasons.flatMap((fs) => fs.scoutingVisits.map((visit) => ({ ...visit, fieldName: fs.field.name, crop: fs.crop }))).sort((a,b) => b.visitDate.getTime()-a.visitDate.getTime()).slice(0,12);
  return <><Topbar title={t('page.title')} subtitle={t('page.subtitle')} farmName={farm.name}/><main className={styles.page}>
    {fieldSeasons.length ? <><ScoutingVisitForm initialFieldId={query.field} namespace={`${userRef}:${farm.id}`} farmId={farm.id} userRef={userRef} conditionLabels={conditionLabels} severityLabels={severityLabels} fields={fieldSeasons.map((fs) => ({ fieldSeasonId: fs.id, fieldId: fs.fieldId, fieldName: fs.field.name, crop: fs.crop, geometry: fs.field.coordinates }))}/><section className={styles.card}><h2>{t('page.fieldHealthPriority')}</h2>{fieldSeasons.map((fs) => { const observations=fs.scoutingVisits.flatMap((v)=>v.observations); const health=resolveFieldHealthStatus({ hasActiveSeason:true, observations, growthStageObservedAt:fs.cropStageRecords.find((r)=>r.isEffective)?.observedAt }); const hm=buildFieldHealthDisplayModel(tf, health); return <p key={fs.id}><strong>{fs.field.name}</strong> · <span className={styles.badge}>{hm.statusLabel}</span><br/><span className={styles.muted}>{hm.reason} {hm.actionLabel}</span></p>; })}</section></> : <section className={styles.card}><h2>{t('page.noActiveSeason.title')}</h2><p>{t('page.noActiveSeason.body')}</p></section>}
    <section className={styles.card}><h2>{t('page.recentVisits')}</h2>{recent.length ? <ul className={styles.visits}>{recent.map((v)=><li className={styles.visit} key={v.id}><strong>{v.fieldName}</strong> · {v.visitDate.toLocaleString(locale)} · {v.observations.length} observation(s)
      {v.observations.map((o)=>(
        <div key={o.id} style={{ marginTop: '6px' }}>
          <span className={styles.muted}>{o.issueType} ({observationStatusLabels[o.status as typeof OBSERVATION_STATUS_VALUES[number]] ?? o.status}, {o.severity})</span>
          {' '}
          <ObservationStatusControl
            observationId={o.id}
            currentStatus={o.status}
            statusLabels={observationStatusLabels}
            labels={statusControlLabels}
          />
        </div>
      ))}
    </li>)}</ul> : <p className={styles.muted}>{t('page.noVisits')}</p>}</section>
  </main></>;
}
