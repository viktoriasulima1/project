import { describe, it, expect } from 'vitest';
import { fieldActionAvailability, type FieldAction, type FieldActionAvailability } from '../field-actions';
import { translateFieldActionReason } from '@/i18n/adapters/field-action';
import { getNamespace } from '@/i18n/catalog';
import { createTranslator } from '@/i18n/translator';
import { SUPPORTED_LOCALES } from '@/i18n/locales';

const ALL: FieldAction[] = ['add_expense', 'add_harvest', 'add_revenue', 'allocate', 'correct', 'reverse', 'review_breakdown', 'view_history', 'export_report'];
const t = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'fields'), fallback: getNamespace('en-GB', 'fields') });

// 1/2..10 — CHARACTERIZATION: decisions identical to the previous resolver
describe('field action availability decisions (unchanged)', () => {
  it('online + no season: mutations available, Add revenue blocked by season', () => {
    const a = fieldActionAvailability({ online: true, hasActiveSeason: false });
    expect(a.allocate.available).toBe(true);
    expect(a.correct.available).toBe(true);
    expect(a.add_revenue.available).toBe(false);
    expect(a.add_revenue.code).toBe('NO_ACTIVE_SEASON');
  });
  it('offline: reallocate/correct/reverse/export disabled OFFLINE_ONLY; viewing stays available', () => {
    const a = fieldActionAvailability({ online: false, hasActiveSeason: true });
    for (const action of ['allocate', 'correct', 'reverse', 'export_report'] as FieldAction[]) {
      expect(a[action].available).toBe(false);
      expect(a[action].code).toBe('OFFLINE_ONLY');
      if (!a[action].available) expect(a[action].metadata.actionType).toBe(action);
    }
    for (const action of ['add_expense', 'add_harvest', 'review_breakdown', 'view_history'] as FieldAction[]) {
      expect(a[action].available).toBe(true);
    }
  });
  it('the enabled/disabled truth table matches the old boolean contract exactly', () => {
    for (const online of [true, false]) {
      for (const hasActiveSeason of [true, false]) {
        const a = fieldActionAvailability({ online, hasActiveSeason });
        const oldEnabled = (action: FieldAction) =>
          action === 'add_revenue' ? hasActiveSeason
          : ['allocate', 'correct', 'reverse', 'export_report'].includes(action) ? online
          : true;
        for (const action of ALL) expect(a[action].available, `${action} online=${online} season=${hasActiveSeason}`).toBe(oldEnabled(action));
      }
    }
  });
});

// 11 — resolver returns NO final English prose, only codes + canonical metadata
it('11 — resolver output carries codes/metadata only, never reason/message prose', () => {
  const a = fieldActionAvailability({ online: false, hasActiveSeason: false });
  for (const action of ALL) {
    const r = a[action] as FieldActionAvailability & Record<string, unknown>;
    expect(Object.keys(r).sort()).toEqual(r.available ? ['available', 'code'] : ['available', 'code', 'metadata']);
    expect(['AVAILABLE', 'OFFLINE_ONLY', 'NO_ACTIVE_SEASON']).toContain(r.code);
    expect(r.reason).toBeUndefined();
    expect(r.message).toBeUndefined();
  }
});

// 12 — every reason code translated in all four locales; available → null
describe('presentation adapter', () => {
  it('12 — each disabled code resolves to a non-empty localized reason in every locale', () => {
    const offlineState: FieldActionAvailability = { available: false, code: 'OFFLINE_ONLY', metadata: { actionType: 'allocate' } };
    const seasonState: FieldActionAvailability = { available: false, code: 'NO_ACTIVE_SEASON', metadata: { actionType: 'add_revenue' } };
    for (const locale of SUPPORTED_LOCALES) {
      expect(translateFieldActionReason(t(locale), { available: true, code: 'AVAILABLE' })).toBeNull();
      expect(translateFieldActionReason(t(locale), offlineState)!.length).toBeGreaterThan(0);
      expect(translateFieldActionReason(t(locale), seasonState)!.length).toBeGreaterThan(0);
    }
    // real translations, not English copies
    expect(translateFieldActionReason(t('nl-NL'), offlineState)).toContain('offline niet beschikbaar');
    expect(translateFieldActionReason(t('de-DE'), seasonState)).toContain('Saison');
  });
  it('14 — an unknown runtime code degrades to the generic reason, never a raw code', () => {
    const bogus = { available: false, code: 'TOTALLY_UNKNOWN', metadata: { actionType: 'allocate' } } as unknown as FieldActionAvailability;
    const msg = translateFieldActionReason(t('en-GB'), bogus);
    expect(msg).toBe(t('en-GB')('actions.reasons.unavailable'));
    expect(msg).not.toContain('TOTALLY_UNKNOWN');
  });
});

// 16 — canonical action IDs unchanged
it('16 — action tokens are the canonical set', () => {
  expect(Object.keys(fieldActionAvailability({ online: true, hasActiveSeason: true })).sort()).toEqual([...ALL].sort());
});
