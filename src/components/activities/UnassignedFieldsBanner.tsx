'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { addFieldToSeason } from '@/lib/actions/seasons';
import type { SeasonFormState } from '@/lib/actions/seasons';
import styles from './ActivitiesPage.module.css';

const CROP_OPTIONS = [
  { value: 'wheat', label: 'Wheat' },
  { value: 'potato', label: 'Potato' },
  { value: 'onion', label: 'Onion' },
  { value: 'sugar_beet', label: 'Sugar beet' },
  { value: 'barley', label: 'Barley' },
  { value: 'oilseed_rape', label: 'Oilseed rape' },
  { value: 'cover_crop', label: 'Cover crop' },
  { value: 'grass', label: 'Grass' },
  { value: 'other', label: 'Other' },
];

interface UnassignedField {
  id: string;
  name: string;
  hectares: number;
}

interface Props {
  fields: UnassignedField[];
  seasonId: string;
  seasonYear: number;
}

/**
 * Sprint 13 founder-walkthrough finding: SetupGuide only ever appeared when
 * a season had ZERO field-seasons total — once the first field got a crop,
 * any OTHER field added later (the normal case for a real farm with several
 * fields) had no UI path to ever get a crop assigned. This banner covers
 * that gap without hiding the rest of the Activities page the way
 * SetupGuide's full-page takeover does — a farm with existing recorded
 * activities shouldn't lose its own activity table just because one new
 * field hasn't been assigned yet.
 */
export function UnassignedFieldsBanner({ fields, seasonId, seasonYear }: Props) {
  const router = useRouter();
  const [addingFieldId, setAddingFieldId] = useState<string | null>(null);
  const initial: SeasonFormState = {};
  const [state, formAction, pending] = useActionState(addFieldToSeason, initial);

  useEffect(() => {
    if (state.success) {
      setAddingFieldId(null);
      router.refresh();
    }
  }, [state.success, router]);

  if (fields.length === 0) return null;

  return (
    <div className={styles.unassignedBanner}>
      <p className={styles.unassignedTitle}>
        {fields.length} field{fields.length !== 1 ? 's' : ''} not yet assigned a crop for {seasonYear}
      </p>
      {state.error && <div className={styles.unassignedError}>{state.error}</div>}
      <div className={styles.unassignedList}>
        {fields.map((field) => (
          <div key={field.id} className={styles.unassignedRow}>
            <span>{field.name} ({field.hectares.toFixed(1)} ha)</span>
            {addingFieldId === field.id ? (
              <form action={formAction} className={styles.unassignedForm}>
                <input type="hidden" name="fieldId" value={field.id} />
                <input type="hidden" name="seasonId" value={seasonId} />
                <select name="crop" className={styles.unassignedSelect} defaultValue="wheat">
                  {CROP_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <Button type="submit" variant="primary" size="sm" loading={pending}>Add</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingFieldId(null)}>Cancel</Button>
              </form>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setAddingFieldId(field.id)}>
                + Add to season
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
