'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createScoutingVisit } from '@/lib/actions/scouting';
import { OBSERVATION_CATEGORIES } from '@/lib/scouting/categories';
import { CROP_CONDITIONS, CROP_CONDITION_LABELS, validateCropCondition, type CropCondition } from '@/lib/scouting/condition';
import { classifyGpsAccuracy, buildLocationEvidence, type GpsAccuracyAssessment } from '@/lib/scouting/gps-accuracy';
import { listScoutingDrafts, putScoutingDraft, type LocalScoutingDraft, type LocalScoutingPhoto } from '@/offline/scouting-db';
import { useTranslations } from '@/i18n/LocaleProvider';
import styles from './Scouting.module.css';

type FieldOption = { fieldSeasonId: string; fieldId: string; fieldName: string; crop: string; geometry: unknown };
type Severity = 'low' | 'moderate' | 'high' | 'critical';
type Obs = { category: typeof OBSERVATION_CATEGORIES[number]; issueType: string; severity: Severity; affectedPercent: string; description: string };
const SEVERITIES: Severity[] = ['low', 'moderate', 'high', 'critical'];
const SEVERITY_LABELS: Record<Severity, string> = { low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical' };
const blank = (): Obs => ({ category: 'general_note', issueType: 'Unconfirmed symptom', severity: 'low', affectedPercent: '', description: '' });

export function ScoutingVisitForm({ fields, initialFieldId, namespace, farmId, userRef, conditionLabels, severityLabels }: { fields: FieldOption[]; initialFieldId?: string; namespace: string; farmId: string; userRef: string; conditionLabels?: Record<CropCondition, string>; severityLabels?: Record<Severity, string> }) {
  // Labels are localizable and supplied by the server-resolved locale; the
  // submitted value is always the canonical enum token (option `value`), so
  // translating a label can never change what is saved.
  const conditionLabelFor = (c: CropCondition) => (conditionLabels ?? CROP_CONDITION_LABELS)[c];
  const severityLabelFor = (s: Severity) => (severityLabels ?? SEVERITY_LABELS)[s];
  const t = useTranslations('scouting');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldSeasonId, setFieldSeasonId] = useState(fields.find((f) => f.fieldId === initialFieldId)?.fieldSeasonId ?? fields[0]?.fieldSeasonId ?? '');
  const [overallCondition, setOverallCondition] = useState<CropCondition>('good');
  const [observations, setObservations] = useState<Obs[]>([blank()]);
  const [photos, setPhotos] = useState<Record<number, LocalScoutingPhoto[]>>({});
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [gps, setGps] = useState<GpsAccuracyAssessment | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [message, setMessage] = useState('Field selection requires your confirmation.');
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [queued, setQueued] = useState<LocalScoutingDraft[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listScoutingDrafts(namespace).then(setQueued).catch(() => undefined); }, [namespace]);

  // Scroll the error summary into view on mobile when a blocking error appears.
  useEffect(() => { if (conditionError || feedback) summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [conditionError, feedback]);

  const update = (i: number, p: Partial<Obs>) => setObservations((rows) => rows.map((r, n) => (n === i ? { ...r, ...p } : r)));
  const addPhotos = (i: number, files: FileList | null) => {
    if (!files) return;
    const add = [...files].slice(0, 5 - (photos[i]?.length ?? 0)).map((file) => ({ localPhotoId: crypto.randomUUID(), localObservationId: '', idempotencyKey: crypto.randomUUID(), file, name: file.name, mimeType: file.type, size: file.size, capturedAt: new Date().toISOString(), annotations: [], status: 'local_only' as const }));
    setPhotos((p) => ({ ...p, [i]: [...(p[i] ?? []), ...add] }));
  };
  const annotate = (i: number, pi: number, label: string) => setPhotos((all) => ({ ...all, [i]: (all[i] ?? []).map((p, n) => (n === pi ? { ...p, annotations: label ? [{ id: crypto.randomUUID(), type: 'point', x: .5, y: .5, label }] : [] } : p)) }));

  // GPS with an explicit accuracy policy — a coarse fix is never silently
  // treated as reliable field evidence (see lib/scouting/gps-accuracy).
  function locate() {
    if (!navigator.geolocation) { setGps(classifyGpsAccuracy(null)); setMessage('Location unavailable. Select the field manually.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const assessment = classifyGpsAccuracy(p.coords.accuracy);
        setGps(assessment);
        setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy });
        setLocationConfirmed(false);
        setMessage(assessment.message);
      },
      () => { setLocating(false); setGps(null); setLocation(null); setMessage('Location denied or unavailable. Select the field manually.'); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  // Only attach coordinates as evidence when the fix is precise enough, or the
  // farmer has explicitly confirmed a low-accuracy point. Accuracy is always
  // persisted alongside the coordinates that are stored.
  const needsLocationConfirm = Boolean(location) && Boolean(gps) && !gps!.usableForFieldSuggestion && !locationConfirmed;

  function submit(fd: FormData) {
    const conditionCheck = validateCropCondition(overallCondition);
    if (!conditionCheck.ok) { setConditionError(conditionCheck.message); setFeedback(''); return; }
    setConditionError(null);
    setFeedback('');
    const canonicalCondition = conditionCheck.value as CropCondition; // non-null: validated above
    const evidence = buildLocationEvidence(location, gps, locationConfirmed);
    start(async () => {
      const localVisitId = crypto.randomUUID();
      const now = new Date().toISOString();
      const localObs = observations.map((o, i) => {
        const localObservationId = crypto.randomUUID();
        return { localObservationId, idempotencyKey: crypto.randomUUID(), category: o.category, issueType: o.issueType, severity: o.severity, affectedPercent: o.affectedPercent ? Number(o.affectedPercent) : undefined, description: o.description, photos: (photos[i] ?? []).map((p) => ({ ...p, localObservationId, status: 'waiting_to_upload' as const })) };
      });
      const draft: LocalScoutingDraft = { localVisitId, localDraftId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), namespace, farmId, userRef, fieldSeasonId, visitDate: String(fd.get('visitDate')), stageCode: String(fd.get('stageCode') || '') || undefined, stageLabel: String(fd.get('stageLabel') || '') || undefined, overallCondition: canonicalCondition, notes: String(fd.get('notes') || ''), observations: localObs, createdAt: now, updatedAt: now, schemaVersion: 1, syncStatus: navigator.onLine ? 'syncing' : 'ready_to_sync' };
      if (!navigator.onLine) { await putScoutingDraft(draft); setQueued(await listScoutingDrafts(namespace)); return setFeedback('Saved locally. Photos exist only on this device until explicit synchronization.'); }
      const result = await createScoutingVisit({ localVisitId, fieldSeasonId, visitDate: draft.visitDate, overallCondition: canonicalCondition, notes: draft.notes || undefined, stageSystem: 'BBCH', stageCode: draft.stageCode, stageLabel: draft.stageLabel, latitude: evidence?.latitude, longitude: evidence?.longitude, locationAccuracyM: evidence?.locationAccuracyM, observations: observations.map((o) => ({ ...o, affectedPercent: o.affectedPercent ? Number(o.affectedPercent) : undefined, certainty: 'symptom_observed', confidence: 'medium' })) });
      if (result.error) return setFeedback(result.error);
      draft.serverVisitId = result.id;
      draft.syncStatus = 'partially_synced';
      for (let i = 0; i < draft.observations.length; i++) {
        draft.observations[i].serverObservationId = result.observationIds?.[i];
        for (const photo of draft.observations[i].photos) {
          photo.status = 'uploading';
          const body = new FormData();
          body.set('observationId', draft.observations[i].serverObservationId ?? '');
          body.set('localPhotoId', photo.localPhotoId);
          body.set('photo', photo.file, photo.name);
          body.set('annotations', JSON.stringify(photo.annotations));
          try {
            const res = await fetch('/api/scouting/photos', { method: 'POST', body });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            photo.status = 'uploaded';
            photo.serverPhotoId = json.photoId;
          } catch (e) {
            photo.status = 'failed';
            photo.error = e instanceof Error ? e.message : 'Upload failed';
            await putScoutingDraft(draft);
            setQueued(await listScoutingDrafts(namespace));
            return setFeedback('Visit saved; failed photo remains on this device for safe retry.');
          }
        }
      }
      draft.syncStatus = 'synced';
      await putScoutingDraft(draft);
      router.push(`/scouting?visit=${result.id}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className={styles.form}>
      {(conditionError || feedback) && (
        <div className={styles.error} role="alert" ref={summaryRef}>
          {conditionError && <p>{conditionError}</p>}
          {feedback && <p>{feedback}</p>}
        </div>
      )}
      <div className={styles.grid}>
        <label>{t('form.fieldAndCrop')}
          <select value={fieldSeasonId} onChange={(e) => setFieldSeasonId(e.target.value)} required>
            {fields.map((f) => <option key={f.fieldSeasonId} value={f.fieldSeasonId}>{f.fieldName} · {f.crop.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label>{t('form.visitDate')}
          <input name="visitDate" type="datetime-local" defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} required />
        </label>
        <label>{t('form.overallCondition')}
          {/* Option `value` is the canonical English enum; the label is
              localizable. Browser page-translation may change the visible label
              but never the submitted value. */}
          <select value={overallCondition} onChange={(e) => setOverallCondition(e.target.value as CropCondition)}>
            {CROP_CONDITIONS.map((c) => <option key={c} value={c}>{conditionLabelFor(c)}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.location}>
        <button type="button" className={styles.secondary} onClick={locate} disabled={locating}>{locating ? t('form.locating') : t('form.useGps')}</button>
        {gps && !gps.usableForFieldSuggestion && <button type="button" className={styles.secondary} onClick={locate} disabled={locating}>{t('form.retryLocation')}</button>}
        <span role="status">{message}</span>
      </div>
      {needsLocationConfirm && (
        <label className={styles.notice} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={locationConfirmed} onChange={(e) => setLocationConfirmed(e.target.checked)} style={{ width: 'auto', marginTop: '3px' }} />
          <span>This location is low accuracy (±{Math.round(gps!.accuracyM)} m) and will not auto-identify a field. Attach it anyway and select the field manually below.</span>
        </label>
      )}
      <fieldset>
        <legend>{t('form.growthStageLegend')}</legend>
        <p className={styles.help}>{t('form.growthStageHelp')}</p>
        <div className={styles.grid}>
          <label>{t('form.bbchCode')}<input name="stageCode" maxLength={2} /></label>
          <label>{t('form.humanLabel')}<input name="stageLabel" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('form.observationsLegend')}</legend>
        {observations.map((o, i) => (
          <div className={styles.observation} key={i}>
            <div className={styles.grid}>
              <label>{t('form.category')}
                <select value={o.category} onChange={(e) => update(i, { category: e.target.value as Obs['category'] })}>
                  {OBSERVATION_CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label>{t('form.observedIssue')}<input value={o.issueType} onChange={(e) => update(i, { issueType: e.target.value })} /></label>
              <label>{t('form.severity')}
                <select value={o.severity} onChange={(e) => update(i, { severity: e.target.value as Severity })}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{severityLabelFor(s)}</option>)}
                </select>
              </label>
              <label>{t('form.affectedArea')}<input type="number" min="0" max="100" value={o.affectedPercent} onChange={(e) => update(i, { affectedPercent: e.target.value })} /></label>
            </div>
            <label>{t('form.description')}<textarea value={o.description} onChange={(e) => update(i, { description: e.target.value })} required /></label>
            <label>{t('form.takePhoto')}<input aria-label={`Photos for observation ${i + 1}`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(e) => addPhotos(i, e.target.files)} /></label>
            <div className={styles.photoGrid}>
              {(photos[i] ?? []).map((p, pi) => (
                <div className={styles.photoCard} key={p.localPhotoId}>
                  <img src={URL.createObjectURL(p.file)} alt={`Local scouting preview ${pi + 1}`} />
                  <small>{Math.round(p.size / 1024)} KB · Local only · {p.annotations.length} annotation(s)</small>
                  <label>{t('form.pointAnnotation')}<input aria-label={`Annotation for photo ${pi + 1}`} placeholder={t('form.annotationPlaceholder')} onBlur={(e) => annotate(i, pi, e.target.value)} /></label>
                  {p.annotations.map((a) => <span key={a.id}>{a.type}: {a.label}</span>)}
                  <button type="button" className={styles.link} onClick={() => setPhotos((all) => ({ ...all, [i]: (all[i] ?? []).filter((_, n) => n !== pi) }))}>{t('form.removeBeforeSave')}</button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className={styles.secondary} onClick={() => setObservations((r) => [...r, blank()])}>{t('form.addObservation')}</button>
      </fieldset>
      <label>{t('form.visitNotes')}<textarea name="notes" /></label>
      <div className={styles.notice}>{t('form.privacyNotice')}</div>
      {queued.some((d) => d.syncStatus !== 'synced') && <div className={styles.notice}>{queued.filter((d) => d.syncStatus !== 'synced').length} local visit(s) await sync/retry. JSON recovery excludes photo binaries.</div>}
      <button className={styles.primary} disabled={pending}>{pending ? t('form.saving') : t('form.reviewSave')}</button>
    </form>
  );
}
