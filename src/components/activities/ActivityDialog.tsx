'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { ActivityFormState } from '@/lib/actions/activities';
import { createMachine } from '@/lib/actions/machines';
import { evaluateSpraySuitability } from '@/lib/actions/spray-suitability';
import type { SpraySuitabilityResult } from '@/lib/actions/spray-suitability';
import { CtgbSourceNote } from '@/components/disclaimers/CtgbSourceNote';
import type {
  FieldSeasonOption,
  ProductOption,
  MachineOption,
  WeatherSnapshot,
  RecentActivityContext,
} from '@/lib/activity-form-context';
import { computeStockPreview, composeScoutingNotes } from '@/lib/activity-form-logic';
import { findFieldContainingPoint } from '@/lib/geo';
import { useOffline } from '@/offline/OfflineProvider';
import { applyDraftToForm, createLocalDraft, createSplitActivityDrafts, draftAge, formDataToRecord } from '@/offline/drafts';
import type { LocalActivityDraft, OfflineActivityType } from '@/offline/types';
import styles from './ActivityDialog.module.css';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildSprayWindowDisplayModel } from '@/i18n/adapters/spray-window';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import { userError, type UserFacingError } from '@/lib/user-error';
import { isSafeErrorCode } from '@/i18n/error-codes';

type QuickType = 'spray' | 'fertilise' | 'sow' | 'tillage' | 'scout' | 'harvest' | 'other';
const OTHER_SUB_TYPES = ['irrigate', 'soil_sample', 'other'] as const;

const TYPE_TILES: { key: QuickType; label: string; icon: string; dbType: string }[] = [
  { key: 'spray', label: 'Spraying', icon: '◉', dbType: 'spray' },
  { key: 'fertilise', label: 'Fertilising', icon: '◎', dbType: 'fertilise' },
  { key: 'sow', label: 'Sowing', icon: '◦', dbType: 'sow' },
  { key: 'tillage', label: 'Tillage', icon: '▣', dbType: 'tillage' },
  { key: 'scout', label: 'Scouting', icon: '👁', dbType: 'scout' },
  { key: 'harvest', label: 'Harvesting', icon: '▽', dbType: 'harvest' },
  { key: 'other', label: 'Other', icon: '⋯', dbType: 'other' },
];

const CROP_PROTECTION_CATEGORIES = new Set(['herbicide', 'fungicide', 'insecticide']);
const SCOUT_CATEGORIES = ['Disease', 'Pest', 'Weed pressure', 'Nutrient deficiency', 'Water stress', 'Other'];
const SCOUT_SEVERITIES = ['Low', 'Moderate', 'High'];
const NOZZLE_OPTIONS = [
  { value: 'flat_fan', label: 'Flat fan' },
  { value: 'air_inclusion', label: 'Air inclusion' },
  { value: 'deflector', label: 'Deflector' },
  { value: 'twin_fluid', label: 'Twin fluid' },
  { value: 'rotary', label: 'Rotary' },
  { value: 'other', label: 'Other' },
];

interface Props {
  fieldSeasons: FieldSeasonOption[];
  products: ProductOption[];
  machines: MachineOption[];
  defaultFieldSeasonId?: string;
  recentOperatorName?: string | null;
  recentMachineId?: string | null;
  weather?: WeatherSnapshot | null;
  repeatFrom?: RecentActivityContext | null;
  initialType?: QuickType;
  workOrderId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type AIParseResult = {
  candidate: { activityType: string | null; fieldText: string | null; productText: string | null; dose: number | null; areaHa: number | null; machineText: string | null; notes: string | null; multipleActivities: boolean; unsupportedRequest: boolean };
  resolution: {
    field: { confidence: string; id: string | null; options: { id: string; name: string }[] };
    product: { confidence: string; id: string | null; options: { id: string; name: string }[] };
    machine: { confidence: string; id: string | null; options: { id: string; name: string }[] };
  };
  workOrders: { workOrderId: string; version: number; title: string; status: 'strong_match' | 'possible_match' | 'conflict'; totalScore: number; materialConflicts: string[]; evidence: { field: string; expected: string | number | null; described: string | number | null; result: string }[] }[];
  multiActivity: { classification: 'single_activity' | 'multiple_activities' | 'ambiguous'; candidates: { index: number; originalTextSpan: string; activityType: OfflineActivityType | null; fieldText: string | null; productText: string | null; unresolvedFields: string[] }[]; truncated: boolean };
  mode: 'grounded_ai' | 'rule_based';
};

type AIParseErrorResult = { ok: false; error: UserFacingError };

function safeApiError(body: unknown, status: number): UserFacingError {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as AIParseErrorResult).error;
    if (error && typeof error === 'object' && isSafeErrorCode(error.code)) {
      const correlationId = typeof error.correlationId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(error.correlationId)
        ? error.correlationId
        : undefined;
      return userError(error.code, { field: typeof error.field === 'string' ? error.field : undefined, correlationId });
    }
  }
  return userError(status === 401 || status === 403 ? 'AUTH_REQUIRED' : status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INVALID_VALUE');
}

export function ActivityDialog({
  fieldSeasons,
  products,
  machines,
  defaultFieldSeasonId,
  recentOperatorName,
  recentMachineId,
  weather,
  repeatFrom,
  initialType,
  workOrderId,
  onClose,
  onSuccess,
}: Props) {
  const offline = useOffline();
  const locale = useLocale();
  const sprayT = useTranslations('fields');
  const errorT = useTranslations('errors');
  const [state, setState] = useState<ActivityFormState>({});
  const [isPending, setIsPending] = useState(false);
  const [localResult, setLocalResult] = useState<'synced' | 'queued' | null>(null);
  const [localSaveStatus, setLocalSaveStatus] = useState<string | null>(null);
  const [activityText, setActivityText] = useState('');
  const [aiParse, setAiParse] = useState<AIParseResult | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<UserFacingError | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [linkedWorkOrder, setLinkedWorkOrder] = useState<{ id: string; version: number; title: string } | null>(workOrderId ? { id: workOrderId, version: 1, title: 'Selected WorkOrder' } : null);
  const speechRef = useRef<{ stop(): void; abort?(): void } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const draftRef = useRef<LocalActivityDraft | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against the autosave feedback loop: while a restored draft is being
  // applied to the DOM, `applyDraftToForm` synthetically dispatches bubbling
  // input/change events. Without this flag those events re-enter
  // handleMeaningfulChange → saveDraft → refresh → re-render, which under an
  // external DOM-mutation agent (browser page-translation) can drive an
  // unbounded update loop. `lastSnapshotRef` additionally makes autosave
  // idempotent: an identical form snapshot never triggers another write.
  const applyingDraftRef = useRef(false);
  const lastSnapshotRef = useRef<string>('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);
  const displayError = (error: UserFacingError) => buildUserErrorDisplayModel({ translator: errorT, locale, error }).message;
  const fieldError = (field: string) => state.fieldErrors?.[field] ? displayError(state.fieldErrors[field]) : null;

  type Mode = 'type-select' | 'form' | 'success';
  const [mode, setMode] = useState<Mode>(initialType || repeatFrom ? 'form' : 'type-select');

  // This dialog renders with a static `open` attribute rather than calling
  // .showModal() (kept as a plain flow element so the overlay div can
  // control backdrop-click-to-close) — which means the browser does NOT
  // supply the native modal behaviors real users rely on: no Escape-to-
  // close, no focus trap. Found via Sprint 12's accessibility pass and
  // implemented by hand here instead.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    // Move initial focus into the dialog so Tab-cycling starts there, not
    // wherever focus happened to be on the page behind it.
    dialogRef.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const [quickType, setQuickType] = useState<QuickType>(
    initialType ?? (repeatFrom ? (OTHER_SUB_TYPES as readonly string[]).includes(repeatFrom.type) ? 'other' : (repeatFrom.type as QuickType) : 'spray'),
  );
  const [otherSubType, setOtherSubType] = useState<string>(
    repeatFrom && (OTHER_SUB_TYPES as readonly string[]).includes(repeatFrom.type) ? repeatFrom.type : 'other',
  );

  const [fieldSeasonId, setFieldSeasonId] = useState(defaultFieldSeasonId ?? repeatFrom?.fieldSeasonId ?? '');
  const [areaHa, setAreaHa] = useState('');
  const [productId, setProductId] = useState(repeatFrom?.productId ?? '');
  const [dosePerHa, setDosePerHa] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [operatorName, setOperatorName] = useState(recentOperatorName ?? '');
  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nozzleType, setNozzleType] = useState('');

  // Sprint 16 — wires the real spray-window engine into the moment it
  // matters: evaluating this specific field/product/operator/machine/date,
  // not just a generic weather glance. Debounced so it doesn't fire on
  // every keystroke, and only ever runs for spray (the only type this
  // engine models).
  const [suitability, setSuitability] = useState<SpraySuitabilityResult | null>(null);
  const [suitabilityLoading, setSuitabilityLoading] = useState(false);
  const sprayDisplay = suitability?.success ? buildSprayWindowDisplayModel(sprayT, locale, suitability.summary) : null;
  // Sprint 18 Part 7 — explicit selection of the intended official Ctgb
  // use, when a product has more than one. Reset whenever the product
  // changes so a stale index from a previous product is never reused.
  const [selectedCtgbUseIndex, setSelectedCtgbUseIndex] = useState<number | undefined>(undefined);

  // Sprint 12 fix: there was no way anywhere in the product to create a
  // sprayer, yet spraying requires selecting one — this is the minimal
  // inline escape hatch, not a full machines module.
  const [localMachines, setLocalMachines] = useState<MachineOption[]>(machines);
  const [machineId, setMachineId] = useState(repeatFrom?.machineId ?? recentMachineId ?? '');
  const [addingMachine, setAddingMachine] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [machineError, setMachineError] = useState<UserFacingError | null>(null);
  const machineErrorDisplay = machineError ? buildUserErrorDisplayModel({ translator: errorT, locale, error: machineError }) : null;
  const [creatingMachine, setCreatingMachine] = useState(false);

  async function handleAddMachine() {
    if (!newMachineName.trim()) return;
    setCreatingMachine(true);
    setMachineError(null);
    const result = await createMachine(newMachineName.trim(), 'sprayer');
    setCreatingMachine(false);
    if (!result.success) {
      setMachineError(result.error);
      return;
    }
    setLocalMachines((prev) => [...prev, { id: result.machineId, name: result.name }]);
    setMachineId(result.machineId);
    setAddingMachine(false);
    setNewMachineName('');
  }

  // Scouting-only fields — folded into `notes` at submit time since the
  // Activity schema has no dedicated columns for these (see Sprint 11
  // report: adding them would need a real migration, not invented here).
  const [scoutCategory, setScoutCategory] = useState(SCOUT_CATEGORIES[0]);
  const [scoutSeverity, setScoutSeverity] = useState(SCOUT_SEVERITIES[0]);
  const [scoutAffectedHa, setScoutAffectedHa] = useState('');
  const [userNotes, setUserNotes] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`farmos:activity-language-draft:${offline.namespace}`);
    if (saved) setActivityText(saved);
  }, [offline.namespace]);

  function updateActivityText(value: string) {
    setActivityText(value);
    localStorage.setItem(`farmos:activity-language-draft:${offline.namespace}`, value);
  }

  async function parseActivityDescription() {
    if (!navigator.onLine) {
      setAiError(userError('AI_REQUIRES_CONNECTION'));
      return;
    }
    setAiParsing(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/activity-parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: activityText }) });
      const body = await response.json() as AIParseResult | AIParseErrorResult;
      if (!response.ok) {
        setAiError(safeApiError(body, response.status));
        return;
      }
      const parsed = body as AIParseResult;
      setAiParse(parsed);
      if (parsed.candidate.multipleActivities || parsed.candidate.unsupportedRequest) { setAiError(userError('INVALID_VALUE')); return; }
      const type = parsed.candidate.activityType as QuickType | null;
      if (type && TYPE_TILES.some((tile) => tile.key === type)) setQuickType(type);
      if (parsed.resolution.field.id) handleFieldChange(parsed.resolution.field.id);
      if (parsed.resolution.product.id) setProductId(parsed.resolution.product.id);
      if (parsed.resolution.machine.id) setMachineId(parsed.resolution.machine.id);
      if (parsed.candidate.dose) setDosePerHa(String(parsed.candidate.dose));
      if (parsed.candidate.areaHa) setAreaHa(String(parsed.candidate.areaHa));
      setUserNotes(parsed.candidate.notes ?? activityText);
    } catch {
      setAiError(userError('PROVIDER_UNAVAILABLE'));
    } finally { setAiParsing(false); }
  }

  function startVoiceTranscript() {
    type Recognition = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!Ctor) { setAiError(userError('OFFLINE_UNAVAILABLE')); return; }
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'nl-NL';
    recognition.onresult = (event) => updateActivityText(event.results[0]?.[0]?.transcript ?? activityText);
    recognition.onend = () => { setRecording(false); speechRef.current = null; };
    recognition.onerror = () => { setRecording(false); setAiError(userError('PROVIDER_UNAVAILABLE')); };
    setRecording(true);
    setRecordingSeconds(0);
    speechRef.current = recognition;
    recognition.start();
    window.setTimeout(() => { recognition.stop(); setRecording(false); }, 60_000);
  }

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  function stopVoiceTranscript(cancel = false) {
    // Idempotent: null the ref BEFORE calling stop()/abort() so the recognizer's
    // own onend handler (which also nulls the ref) can't re-enter this path, and
    // a second Stop/Cancel/Delete click is a harmless no-op.
    const recognition = speechRef.current;
    speechRef.current = null;
    setRecording(false);
    if (!recognition) return;
    if (cancel) recognition.abort?.(); else recognition.stop();
  }

  function clearActivityTranscript() {
    stopVoiceTranscript(true); setActivityText(''); setAiParse(null); setAiError(null);
    localStorage.removeItem(`farmos:activity-language-draft:${offline.namespace}`);
  }

  async function createSeparateLocalDrafts() {
    if (!aiParse || aiParse.multiActivity.classification !== 'multiple_activities') return;
    const candidates = aiParse.multiActivity.candidates.filter((candidate): candidate is typeof candidate & { activityType: OfflineActivityType } => candidate.activityType != null);
    const drafts = createSplitActivityDrafts({ userRef: offline.userRef, farmId: offline.farmId }, candidates.map((candidate) => ({ activityType: candidate.activityType, originalTextSpan: candidate.originalTextSpan, formData: { type: candidate.activityType, notes: candidate.originalTextSpan } })));
    for (const draft of drafts) await offline.saveDraft(draft);
    setLocalSaveStatus(`${drafts.length} separate local drafts created. Each remains unreviewed and must be confirmed independently.`);
  }

  useEffect(() => {
    if ((state.error || state.fieldErrors) && errorBannerRef.current) {
      errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      errorBannerRef.current.focus();
    } else if (state.error || state.fieldErrors) {
      overlayRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.error, state.fieldErrors]);

  const today = new Date().toISOString().slice(0, 10);
  const hasValidationErrors = Boolean(state.error) || Boolean(state.fieldErrors && Object.keys(state.fieldErrors).length > 0);

  const selectedFieldSeason = fieldSeasons.find((fs) => fs.id === fieldSeasonId);
  const selectedProduct = products.find((p) => p.id === productId);

  function handleFieldChange(id: string) {
    setFieldSeasonId(id);
    const fs = fieldSeasons.find((f) => f.id === id);
    if (fs) setAreaHa(String(fs.hectares));
  }

  // GPS auto-select — the same field geometry already drawn/imported for
  // the map (fields/map/page.tsx), just consumed here instead. Never
  // required: a field with no boundary, or a location outside every known
  // boundary, just falls back to the manual dropdown with a plain message,
  // never an error.
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  function handleUseLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationMessage('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const match = findFieldContainingPoint(position.coords.longitude, position.coords.latitude, fieldSeasons);
        if (match) {
          handleFieldChange(match.id);
          setLocationMessage(`Selected ${match.fieldName} from your current location.`);
        } else {
          setLocationMessage('Your current location does not match any field boundary — select the field manually.');
        }
      },
      () => {
        setLocating(false);
        setLocationMessage('Could not get your location — check your browser or device location permission.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Suggest the field already selected once, if any, but never force it —
  // area still needs a real field pick to prefill from.
  useEffect(() => {
    if (fieldSeasonId && !areaHa) {
      const fs = fieldSeasons.find((f) => f.id === fieldSeasonId);
      if (fs) setAreaHa(String(fs.hectares));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dbType = quickType === 'other' ? otherSubType : TYPE_TILES.find((t) => t.key === quickType)!.dbType;
  const isSpray = quickType === 'spray';
  const isFertilise = quickType === 'fertilise';
  const isScout = quickType === 'scout';

  const relevantProducts = useMemo(() => {
    if (isSpray) return products.filter((p) => CROP_PROTECTION_CATEGORIES.has(p.category));
    if (isFertilise) return products.filter((p) => p.category === 'fertiliser');
    return products;
  }, [products, isSpray, isFertilise]);

  // Client-side stock preview — computed from data already on the page,
  // no server round-trip needed just to show this before submit.
  const stockPreview = useMemo(
    () => computeStockPreview(selectedProduct?.currentStock, dosePerHa, areaHa),
    [selectedProduct, dosePerHa, areaHa],
  );

  const combinedNotes = isScout
    ? composeScoutingNotes({ category: scoutCategory, severity: scoutSeverity, affectedHa: scoutAffectedHa, userNotes })
    : userNotes;

  useEffect(() => {
    if (draftRef.current || mode === 'success') return;
    const draft = [...offline.drafts].reverse().find((d) => ['draft', 'ready_to_sync', 'failed', 'conflict', 'needs_review'].includes(d.status) && Object.keys(d.formData).length > 0);
    if (!draft) return;
    draftRef.current = draft;
    const data = draft.formData;
    const restoredType = data.type as QuickType;
    if (TYPE_TILES.some((t) => t.key === restoredType)) setQuickType(restoredType);
    else if ((OTHER_SUB_TYPES as readonly string[]).includes(data.type)) { setQuickType('other'); setOtherSubType(data.type); }
    setFieldSeasonId(data.fieldSeasonId ?? ''); setAreaHa(data.areaHa ?? ''); setProductId(data.productId ?? '');
    setDosePerHa(data.dosePerHa ?? ''); setOperatorName(data.operatorName ?? ''); setActivityDate(data.date ?? new Date().toISOString().slice(0, 10));
    setNozzleType(data.nozzleType ?? ''); setMachineId(data.machineId ?? ''); setUserNotes(data.notes ?? '');
    setMode('form');
    setLocalSaveStatus(`Restored draft saved on this device ${draftAge(draft.updatedAt)}`);
    lastSnapshotRef.current = JSON.stringify(draft.formData);
    setTimeout(() => {
      if (!formRef.current) return;
      // Flag the synthetic input/change dispatches so handleMeaningfulChange
      // ignores them (see applyingDraftRef). dispatchEvent is synchronous, so
      // the flag is safely cleared immediately afterwards.
      applyingDraftRef.current = true;
      try { applyDraftToForm(draft, formRef.current); } finally { applyingDraftRef.current = false; }
    }, 0);
  }, [mode, offline.drafts]);

  function snapshotForm(status = 'completed'): LocalActivityDraft | null {
    if (!formRef.current) return null;
    const form = new FormData(formRef.current);
    form.set('status', status);
    form.set('notes', combinedNotes);
    return createLocalDraft(
      { userRef: offline.userRef, farmId: offline.farmId },
      dbType as OfflineActivityType,
      formDataToRecord(form),
      draftRef.current ?? undefined,
    );
  }

  function handleMeaningfulChange() {
    // Synthetic events fired while restoring a draft must not schedule a save —
    // that is the feedback loop external DOM translation can otherwise amplify.
    if (applyingDraftRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setLocalSaveStatus('Saving on this device…');
    autosaveTimer.current = setTimeout(async () => {
      const draft = snapshotForm();
      if (!draft) return;
      // Idempotency guard: an identical snapshot never triggers another write
      // (and therefore no refresh → re-render → re-translate cycle).
      const fingerprint = JSON.stringify(draft.formData);
      if (fingerprint === lastSnapshotRef.current) { setLocalSaveStatus('Saved on this device'); return; }
      lastSnapshotRef.current = fingerprint;
      draftRef.current = draft;
      await offline.saveDraft(draft);
      setLocalSaveStatus('Saved on this device');
    }, 600);
  }

  async function handleOfflineSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value === 'planned' ? 'planned' : 'completed';
    const draft = snapshotForm(status);
    if (!draft) return;
    const errors: Record<string, UserFacingError> = {};
    if (!draft.formData.fieldSeasonId) errors.fieldSeasonId = userError('REQUIRED_FIELD', { field: 'fieldSeasonId' });
    if (!draft.formData.areaHa || Number(draft.formData.areaHa) <= 0) errors.areaHa = userError('INVALID_QUANTITY', { field: 'areaHa' });
    if (isSpray) {
      if (!draft.formData.operatorName) errors.operatorName = userError('REQUIRED_FIELD', { field: 'operatorName' });
      if (!draft.formData.machineId) errors.machineId = userError('REQUIRED_FIELD', { field: 'machineId' });
      if (!draft.formData.nozzleType) errors.nozzleType = userError('REQUIRED_FIELD', { field: 'nozzleType' });
      if (!draft.formData.productId) errors.productId = userError('REQUIRED_FIELD', { field: 'productId' });
      if (!draft.formData.dosePerHa) errors.dosePerHa = userError('REQUIRED_FIELD', { field: 'dosePerHa' });
      if (!draft.formData.waterVolumePerHa) errors.waterVolumePerHa = userError('REQUIRED_FIELD', { field: 'waterVolumePerHa' });
    }
    if (Object.keys(errors).length) { setState({ fieldErrors: errors }); return; }
    setState({}); setIsPending(true); draftRef.current = draft;
    const result = await offline.queueDraft(draft);
    setIsPending(false);
    setLocalResult(result.status === 'synced' ? 'synced' : 'queued');
    if (result.status === 'conflict') {
      const code = result.safeErrorCategory === 'authorization' ? 'NOT_FOUND'
        : result.safeErrorCategory === 'insufficient_stock' ? 'INSUFFICIENT_STOCK'
          : result.safeErrorCategory === 'validation' || result.safeErrorCategory === 'schema' ? 'INVALID_VALUE'
            : 'SYNC_CONFLICT';
      setState({ error: userError(code) });
      return;
    }
    setMode('success');
  }

  async function discardCurrentDraft() {
    if (draftRef.current) await offline.discard(draftRef.current.localDraftId);
    draftRef.current = null;
    setLocalSaveStatus(null);
    onClose();
  }

  // Debounced real suitability check — only meaningful once the inputs the
  // engine actually uses are present. Deliberately does not block or
  // disable "Save activity" on the result: live weather is inherently
  // variable (a wind gust that clears a threshold five minutes from now is
  // not a defect), so this surfaces the same hard-blocker/warning
  // distinction the engine itself already enforces without making the
  // save button flaky against real conditions.
  useEffect(() => {
    if (!isSpray || !fieldSeasonId || !areaHa || offline.connectivity !== 'online') {
      setSuitability(null);
      return;
    }
    setSuitabilityLoading(true);
    const handle = setTimeout(() => {
      evaluateSpraySuitability({
        fieldSeasonId,
        productId: productId || undefined,
        machineId: machineId || undefined,
        nozzleType: nozzleType || undefined,
        operatorName: operatorName || undefined,
        areaHa: areaHa ? Number(areaHa) : undefined,
        dosePerHa: dosePerHa ? Number(dosePerHa) : undefined,
        doseUnit: selectedProduct?.unit,
        date: activityDate,
        selectedCtgbUseIndex,
      })
        .then(setSuitability)
        .catch(() => setSuitability({ success: false, error: 'Could not check spray suitability right now.' }))
        .finally(() => setSuitabilityLoading(false));
    }, 500);
    return () => clearTimeout(handle);
  }, [isSpray, fieldSeasonId, productId, machineId, nozzleType, operatorName, areaHa, dosePerHa, activityDate, selectedProduct, selectedCtgbUseIndex, offline.connectivity]);

  // A different product may have a completely different use list — never
  // carry a stale index across a product change.
  useEffect(() => {
    setSelectedCtgbUseIndex(undefined);
  }, [productId]);

  function selectType(key: QuickType) {
    setQuickType(key);
    setMode('form');
  }

  function resetForAnother() {
    setMode('type-select');
    setFieldSeasonId('');
    setAreaHa('');
    setProductId('');
    setDosePerHa('');
    setUserNotes('');
    setScoutCategory(SCOUT_CATEGORIES[0]);
    setScoutSeverity(SCOUT_SEVERITIES[0]);
    setScoutAffectedHa('');
  }

  return (
    <div className={styles.overlay} onClick={onClose} ref={overlayRef}>
      <dialog ref={dialogRef} className={styles.dialog} open aria-labelledby="activity-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 id="activity-dialog-title" className={styles.title}>
              {mode === 'type-select' ? 'What did you do?' : mode === 'success' ? 'Activity recorded' : TYPE_TILES.find((t) => t.key === quickType)?.label}
            </h2>
            {mode === 'form' && isSpray && (
              <div className={styles.subtitle}>EU Directive 2009/128/EC · Dutch RVO compliant</div>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close">×</button>
        </div>

        {/* ── Step 1: type picker ── */}
        {mode === 'type-select' && (
          <div className={styles.body}>
            <section className={styles.languageEntry} aria-labelledby="describe-activity-title">
              <div className={styles.languageHeader}>
                <div>
                  <h3 id="describe-activity-title">Describe what you did</h3>
                  <p>AI suggests a draft. You review and confirm every value; compliance blockers always win.</p>
                </div>
                <span className={styles.draftBadge}>Draft only</span>
              </div>
              <textarea className={styles.textarea} value={activityText} onChange={(event) => updateActivityText(event.target.value)} placeholder="Sprayed North Field with Amistar Opti at 2 litres per hectare over 10 hectares this morning using Sprayer 1." rows={4} />
              <div className={styles.languageActions}>
                <Button type="button" variant="primary" loading={aiParsing} disabled={activityText.trim().length < 3 || offline.connectivity !== 'online'} onClick={() => void parseActivityDescription()}>Parse into reviewed draft</Button>
                {!recording && <Button type="button" variant="secondary" onClick={startVoiceTranscript}>Use microphone</Button>}
                {recording && <><Button type="button" variant="secondary" onClick={() => stopVoiceTranscript(false)}>Stop ({recordingSeconds}s)</Button><Button type="button" variant="danger" onClick={() => stopVoiceTranscript(true)}>Cancel recording</Button></>}
                {activityText && <Button type="button" variant="ghost" onClick={clearActivityTranscript}>Delete transcript</Button>}
              </div>
              {recording && <p className={styles.recordingStatus} role="status">Recording is visible and temporary. Cancel browser permission to stop; raw audio is not stored.</p>}
              {offline.connectivity !== 'online' && <p className={styles.aiError}>AI parsing requires an internet connection. Your description is saved on this device.</p>}
              {aiError && <p className={styles.aiError} role="alert">{displayError(aiError)}</p>}
              {aiParse?.resolution.field.confidence === 'ambiguous' && (
                <div className={styles.ambiguity}>
                  <p>I found more than one possible field. Choose one:</p>
                  {aiParse.resolution.field.options.map((option) => <Button key={option.id} type="button" variant="secondary" onClick={() => { handleFieldChange(option.id); setAiParse({ ...aiParse, resolution: { ...aiParse.resolution, field: { ...aiParse.resolution.field, id: option.id, confidence: 'exact_match' } } }); }}>{option.name}</Button>)}
                </div>
              )}
              {aiParse?.multiActivity.classification === 'multiple_activities' && <div className={styles.ambiguity}>
                <p>This description appears to contain multiple activities. They will never be merged or bulk-submitted.</p>
                <ol>{aiParse.multiActivity.candidates.map((candidate) => <li key={candidate.index}>{candidate.originalTextSpan} — {candidate.activityType ?? 'unresolved type'}</li>)}</ol>
                {aiParse.multiActivity.truncated && <p>Only the first five operations can become drafts. Edit the description to handle the rest.</p>}
                <Button type="button" variant="secondary" onClick={() => void createSeparateLocalDrafts()}>Create separate drafts</Button>
                <Button type="button" variant="ghost" onClick={() => setAiParse(null)}>Edit description</Button>
              </div>}
              {aiParse && <div className={styles.structuredReview}>
                <h4>Structured suggestion review</h4>
                {[
                  ['Activity type', aiParse.candidate.activityType, aiParse.candidate.activityType ? 'Suggested' : 'Missing required'],
                  ['Field / crop season', aiParse.resolution.field.options.find((option) => option.id === aiParse.resolution.field.id)?.name ?? aiParse.candidate.fieldText, aiParse.resolution.field.confidence],
                  ['Product', aiParse.resolution.product.options.find((option) => option.id === aiParse.resolution.product.id)?.name ?? aiParse.candidate.productText, aiParse.resolution.product.confidence],
                  ['Dose', aiParse.candidate.dose, aiParse.candidate.dose ? 'Suggested' : 'Unresolved'],
                  ['Area', aiParse.candidate.areaHa, aiParse.candidate.areaHa ? 'Suggested' : 'Missing required'],
                  ['Machine', aiParse.resolution.machine.options.find((option) => option.id === aiParse.resolution.machine.id)?.name ?? aiParse.candidate.machineText, aiParse.resolution.machine.confidence],
                  ['WorkOrder', aiParse.workOrders[0]?.title, aiParse.workOrders[0]?.status ?? 'Unresolved'],
                ].map(([label, value, status]) => <div className={styles.reviewRow} key={String(label)}><strong>{label}</strong><span>{value == null ? 'Not found' : String(value)}</span><em>{String(status).replaceAll('_', ' ')}</em></div>)}
                <p>Original description: “{activityText}”</p>
              </div>}
              {aiParse?.workOrders.map((order) => <details key={order.workOrderId} className={styles.workOrderComparison}>
                <summary>{order.status.replaceAll('_', ' ')} — {order.title} ({order.totalScore} points)</summary>
                {order.evidence.map((evidence) => <div className={styles.reviewRow} key={evidence.field}><strong>{evidence.field}</strong><span>Expected: {evidence.expected ?? 'Not recorded'} · Described: {evidence.described ?? 'Not mentioned'}</span><em>{evidence.result}</em></div>)}
                {order.materialConflicts.length > 0 ? <p>Material conflict: {order.materialConflicts.join(', ')}. Linking is disabled.</p> : <Button type="button" variant="secondary" onClick={() => setLinkedWorkOrder({ id: order.workOrderId, version: order.version, title: order.title })}>Link to this WorkOrder</Button>}
              </details>)}
              {linkedWorkOrder && <p className={styles.workOrderSuggestion}>Explicitly linked to “{linkedWorkOrder.title}”. The server revalidates farm, field, type, status and version on save. <button type="button" onClick={() => setLinkedWorkOrder(null)}>Continue without WorkOrder</button></p>}
              {aiParse && <Button type="button" variant="secondary" disabled={aiParse.multiActivity.classification === 'multiple_activities' || aiParse.resolution.field.confidence === 'ambiguous' || !aiParse.resolution.field.id || !aiParse.candidate.activityType || !aiParse.candidate.areaHa} onClick={() => setMode('form')}>Move resolved suggestions to Activity form</Button>}
            </section>
            <div className={styles.typeGrid}>
              {TYPE_TILES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={styles.typeTile}
                  onClick={() => selectType(t.key)}
                >
                  <span className={styles.typeIcon}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: form ── */}
        {mode === 'form' && (
          <form ref={formRef} onInput={handleMeaningfulChange} onChange={handleMeaningfulChange} onSubmit={handleOfflineSubmit}>
            <input type="hidden" name="type" value={dbType} />
            {linkedWorkOrder && <><input type="hidden" name="workOrderId" value={linkedWorkOrder.id} /><input type="hidden" name="workOrderVersion" value={linkedWorkOrder.version} /></>}
            <input type="hidden" name="notes" value={combinedNotes} />

            <div className={styles.body}>
              {aiParse && <div className={styles.localSaveStatus}>AI-prefilled draft — review every highlighted suggestion. Original description: “{activityText}”</div>}
              {localSaveStatus && <div className={styles.localSaveStatus} role="status">{localSaveStatus}</div>}
              {hasValidationErrors && (
                <div className={styles.globalError} ref={errorBannerRef} role="alert" tabIndex={-1}>
                  {aiParse && <strong>FarmOS understood your description, but the Activity cannot be completed until the authoritative checks below are resolved. </strong>}
                  {state.error ? displayError(state.error) : displayError(userError('INVALID_VALUE'))}
                </div>
              )}

              <button type="button" className={styles.changeType} onClick={() => setMode('type-select')}>
                ← Change type
              </button>

              {/* ── Required: field, date, area ── */}
              <div className={styles.section}>
                <div className={styles.fieldGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="fieldSeasonId">Field *</label>
                    <button type="button" className={styles.locationButton} onClick={handleUseLocation} disabled={locating}>
                      {locating ? 'Locating…' : '📍 Use my location'}
                    </button>
                  </div>
                  <select
                    id="fieldSeasonId" name="fieldSeasonId"
                    className={`${styles.select}${state.fieldErrors?.fieldSeasonId ? ` ${styles.hasError}` : ''}`}
                    aria-describedby={state.fieldErrors?.fieldSeasonId ? 'activity-field-season-error' : undefined}
                    value={fieldSeasonId}
                    onChange={(e) => handleFieldChange(e.target.value)}
                  >
                    <option value="">— Select field —</option>
                    {fieldSeasons.map((fs) => (
                      <option key={fs.id} value={fs.id}>{fs.fieldName} ({fs.crop.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                  {locationMessage && <span className={styles.hint}>{locationMessage}</span>}
                  {fieldError('fieldSeasonId') && <span id="activity-field-season-error" className={styles.errorMsg}>{fieldError('fieldSeasonId')}</span>}
                </div>

                <div className={styles.row}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="date">
                      Date *
                      {isSpray && <span className={styles.prefillHint}> · a future date can be saved as planned</span>}
                    </label>
                    <input
                      id="date" name="date" type="date"
                      value={activityDate} onChange={(e) => setActivityDate(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="areaHa">
                      Treated area (ha) *
                      {selectedFieldSeason && <span className={styles.prefillHint}> · prefilled from field</span>}
                    </label>
                    <input
                      id="areaHa" name="areaHa" type="number" inputMode="decimal" step="0.01" min="0.01"
                      className={`${styles.input}${state.fieldErrors?.areaHa ? ` ${styles.hasError}` : ''}`}
                      aria-describedby={state.fieldErrors?.areaHa ? 'activity-area-error' : undefined}
                      value={areaHa} onChange={(e) => setAreaHa(e.target.value)}
                    />
                    {fieldError('areaHa') && <span id="activity-area-error" className={styles.errorMsg}>{fieldError('areaHa')}</span>}
                  </div>
                </div>
              </div>

              {/* ── Scouting: fast path ── */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Actual labour, machine and fuel</h3>
                <p className={styles.hint}>Enter measured values only. Missing hours or rates remain Not recorded.</p>
                {!isSpray && <div className={styles.fieldGroup}><label className={styles.label} htmlFor="operationalMachineId">Machine (optional)</label><select id="operationalMachineId" name="machineId" className={styles.select}><option value="">— None —</option>{localMachines.map(machine=><option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></div>}
                <div className={styles.row}><div className={styles.fieldGroup}><label className={styles.label} htmlFor="actualHours">Actual labour hours</label><input id="actualHours" name="actualHours" type="number" inputMode="decimal" step="0.01" min="0" className={styles.input}/></div><div className={styles.fieldGroup}><label className={styles.label} htmlFor="machineHours">Actual machine hours</label><input id="machineHours" name="machineHours" type="number" inputMode="decimal" step="0.01" min="0" className={styles.input}/></div></div>
                <div className={styles.row}><div className={styles.fieldGroup}><label className={styles.label} htmlFor="fuelUsed">Actual fuel used (L)</label><input id="fuelUsed" name="fuelUsed" type="number" inputMode="decimal" step="0.001" min="0" className={styles.input}/></div><div className={styles.fieldGroup}><label className={styles.label} htmlFor="fuelInventoryItemId">Fuel inventory item</label><select id="fuelInventoryItemId" name="fuelInventoryItemId" className={styles.select}><option value="">— Select when fuel is separate —</option>{products.filter(product=>product.category==='fuel'&&product.unit==='L').map(product=><option key={product.id} value={product.id}>{product.name} · {product.currentStock} L</option>)}</select></div></div>
              </div>

              {isScout && (
                <div className={styles.section}>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="scoutCategory">Observation *</label>
                      <select id="scoutCategory" className={styles.select} value={scoutCategory} onChange={(e) => setScoutCategory(e.target.value)}>
                        {SCOUT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="scoutSeverity">Severity (optional)</label>
                      <select id="scoutSeverity" className={styles.select} value={scoutSeverity} onChange={(e) => setScoutSeverity(e.target.value)}>
                        {SCOUT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="scoutAffectedHa">Affected area (ha, optional)</label>
                    <input id="scoutAffectedHa" type="number" inputMode="decimal" step="0.01" min="0" className={styles.input} value={scoutAffectedHa} onChange={(e) => setScoutAffectedHa(e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="userNotes">Notes (optional)</label>
                    <textarea id="userNotes" className={styles.textarea} value={userNotes} onChange={(e) => setUserNotes(e.target.value)} placeholder="Photo upload not yet supported — describe what you saw." />
                  </div>
                </div>
              )}

              {/* ── Spray / Fertilise: product + dose ── */}
              {(isSpray || isFertilise) && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>{isSpray ? 'Product' : 'Fertiliser'}</div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="productId">{isSpray ? 'Product *' : 'Fertiliser product *'}</label>
                    <select
                      id="productId" name="productId" className={`${styles.select}${state.fieldErrors?.productId ? ` ${styles.hasError}` : ''}`}
                      aria-describedby={state.fieldErrors?.productId ? 'activity-product-error' : undefined}
                      value={productId} onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {relevantProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                    </select>
                    {fieldError('productId') && <span id="activity-product-error" className={styles.errorMsg}>{fieldError('productId')}</span>}
                    {selectedProduct && (
                      <span className={styles.hint}>Current stock: {selectedProduct.currentStock} {selectedProduct.unit}{offline.connectivity !== 'online' && ' — based on last synced stock.'}</span>
                    )}
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="dosePerHa">{isSpray ? 'Dose per ha *' : 'Quantity per ha *'}</label>
                      <input
                        id="dosePerHa" name="dosePerHa" type="number" inputMode="decimal" step="0.001" min="0"
                        className={`${styles.input}${state.fieldErrors?.dosePerHa ? ` ${styles.hasError}` : ''}`}
                        aria-describedby={state.fieldErrors?.dosePerHa ? 'activity-dose-error' : undefined}
                        value={dosePerHa} onChange={(e) => setDosePerHa(e.target.value)}
                      />
                        {fieldError('dosePerHa') && <span id="activity-dose-error" className={styles.errorMsg}>{fieldError('dosePerHa')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="doseUnit">Unit *</label>
                      <select id="doseUnit" name="doseUnit" className={styles.select} defaultValue={selectedProduct?.unit ?? 'L'}>
                        <option value="L">L</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                      </select>
                    </div>
                  </div>

                  {stockPreview && (
                    <div className={`${styles.stockPreview} ${stockPreview.insufficient ? styles.stockPreviewWarn : ''}`}>
                      {stockPreview.insufficient
                        ? `⚠ Not enough stock: needs ${stockPreview.totalUsed.toFixed(2)} ${selectedProduct?.unit}, only ${selectedProduct?.currentStock} available.`
                        : `Stock after this activity: ${stockPreview.resultingStock.toFixed(2)} ${selectedProduct?.unit} (using ${stockPreview.totalUsed.toFixed(2)} ${selectedProduct?.unit}).`}
                    </div>
                  )}
                </div>
              )}

              {/* ── Spray-only required: operator/machine/nozzle/water volume ── */}
              {isSpray && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Operator & equipment</div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="operatorName">
                        Operator *
                        {recentOperatorName && <span className={styles.prefillHint}> · suggested</span>}
                      </label>
                      <input
                        id="operatorName" name="operatorName"
                        className={`${styles.input}${state.fieldErrors?.operatorName ? ` ${styles.hasError}` : ''}`}
                        aria-describedby={state.fieldErrors?.operatorName ? 'activity-operator-error' : undefined}
                        value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Full name"
                      />
                      {fieldError('operatorName') && <span id="activity-operator-error" className={styles.errorMsg}>{fieldError('operatorName')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="machineId">
                        Sprayer *
                        {recentMachineId && <span className={styles.prefillHint}> · suggested</span>}
                      </label>
                      <select
                        id="machineId" name="machineId"
                        className={`${styles.select}${state.fieldErrors?.machineId ? ` ${styles.hasError}` : ''}`}
                        aria-describedby={state.fieldErrors?.machineId ? 'activity-machine-error' : undefined}
                        value={addingMachine ? '' : machineId}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setAddingMachine(true);
                          } else {
                            setMachineId(e.target.value);
                          }
                        }}
                      >
                        <option value="">— Select —</option>
                        {localMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        <option value="__add_new__">+ Add a new sprayer</option>
                      </select>
                      {fieldError('machineId') && <span id="activity-machine-error" className={styles.errorMsg}>{fieldError('machineId')}</span>}
                      {addingMachine && (
                        <div className={styles.addMachineRow}>
                          <input
                            className={styles.input}
                            placeholder="e.g. John Deere M732i"
                            value={newMachineName}
                            onChange={(e) => setNewMachineName(e.target.value)}
                            aria-label="New sprayer name"
                          />
                          <Button type="button" variant="secondary" loading={creatingMachine} onClick={handleAddMachine}>
                            Add
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => { setAddingMachine(false); setNewMachineName(''); }}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      {machineErrorDisplay && <span className={styles.errorMsg} role="alert">{machineErrorDisplay.message}</span>}
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="waterVolumePerHa">Water volume (L/ha) *</label>
                      <input id="waterVolumePerHa" name="waterVolumePerHa" type="number" inputMode="decimal" step="1" min="0" max="2000" className={`${styles.input}${state.fieldErrors?.waterVolumePerHa ? ` ${styles.hasError}` : ''}`} aria-describedby={state.fieldErrors?.waterVolumePerHa ? 'activity-water-error' : undefined} placeholder="e.g. 300" />
                      {fieldError('waterVolumePerHa') && <span id="activity-water-error" className={styles.errorMsg}>{fieldError('waterVolumePerHa')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="nozzleType">Nozzle type *</label>
                      <select
                        id="nozzleType" name="nozzleType"
                        className={`${styles.select}${state.fieldErrors?.nozzleType ? ` ${styles.hasError}` : ''}`}
                        aria-describedby={state.fieldErrors?.nozzleType ? 'activity-nozzle-error' : undefined}
                        value={nozzleType} onChange={(e) => setNozzleType(e.target.value)}
                      >
                        <option value="">— Select —</option>
                        {NOZZLE_OPTIONS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                      </select>
                      {fieldError('nozzleType') && <span id="activity-nozzle-error" className={styles.errorMsg}>{fieldError('nozzleType')}</span>}
                    </div>
                  </div>

                  {weather ? (
                    <div className={styles.weatherSnapshot}>
                      <input type="hidden" name="weatherTempC" value={weather.tempC} />
                      <input type="hidden" name="weatherWindKmh" value={weather.windKmh} />
                      <input type="hidden" name="weatherWindDir" value={weather.windDir} />
                      <input type="hidden" name="weatherHumidity" value={weather.humidity} />
                      {offline.connectivity === 'online' ? 'Weather (auto-filled)' : `Offline estimate based on weather downloaded ${draftAge(weather.fetchedAt)}`}: {weather.tempC}°C · {weather.windKmh} km/h {weather.windDir} · {weather.humidity}% humidity. {offline.connectivity !== 'online' && 'Current suitability cannot be confirmed while offline. '}
                      <Link href="/weather" className={styles.inlineLink}> check suitability</Link>
                    </div>
                  ) : (
                    <div className={styles.weatherSnapshot}>
                      Weather data is unavailable. You may continue, but suitability cannot be calculated —
                      <Link href="/weather" className={styles.inlineLink}> check the Weather page</Link>.
                    </div>
                  )}

                  {/* Sprint 16 — real suitability review, computed from this
                      specific field/product/operator/machine/date, shown
                      before the activity can be submitted. */}
                  <div className={styles.suitabilityPanel} role="status" aria-live="polite">
                    {suitabilityLoading && !suitability && <p className={styles.suitabilityLoading}>Checking spray suitability…</p>}
                    {suitability && !suitability.success && (
                      <p className={styles.suitabilityError}>{suitability.error}</p>
                    )}
                    {suitability && suitability.success && (
                      <div className={`${styles.suitabilityResult} ${suitability.summary.status === 'blocked' ? styles.suitabilityBlocked : styles.suitabilityOk}`}>
                        <div className={styles.suitabilityHeader}>
                          <span className={styles.suitabilityStatus}>
                            {suitability.summary.status === 'blocked' ? `⛔ ${sprayDisplay?.statusLabel}` : `${sprayDisplay?.statusLabel} (${suitability.summary.score}/100)`}
                          </span>
                          <span className={styles.suitabilityMeta}>
                            {sprayDisplay?.confidenceLabel}
                            {suitability.summary.weatherDataAge >= 0 && ` · Weather data ${suitability.summary.weatherDataAge}m old`}
                          </span>
                        </div>
                        {suitability.summary.productProfile.isMockDefault && (
                          <p className={styles.suitabilityNote}>
                            No verified product registration selected — using generic indicative thresholds, not this product&apos;s real label.
                          </p>
                        )}
                        {suitability.summary.hardBlockers.length > 0 && (
                          <ul className={styles.suitabilityBlockerList}>
                            {sprayDisplay?.blockers.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        )}
                        {suitability.summary.warnings.length > 0 && (
                          <ul className={styles.suitabilityWarningList}>
                            {sprayDisplay?.warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        )}
                        {suitability.summary.positiveFactors.length > 0 && (
                          <ul className={styles.suitabilityPositiveList}>
                            {sprayDisplay?.positiveFactors.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        )}
                        {suitability.summary.bestWindowStart && suitability.summary.bestWindowEnd && (
                          <p className={styles.suitabilityNote}>
                            Best window: {suitability.summary.bestWindowStart.slice(11, 16)}–{suitability.summary.bestWindowEnd.slice(11, 16)}
                          </p>
                        )}
                        <p className={styles.suitabilityDisclaimer}>{sprayDisplay?.disclaimer}</p>
                      </div>
                    )}
                  </div>

                  {/* Sprint 18 Part 7 — a SEPARATE panel from weather
                      suitability above. Ctgb governs legal crop/dose/BBCH
                      restrictions, not wind/temperature — never blended
                      into one score. */}
                  {suitability && suitability.success && suitability.ctgbCompliance && (
                    <div className={styles.suitabilityPanel}>
                      <div className={styles.sectionTitle}>Official Ctgb restrictions</div>
                      {suitability.ctgbCompliance.availableUses.length > 1 && (
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="ctgbUseSelect">Intended official use</label>
                          <select
                            id="ctgbUseSelect"
                            className={styles.select}
                            value={selectedCtgbUseIndex ?? ''}
                            onChange={(e) => setSelectedCtgbUseIndex(e.target.value === '' ? undefined : Number(e.target.value))}
                          >
                            <option value="">— Auto-match by crop —</option>
                            {suitability.ctgbCompliance.availableUses.map((u, i) => (
                              <option key={i} value={i}>{u.cropOrUseTarget}{u.purpose ? ` — ${u.purpose}` : ''}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <CtgbSourceNote
                        sourceUrl={suitability.ctgbCompliance.product?.sourceUrl}
                        fetchedAt={suitability.ctgbCompliance.product?.fetchedAt}
                        authorisationStatus={suitability.ctgbCompliance.product?.authorisationStatus}
                        isIncomplete={suitability.ctgbCompliance.status === 'incomplete'}
                        isManualEntry={suitability.ctgbCompliance.status === 'manual_unverified'}
                      />
                      {suitability.ctgbCompliance.blockers.length > 0 && (
                        <ul className={styles.suitabilityBlockerList}>
                          {suitability.ctgbCompliance.blockers.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      )}
                      {suitability.ctgbCompliance.warnings.length > 0 && (
                        <ul className={styles.suitabilityWarningList}>
                          {suitability.ctgbCompliance.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Other/advanced — collapsed by default ── */}
              {!isScout && (
                <>
                  <button type="button" className={styles.advancedToggle} onClick={() => setShowAdvanced((v) => !v)}>
                    {showAdvanced ? '− Hide optional details' : '+ Optional details'}
                  </button>
                  {showAdvanced && (
                    <div className={styles.advancedGroup}>
                      {!isSpray && (
                        <div className={styles.row}>
                          <div className={styles.fieldGroup}>
                            <label className={styles.label} htmlFor="operatorNameAdv">Operator (optional)</label>
                            <input id="operatorNameAdv" name="operatorName" className={styles.input} defaultValue={recentOperatorName ?? ''} />
                          </div>
                          {machines.length > 0 && (
                            <div className={styles.fieldGroup}>
                              <label className={styles.label} htmlFor="machineIdAdv">Machine (optional)</label>
                              <select id="machineIdAdv" name="machineId" className={styles.select} defaultValue={recentMachineId ?? ''}>
                                <option value="">— None —</option>
                                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                      {quickType === 'other' && (
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="otherSubType">Specific type</label>
                          <select id="otherSubType" className={styles.select} value={otherSubType} onChange={(e) => setOtherSubType(e.target.value)}>
                            <option value="irrigate">Irrigation</option>
                            <option value="soil_sample">Soil sample</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      )}
                      {!isScout && (
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="userNotesGeneric">Notes (optional)</label>
                          <textarea id="userNotesGeneric" className={styles.textarea} value={userNotes} onChange={(e) => setUserNotes(e.target.value)} />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className={styles.complianceNote}>
                <span>ⓘ</span>
                <span>
                  {isSpray
                    ? 'A spray diary record (EU Directive 2009/128/EC) will be created automatically and retained for 3 years.'
                    : 'This activity is recorded in your field history. No compliance record is created for this activity type.'}
                  {' '}Activities cannot be permanently deleted.
                </span>
              </div>
            </div>

            <div className={styles.footer}>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              {draftRef.current && <Button type="button" variant="danger" onClick={() => void discardCurrentDraft()}>Discard local draft</Button>}
              {/* "Save activity" stays first in DOM order so it remains the
                  browser's default submit button (e.g. pressing Enter in a
                  text field) — unchanged from before "Save as planned"
                  existed. Visual order is flipped back via CSS `order` so it
                  still reads left-to-right as Cancel / Save as planned /
                  Save activity. */}
              <Button
                type="submit" name="status" value="completed"
                variant="primary" loading={isPending} disabled={stockPreview?.insufficient}
                style={{ order: 2 }}
              >
                Save activity
              </Button>
              {isSpray && (
                <Button
                  type="submit" name="status" value="planned"
                  variant="secondary" loading={isPending}
                  style={{ order: 1 }}
                >
                  Save as planned
                </Button>
              )}
            </div>
          </form>
        )}

        {/* ── Step 3: success ── */}
        {mode === 'success' && (
          <div className={styles.body}>
            <div className={styles.successPanel}>
              <span className={styles.successIcon}>✓</span>
              <p className={styles.successTitle}>{localResult === 'synced' ? `${TYPE_TILES.find((t) => t.key === quickType)?.label} recorded` : 'Activity saved on this device'}</p>
              <p className={styles.successMeta}>{selectedFieldSeason?.fieldName} · {today}</p>
              {localResult === 'synced' && stockPreview && !stockPreview.insufficient && (
                <p className={styles.successMeta}>Stock updated: {stockPreview.resultingStock.toFixed(2)} {selectedProduct?.unit} remaining</p>
              )}
              {localResult === 'synced' && isSpray && <p className={styles.successMeta}>Compliance record created · Synced with FarmOS</p>}
              {localResult === 'queued' && <p className={styles.pendingMeta}>Waiting to sync. It will synchronize when a verified connection is available.</p>}
              {localResult === 'queued' && isSpray && <p className={styles.pendingMeta}>Pending synchronization — compliance record not yet finalized. Stock has not been deducted in FarmOS.</p>}
            </div>
            <div className={styles.footer}>
              <Button variant="ghost" onClick={resetForAnother}>Add another</Button>
              <Button variant="secondary" onClick={onSuccess}>View activity history</Button>
              <Link href="/dashboard"><Button variant="primary">Return to dashboard</Button></Link>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
