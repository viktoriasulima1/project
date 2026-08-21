'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';
import { isClerkConfigured } from '@/lib/clerk-config';
import { createFarm, addOnboardingInventoryItem, addOnboardingEmployee } from '@/lib/actions/onboarding';
import type { OnboardingFormState } from '@/lib/actions/onboarding';
import { createSeason, addFieldToSeason } from '@/lib/actions/seasons';
import type { SeasonFormState } from '@/lib/actions/seasons';
import { createField } from '@/lib/actions/fields';
import type { FieldFormState } from '@/lib/actions/fields';
import type { FarmSetupStateName } from '@/lib/farm-setup';
import { useTranslations } from '@/i18n/LocaleProvider';
import styles from './OnboardingWizard.module.css';

type Step = 'welcome' | 'farm' | 'season' | 'field' | 'crop' | 'inventory' | 'employee' | 'review' | 'complete';

const STEP_ORDER: Step[] = ['welcome', 'farm', 'season', 'field', 'crop', 'inventory', 'employee', 'review', 'complete'];

// The persistent desktop side nav lists every real step but not the
// destination screen — 'complete' has nothing left to navigate back to.
const SIDE_STEPS = STEP_ORDER.filter((s) => s !== 'complete');

// Canonical tokens only — visible labels come from the `enums` namespace, so a
// translated label can never be submitted as the value.
const CROP_VALUES = ['wheat', 'potato', 'onion', 'sugar_beet', 'barley', 'oilseed_rape', 'cover_crop', 'grass', 'other'];
const SOIL_OPTIONS = ['clay', 'sandy', 'loam', 'peat', 'silt'];
const INVENTORY_UNITS = ['L', 'kg', 'T', 'bag', 'box'];
const CROP_PROTECTION_CATEGORIES = ['herbicide', 'fungicide', 'insecticide'];
const OTHER_CATEGORIES = ['fertiliser', 'seed', 'fuel', 'other'];

const clerkEnabled = isClerkConfigured(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * This page is behind clerkMiddleware's auth.protect(), so reaching this
 * error at all means the middleware's own (optimistic, cookie-presence)
 * check passed but the Server Action's real auth() check didn't — a
 * session that expired while this form was being filled in is the
 * ordinary way that happens. Before this, AUTH_REQUIRED was a dead end:
 * nothing on the page pointed back to /sign-in, and navigating there
 * manually would have thrown away everything already typed. The modal
 * re-authenticates without leaving the page, so the form state survives.
 */
function OnboardingError({ errorCode }: { errorCode?: string }) {
  const t = useTranslations('onboarding');
  const terr = useTranslations('errors');
  if (!errorCode) return null;
  return (
    <div className={styles.globalError} role="alert">
      {terr(errorCode)}
      {errorCode === 'AUTH_REQUIRED' && clerkEnabled && (
        <div className={styles.globalErrorAction}>
          <SignInButton mode="modal">
            <Button type="button" variant="secondary" size="sm">{t('buttons.signIn')}</Button>
          </SignInButton>
        </div>
      )}
    </div>
  );
}

function stepFromSetupState(state: FarmSetupStateName): Step {
  switch (state) {
    case 'no_farm': return 'welcome';
    case 'farm_created':
    case 'no_active_season': return 'season';
    case 'no_fields': return 'field';
    case 'no_field_seasons': return 'crop';
    case 'ready': return 'review';
  }
}

interface SerializableFarm {
  id: string;
  name: string;
  location: string;
  country: string;
  totalHectares: number | null;
  brpNumber: string | null;
  vatNumber: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SerializableFieldOption {
  id: string;
  name: string;
  hectares: number;
}

interface Props {
  // Only the state name is needed here — never pass the full FarmSetupState
  // (its `farm` field is a raw Prisma Farm with Decimal columns, which
  // cannot cross the Server → Client Component boundary).
  setupStateName: FarmSetupStateName;
  requestedStep?: string;
  farm: SerializableFarm | null;
  fields: SerializableFieldOption[];
  activeSeason: { id: string; year: number } | null;
}

const farmInitial: OnboardingFormState = {};
const seasonInitial: SeasonFormState = {};
const fieldInitial: FieldFormState = {};
const cropInitial: SeasonFormState = {};
const inventoryInitial: OnboardingFormState = {};
const employeeInitial: OnboardingFormState = {};

export function OnboardingWizard({ setupStateName, requestedStep, farm, fields, activeSeason }: Props) {
  const router = useRouter();
  const t = useTranslations('onboarding');
  const te = useTranslations('enums');
  const terr = useTranslations('errors');

  const validRequestedStep = STEP_ORDER.includes(requestedStep as Step) ? (requestedStep as Step) : null;
  const [step, setStep] = useState<Step>(validRequestedStep ?? stepFromSetupState(setupStateName));

  const [farmName, setFarmName] = useState(farm?.name ?? '');
  const [seasonYear, setSeasonYear] = useState(activeSeason?.year ?? new Date().getFullYear());
  const [fieldsList, setFieldsList] = useState<SerializableFieldOption[]>(fields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id ?? null);
  const [seasonId, setSeasonId] = useState<string | null>(activeSeason?.id ?? null);
  const [cropAssigned, setCropAssigned] = useState(setupStateName === 'ready');
  const [inventoryCategory, setInventoryCategory] = useState('fungicide');
  const [showAdvancedInventory, setShowAdvancedInventory] = useState(false);
  const [addedInventory, setAddedInventory] = useState(false);
  const [addedEmployee, setAddedEmployee] = useState(false);

  const [farmState, farmAction, farmPending] = useActionState(createFarm, farmInitial);
  const [seasonState, seasonAction, seasonPending] = useActionState(createSeason, seasonInitial);
  const [fieldState, fieldAction, fieldPending] = useActionState(createField, fieldInitial);
  const [cropState, cropAction, cropPending] = useActionState(addFieldToSeason, cropInitial);
  const [inventoryState, inventoryAction, inventoryPending] = useActionState(addOnboardingInventoryItem, inventoryInitial);
  const [employeeState, employeeAction, employeePending] = useActionState(addOnboardingEmployee, employeeInitial);

  // Every transition replaces the URL with the step it's moving to, rather than
  // a bare router.refresh() (Sprint 12: a stale earlier-step refresh could hit
  // the ready-user redirect and skip optional steps). Each transition carries an
  // explicit `step` param.
  useEffect(() => {
    if (farmState.success) { setStep('season'); router.replace('/onboarding?step=season'); }
  }, [farmState.success, router]);

  useEffect(() => {
    if (seasonState.success && seasonState.seasonId) {
      setSeasonId(seasonState.seasonId);
      setStep('field');
      router.replace('/onboarding?step=field');
    }
  }, [seasonState.success, seasonState.seasonId, router]);

  useEffect(() => {
    if (fieldState.success && fieldState.fieldId) {
      setFieldsList((prev) => [...prev, { id: fieldState.fieldId!, name: '(new field)', hectares: 0 }]);
      setSelectedFieldId(fieldState.fieldId);
      setStep('crop');
      router.replace('/onboarding?step=crop');
    }
  }, [fieldState.success, fieldState.fieldId, router]);

  useEffect(() => {
    if (cropState.success) {
      setCropAssigned(true);
      setStep('inventory');
      router.replace('/onboarding?step=inventory');
    }
  }, [cropState.success, router]);

  useEffect(() => {
    if (inventoryState.success) {
      setAddedInventory(true);
      setStep('employee');
    }
  }, [inventoryState.success]);

  useEffect(() => {
    if (employeeState.success) {
      setAddedEmployee(true);
      setStep('review');
    }
  }, [employeeState.success]);

  const currentIndex = STEP_ORDER.indexOf(step);
  const progressPercent = Math.round((currentIndex / (STEP_ORDER.length - 1)) * 100);

  function goBack() {
    if (currentIndex > 0) setStep(STEP_ORDER[currentIndex - 1]);
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <div className={styles.sideTop}>
          <div className={styles.sideBrand}>
            <span className={styles.sideBrandIcon}>🌾</span>
            <span className={styles.sideBrandName}>{t('brand')}</span>
          </div>
          <p className={styles.sideTagline}>{t('sidebarTagline')}</p>
        </div>
        <nav className={styles.stepNav}>
          {SIDE_STEPS.map((s, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : undefined;
            return (
              <button
                key={s}
                type="button"
                className={styles.stepNavItem}
                data-state={state}
                disabled={state !== 'done'}
                onClick={() => state === 'done' && setStep(s)}
              >
                <span className={styles.stepNavBadge}>{state === 'done' ? '✓' : i + 1}</span>
                {t(`steps.${s}`)}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.header}>
            <div className={styles.brand}>{t('brand')}</div>
            {step !== 'welcome' && step !== 'complete' && (
              <>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                </div>
                <div className={styles.progressLabel}>
                  {t('progress', { current: currentIndex + 1, total: STEP_ORDER.length - 1, label: t(`steps.${step}`) })}
                </div>
              </>
            )}
          </div>

          <div className={styles.card}>
        {/* ── Welcome ── */}
        {step === 'welcome' && (
          <>
            <div className={styles.welcomeIcon}>🌾</div>
            <h1 className={styles.stepTitle}>{t('welcome.title')}</h1>
            <p className={styles.stepDesc}>{t('welcome.desc')}</p>
            <Button variant="primary" onClick={() => setStep('farm')}>{t('buttons.getStarted')}</Button>
          </>
        )}

        {/* ── Farm details + location ── */}
        {step === 'farm' && (
          <>
            <h1 className={styles.stepTitle}>{t('farm.title')}</h1>
            {farmState.success ? (
              // Reachable via the side nav once this step is done.
              // createFarm is idempotent — resubmitting just returns the
              // existing farm without applying any edits made here — and the
              // forward-advance effect below keys off farmState.success,
              // which doesn't change value on a second identical `true`, so
              // it wouldn't even fire again. Re-showing the live form here
              // would silently discard edits and appear to hang. Confirm
              // and let Continue just move forward instead.
              <>
                <p className={styles.stepDesc}>{t('farm.alreadySaved')}</p>
                <div className={styles.footer}>
                  <span />
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setStep('season');
                      router.replace('/onboarding?step=season');
                    }}
                  >
                    {t('buttons.continue')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.stepDesc}>{t('farm.desc')}</p>
                <form action={farmAction} className={styles.form}>
                  <OnboardingError errorCode={farmState.errorCode} />

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="name">{t('farm.nameLabel')}</label>
                <input
                  id="name" name="name" aria-describedby={farmState.fieldErrorCodes?.name ? 'farm-name-error' : undefined} className={`${styles.input}${farmState.fieldErrorCodes?.name ? ` ${styles.hasError}` : ''}`}
                  defaultValue={farmName} onChange={(e) => setFarmName(e.target.value)}
                  placeholder={t('farm.namePlaceholder')}
                />
                {farmState.fieldErrorCodes?.name && <span id="farm-name-error" className={styles.errorMsg}>{terr(farmState.fieldErrorCodes.name[0])}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="location">{t('farm.locationLabel')}</label>
                <input
                  id="location" name="location" aria-describedby={farmState.fieldErrorCodes?.location ? 'farm-location-error' : undefined} className={`${styles.input}${farmState.fieldErrorCodes?.location ? ` ${styles.hasError}` : ''}`}
                  defaultValue={farm?.location ?? ''} placeholder={t('farm.locationPlaceholder')}
                />
                {farmState.fieldErrorCodes?.location && <span id="farm-location-error" className={styles.errorMsg}>{terr(farmState.fieldErrorCodes.location[0])}</span>}
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="country">{t('farm.country')}</label>
                  <input id="country" name="country" maxLength={2} className={styles.input} defaultValue={farm?.country ?? 'NL'} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="totalHectares">{t('farm.totalHectares')}</label>
                  <input id="totalHectares" name="totalHectares" type="number" step="0.1" min="0" className={styles.input} defaultValue={farm?.totalHectares ?? ''} />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="brpNumber">{t('farm.brpNumber')}</label>
                  <input id="brpNumber" name="brpNumber" className={styles.input} defaultValue={farm?.brpNumber ?? ''} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="vatNumber">{t('farm.vatNumber')}</label>
                  <input id="vatNumber" name="vatNumber" className={styles.input} defaultValue={farm?.vatNumber ?? ''} />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="latitude">{t('farm.latitude')}</label>
                  <input id="latitude" name="latitude" type="number" step="0.0001" className={styles.input} defaultValue={farm?.latitude ?? ''} placeholder="51.9652" />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="longitude">{t('farm.longitude')}</label>
                  <input id="longitude" name="longitude" type="number" step="0.0001" className={styles.input} defaultValue={farm?.longitude ?? ''} placeholder="5.9307" />
                </div>
              </div>
              <p className={styles.hint}>{t('farm.coordsHint')}</p>

              <div className={styles.footer}>
                <span />
                    <Button type="submit" variant="primary" loading={farmPending}>{t('buttons.continue')}</Button>
                  </div>
                </form>
              </>
            )}
          </>
        )}

        {/* ── Active season ── */}
        {step === 'season' && (
          <>
            <h1 className={styles.stepTitle}>{t('season.title')}</h1>
            {(seasonState.success || seasonId) ? (
              // Same class of bug as field/farm above, and reachable the same
              // ways (side nav, Back, or a fresh reload of ?step=season) —
              // seasonState itself resets to {} on a fresh mount, so success
              // alone missed it. createSeason enforces one active season per
              // farm/year, so resubmitting this form unchanged doesn't create
              // a duplicate, but it DID hit that conflict and leave the user
              // stuck on a form with no forward path. seasonId (seeded from
              // the activeSeason prop) already tells us a season exists —
              // check that instead of forcing a real resubmission just to
              // discover the same thing.
              <>
                <p className={styles.stepDesc}>{t('season.alreadySaved')}</p>
                <div className={styles.footer}>
                  <Button type="button" variant="ghost" onClick={goBack}>{t('buttons.back')}</Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setStep('field');
                      router.replace('/onboarding?step=field');
                    }}
                  >
                    {t('buttons.continue')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.stepDesc}>{t('season.desc')}</p>
                <form action={seasonAction} className={styles.form}>
                  {seasonState.error && <div className={styles.globalError} role="alert">{seasonState.error}</div>}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="year">{t('season.year')}</label>
                    <input id="year" name="year" type="number" className={styles.input} value={seasonYear} onChange={(e) => setSeasonYear(Number(e.target.value))} />
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="startDate">{t('season.startDate')}</label>
                      <input id="startDate" name="startDate" type="date" className={styles.input} defaultValue={`${seasonYear}-01-01`} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="endDate">{t('season.endDate')}</label>
                      <input id="endDate" name="endDate" type="date" className={styles.input} defaultValue={`${seasonYear}-12-31`} />
                    </div>
                  </div>
                  <div className={styles.footer}>
                    <Button type="button" variant="ghost" onClick={goBack}>{t('buttons.back')}</Button>
                    <Button type="submit" variant="primary" loading={seasonPending}>{t('buttons.continue')}</Button>
                  </div>
                </form>
              </>
            )}
          </>
        )}

        {/* ── First field ── */}
        {step === 'field' && (
          <>
            <h1 className={styles.stepTitle}>{t('field.title')}</h1>
            {(fieldState.success || fieldsList.length > 0) ? (
              // Reachable by clicking this already-completed step in the side
              // nav, repeated Back clicks, OR a fresh page load/reload of
              // ?step=field once a field already exists (fieldState itself
              // resets to {} on a fresh mount, so success alone missed this
              // case — a reload mid-wizard, or a bookmarked/shared link,
              // landed back on the blank form every time). createField has
              // no dedup the way createFarm/createSeason/addFieldToSeason do, so
              // re-rendering the blank create form here would silently add a
              // second field on re-submit. Show a static confirmation and let
              // Continue just move forward instead.
              <>
                <p className={styles.stepDesc}>{t('field.alreadyAdded')}</p>
                <div className={styles.footer}>
                  <Button type="button" variant="ghost" onClick={goBack}>{t('buttons.back')}</Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setStep('crop');
                      router.replace('/onboarding?step=crop');
                    }}
                  >
                    {t('buttons.continue')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.stepDesc}>{t('field.desc')}</p>
                <form action={fieldAction} className={styles.form}>
                  {fieldState.error && <div className={styles.globalError} role="alert">{fieldState.error}</div>}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="fname">{t('field.nameLabel')}</label>
                    <input id="fname" name="name" className={`${styles.input}${fieldState.fieldErrors?.name ? ` ${styles.hasError}` : ''}`} placeholder={t('field.namePlaceholder')} />
                    {fieldState.fieldErrors?.name && <span className={styles.errorMsg}>{fieldState.fieldErrors.name[0]}</span>}
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="hectares">{t('field.hectares')}</label>
                      <input id="hectares" name="hectares" type="number" step="0.01" min="0.01" className={`${styles.input}${fieldState.fieldErrors?.hectares ? ` ${styles.hasError}` : ''}`} placeholder={t('field.hectaresPlaceholder')} />
                      {fieldState.fieldErrors?.hectares && <span className={styles.errorMsg}>{fieldState.fieldErrors.hectares[0]}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="soilType">{t('field.soilType')}</label>
                      <select id="soilType" name="soilType" className={styles.select} defaultValue="loam">
                        {SOIL_OPTIONS.map((s) => <option key={s} value={s}>{te(`soilType.${s}`)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles.footer}>
                    <Button type="button" variant="ghost" onClick={goBack}>{t('buttons.back')}</Button>
                    <Button type="submit" variant="primary" loading={fieldPending}>{t('buttons.continue')}</Button>
                  </div>
                </form>
              </>
            )}
          </>
        )}

        {/* ── Crop assignment ── */}
        {step === 'crop' && (
          <>
            <h1 className={styles.stepTitle}>{t('crop.title')}</h1>
            {(cropState.success || cropAssigned) ? (
              // Same class of bug as season/field above. cropAssigned starts
              // true when setupStateName was already 'ready' at mount (i.e.
              // some field in this season already has a crop) — a fresh
              // reload of ?step=crop, or Back/side-nav after finishing this
              // step once, used to always show the live form again. Every
              // field this farm has is already offered elsewhere (the
              // Activities page's "+ Add to season" guide) for a genuinely
              // NEW field/crop pairing — this step only ever needs to prove
              // "at least one," so confirming and moving on is correct here,
              // never a silent overwrite of whatever crop is already set.
              <>
                <p className={styles.stepDesc}>{t('crop.alreadyAssigned')}</p>
                <div className={styles.footer}>
                  <Button type="button" variant="ghost" onClick={goBack}>{t('buttons.back')}</Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setStep('inventory');
                      router.replace('/onboarding?step=inventory');
                    }}
                  >
                    {t('buttons.continue')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.stepDesc}>{t('crop.desc')}</p>
                <form action={cropAction} className={styles.form}>
                  {cropState.error && <div className={styles.globalError} role="alert">{cropState.error}</div>}
                  <input type="hidden" name="seasonId" value={seasonId ?? ''} />
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="fieldId">{t('crop.fieldLabel')}</label>
                    <select
                      id="fieldId" name="fieldId" className={styles.select}
                      value={selectedFieldId ?? ''} onChange={(e) => setSelectedFieldId(e.target.value)}
                    >
                      {fieldsList.map((f) => (
                        <option key={f.id} value={f.id}>{f.name !== '(new field)' ? f.name : t('crop.newFieldOption')}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="crop">{t('crop.cropLabel')}</label>
                    <select id="crop" name="crop" className={styles.select} defaultValue="wheat">
                      {CROP_VALUES.map((c) => <option key={c} value={c}>{te(`crop.${c}`)}</option>)}
                    </select>
                  </div>
                  <div className={styles.footer}>
                    <Button type="button" variant="ghost" onClick={goBack}>{t('buttons.back')}</Button>
                    <Button type="submit" variant="primary" loading={cropPending} disabled={!seasonId || !selectedFieldId}>
                      {t('buttons.continue')}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </>
        )}

        {/* ── Optional inventory ── */}
        {step === 'inventory' && (
          <>
            <h1 className={styles.stepTitle}>{t('inventory.title')}</h1>
            <p className={styles.stepDesc}>{t('inventory.desc')}</p>
            <form action={inventoryAction} className={styles.form}>
              <OnboardingError errorCode={inventoryState.errorCode} />
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="pname">{t('inventory.productName')}</label>
                <input id="pname" name="name" className={styles.input} placeholder={t('inventory.productPlaceholder')} />
              </div>
              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="category">{t('inventory.category')}</label>
                  <select
                    id="category" name="category" className={styles.select}
                    value={inventoryCategory} onChange={(e) => setInventoryCategory(e.target.value)}
                  >
                    <optgroup label={t('inventory.cropProtectionGroup')}>
                      {CROP_PROTECTION_CATEGORIES.map((c) => <option key={c} value={c}>{te(`inventoryCategory.${c}`)}</option>)}
                    </optgroup>
                    {OTHER_CATEGORIES.map((c) => <option key={c} value={c}>{te(`inventoryCategory.${c}`)}</option>)}
                  </select>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="unit">{t('inventory.unit')}</label>
                  <select id="unit" name="unit" className={styles.select} defaultValue="L">
                    {INVENTORY_UNITS.map((u) => <option key={u} value={u}>{te(`unit.${u}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="currentStock">{t('inventory.currentStock')}</label>
                  <input id="currentStock" name="currentStock" type="number" step="0.01" min="0" className={styles.input} defaultValue="0" />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="minimumStock">{t('inventory.minimumStock')}</label>
                  <input id="minimumStock" name="minimumStock" type="number" step="0.01" min="0" className={styles.input} placeholder="0" />
                </div>
              </div>

              <button
                type="button"
                className={styles.advancedToggle}
                onClick={() => setShowAdvancedInventory((v) => !v)}
              >
                {showAdvancedInventory ? t('inventory.advancedHide') : t('inventory.advancedShow')}
              </button>

              {showAdvancedInventory && (
                <div className={styles.advancedGroup}>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="purchasePricePerUnit">{t('inventory.purchasePrice')}</label>
                      <input id="purchasePricePerUnit" name="purchasePricePerUnit" type="number" step="0.01" min="0" className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="supplierName">{t('inventory.supplier')}</label>
                      <input id="supplierName" name="supplierName" className={styles.input} />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="expiryDate">{t('inventory.expiryDate')}</label>
                    <input id="expiryDate" name="expiryDate" type="date" className={styles.input} />
                  </div>

                  {CROP_PROTECTION_CATEGORIES.includes(inventoryCategory) && (
                    <>
                      <div className={styles.row}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="registrationNumber">{t('inventory.registrationNumber')}</label>
                          <input id="registrationNumber" name="registrationNumber" className={styles.input} placeholder={t('inventory.regPlaceholder')} />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="activeIngredient">{t('inventory.activeIngredient')}</label>
                          <input id="activeIngredient" name="activeIngredient" className={styles.input} />
                        </div>
                      </div>
                      <div className={styles.row}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="fracCode">{t('inventory.fracCode')}</label>
                          <input id="fracCode" name="fracCode" className={styles.input} />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="hracCode">{t('inventory.hracCode')}</label>
                          <input id="hracCode" name="hracCode" className={styles.input} />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label} htmlFor="phiDays">{t('inventory.phiDays')}</label>
                          <input id="phiDays" name="phiDays" type="number" min="0" className={styles.input} />
                        </div>
                      </div>
                    </>
                  )}

                  {inventoryCategory === 'fertiliser' && (
                    <div className={styles.row}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="nitrogenPercent">{t('inventory.nitrogen')}</label>
                        <input id="nitrogenPercent" name="nitrogenPercent" type="number" step="0.1" min="0" max="100" className={styles.input} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="phosphorusPercent">{t('inventory.phosphorus')}</label>
                        <input id="phosphorusPercent" name="phosphorusPercent" type="number" step="0.1" min="0" max="100" className={styles.input} />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="potassiumPercent">{t('inventory.potassium')}</label>
                        <input id="potassiumPercent" name="potassiumPercent" type="number" step="0.1" min="0" max="100" className={styles.input} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.footer}>
                <Button type="button" variant="ghost" onClick={() => setStep('employee')}>{t('buttons.skip')}</Button>
                <Button type="submit" variant="primary" loading={inventoryPending}>{t('inventory.addProduct')}</Button>
              </div>
            </form>
          </>
        )}

        {/* ── Optional employee / licence ── */}
        {step === 'employee' && (
          <>
            <h1 className={styles.stepTitle}>{t('employee.title')}</h1>
            <p className={styles.stepDesc}>{t('employee.desc')}</p>
            <form action={employeeAction} className={styles.form}>
              <OnboardingError errorCode={employeeState.errorCode} />
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="ename">{t('employee.name')}</label>
                <input id="ename" name="name" className={styles.input} placeholder={t('employee.namePlaceholder')} />
              </div>
              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="role">{t('employee.role')}</label>
                  <input id="role" name="role" className={styles.input} placeholder={t('employee.rolePlaceholder')} />
                </div>
                <div className={styles.checkboxRow} style={{ alignSelf: 'flex-end', paddingBottom: '10px' }}>
                  <input id="hasSpraying" name="hasSpraying" type="checkbox" />
                  <label htmlFor="hasSpraying">{t('employee.hasSpraying')}</label>
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="certNumber">{t('employee.certNumber')}</label>
                  <input id="certNumber" name="certNumber" className={styles.input} placeholder={t('employee.certPlaceholder')} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="certExpiry">{t('employee.certExpiry')}</label>
                  <input id="certExpiry" name="certExpiry" type="date" className={styles.input} />
                </div>
              </div>
              <div className={styles.footer}>
                <Button type="button" variant="ghost" onClick={() => setStep('review')}>{t('buttons.skip')}</Button>
                <Button type="submit" variant="primary" loading={employeePending}>{t('employee.addOperator')}</Button>
              </div>
            </form>
          </>
        )}

        {/* ── Review ── */}
        {step === 'review' && (
          <>
            <h1 className={styles.stepTitle}>{t('review.title')}</h1>
            <p className={styles.stepDesc}>{t('review.desc')}</p>
            <div className={styles.reviewList}>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>{t('review.farm')}</span>
                <span className={styles.reviewValue}>{farmName || farm?.name || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>{t('review.activeSeason')}</span>
                <span className={styles.reviewValue}>{seasonYear}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>{t('review.fields')}</span>
                <span className={styles.reviewValue}>{fieldsList.length}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>{t('review.cropAssigned')}</span>
                <span className={styles.reviewValue}>{cropAssigned ? t('review.yes') : t('review.no')}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>{t('review.inventory')}</span>
                <span className={styles.reviewValue}>{addedInventory ? t('review.added') : t('review.skipped')}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>{t('review.operator')}</span>
                <span className={styles.reviewValue}>{addedEmployee ? t('review.added') : t('review.skipped')}</span>
              </div>
            </div>
            <div className={styles.footer}>
              <Button type="button" variant="ghost" onClick={goBack}>{t('buttons.back')}</Button>
              <Button
                type="button"
                variant="primary"
                disabled={!cropAssigned}
                onClick={() => {
                  setStep('complete');
                  router.replace('/onboarding?done=1');
                }}
              >
                {t('review.finish')}
              </Button>
            </div>
          </>
        )}

        {/* ── Complete ── */}
        {step === 'complete' && (
          <>
            <div className={styles.successIcon}>✓</div>
            <h1 className={styles.stepTitle}>{t('complete.title')}</h1>
            <p className={styles.stepDesc}>{t('complete.desc')}</p>
            <Link href="/dashboard">
              <Button variant="primary">{t('complete.goToDashboard')}</Button>
            </Link>
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
