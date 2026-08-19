'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { createSeason, addFieldToSeason } from '@/lib/actions/seasons';
import type { SeasonFormState } from '@/lib/actions/seasons';
import styles from './SetupGuide.module.css';

interface Field {
  id: string;
  name: string;
  hectares: number;
}

interface Props {
  activeSeason: { id: string; year: number } | null;
  fields: Field[];
}

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

const seasonInitial: SeasonFormState = {};
const fieldInitial: SeasonFormState = {};

export function SetupGuide({ activeSeason, fields }: Props) {
  const router = useRouter();
  const [seasonState, seasonAction, seasonPending] = useActionState(createSeason, seasonInitial);
  const [fieldState, fieldAction, fieldPending] = useActionState(addFieldToSeason, fieldInitial);
  const [addingFieldId, setAddingFieldId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (seasonState.success) router.refresh();
  }, [seasonState.success, router]);

  useEffect(() => {
    if (fieldState.success) {
      setAddingFieldId(null);
      router.refresh();
    }
  }, [fieldState.success, router]);

  if (!activeSeason) {
    return (
      <div className={styles.guide}>
        <div className={styles.icon}>🌾</div>
        <h2 className={styles.title}>Create a season to start logging</h2>
        <p className={styles.desc}>
          FarmOS organises activities by season. Create a season for {currentYear} to begin
          logging spray diary entries, fertiliser applications, and harvests.
        </p>

        {seasonState.error && (
          <div className={styles.error}>{seasonState.error}</div>
        )}

        <form action={seasonAction} className={styles.form}>
          <input type="hidden" name="year" value={currentYear} />
          <input type="hidden" name="startDate" value={`${currentYear}-01-01`} />
          <input type="hidden" name="endDate" value={`${currentYear}-12-31`} />

          <Button type="submit" variant="primary" loading={seasonPending}>
            Create {currentYear} season
          </Button>
        </form>

        {fields.length === 0 && (
          <p className={styles.hint}>
            You have no fields yet.{' '}
            <a href="/fields" style={{ color: 'var(--color-accent)' }}>
              Add fields first
            </a>
            {' '}before setting up a season.
          </p>
        )}
      </div>
    );
  }

  // Season exists but no field seasons — help user add fields to it
  return (
    <div className={styles.guide}>
      <div className={styles.icon}>▦</div>
      <h2 className={styles.title}>Add fields to {activeSeason.year} season</h2>
      <p className={styles.desc}>
        Season {activeSeason.year} is active. Add your fields and assign the crop grown
        in each field this season.
      </p>

      {fields.length === 0 ? (
        <p className={styles.hint}>
          No fields found.{' '}
          <a href="/fields" style={{ color: 'var(--color-accent)' }}>
            Add fields
          </a>
          {' '}first, then come back to assign them to this season.
        </p>
      ) : (
        <div className={styles.fieldList}>
          {fields.map((field) => (
            <div key={field.id} className={styles.fieldRow}>
              <div className={styles.fieldInfo}>
                <span className={styles.fieldName}>{field.name}</span>
                <span className={styles.fieldHa}>{Number(field.hectares).toFixed(1)} ha</span>
              </div>

              {addingFieldId === field.id ? (
                <form action={fieldAction} className={styles.cropForm}>
                  <input type="hidden" name="fieldId" value={field.id} />
                  <input type="hidden" name="seasonId" value={activeSeason.id} />
                  <select name="crop" className={styles.cropSelect} defaultValue="wheat">
                    {CROP_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <Button type="submit" variant="primary" size="sm" loading={fieldPending}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddingFieldId(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingFieldId(field.id)}
                >
                  + Add to season
                </Button>
              )}
            </div>
          ))}

          {fieldState.error && (
            <div className={styles.error}>{fieldState.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
