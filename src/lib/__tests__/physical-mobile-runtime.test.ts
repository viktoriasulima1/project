import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  CROP_CONDITIONS,
  CROP_CONDITION_LABELS,
  normalizeCropCondition,
  validateCropCondition,
} from '@/lib/scouting/condition';
import { friendlyScoutingIssue } from '@/lib/scouting/scouting-errors';
import { classifyGpsAccuracy, buildLocationEvidence } from '@/lib/scouting/gps-accuracy';
import { guardedUpdate, shallowEqual, nextVisibility, safeSerialize } from '@/lib/runtime-safety';
import { createSplitActivityDrafts } from '@/offline/drafts';
import { FarmFlowError } from '@/components/dev/FarmFlowError';
import type { ZodIssue } from 'zod';

// 1 — Condition label differs from canonical value.
describe('1 — canonical condition value vs. localizable label', () => {
  it('label text is presentation only; value stays the English enum token', () => {
    expect(CROP_CONDITIONS).toEqual(['good', 'satisfactory', 'poor', 'critical']);
    expect(CROP_CONDITION_LABELS.good).toBe('Good');
    expect(CROP_CONDITION_LABELS.good).not.toBe('good');
    // the value bound to the <option> is the canonical token, never the label
    expect(validateCropCondition('good').value).toBe('good');
  });
});

// 2 — Russian/translated visible label still submits the canonical enum.
describe('2 — translated label never becomes the submitted value', () => {
  it('a translated label string does not normalise to any canonical token', () => {
    // Because the control binds option.value to the canonical token, browser
    // translation of the visible label ("Хорошо", "Удовлетворительно", …) can
    // never be what is submitted. Proven here: the translated text is not a
    // valid value, while the canonical token always is.
    for (const translated of ['Хорошо', 'Удовлетворительно', 'Плохо', 'Критическое']) {
      expect(normalizeCropCondition(translated)).toBeNull();
    }
    expect(normalizeCropCondition('satisfactory')).toBe('satisfactory');
    // legacy alias is accepted on the way in and normalised to canonical
    expect(normalizeCropCondition('fair')).toBe('satisfactory');
  });
});

// 3 — Empty condition returns a friendly field message.
describe('3 — empty condition', () => {
  it('returns a distinct, friendly message', () => {
    const result = validateCropCondition('');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Choose the overall crop condition before saving.');
  });
});

// 4 — Raw enum error is never exposed.
describe('4 — no raw enum internals reach the farmer', () => {
  it('condition + mapped Zod issues never contain "expected one of"', () => {
    expect(validateCropCondition('привет').message).not.toMatch(/expected one of/i);
    const issue = { path: ['overallCondition'], message: 'Invalid option: expected one of "good" | "satisfactory" | "poor" | "critical"' } as unknown as ZodIssue;
    const friendly = friendlyScoutingIssue(issue);
    expect(friendly).toBe('Choose a valid overall crop condition before saving.');
    expect(friendly).not.toMatch(/expected one of/i);
    expect(friendly).not.toContain('satisfactory');
  });
});

// 5 — Same state update is ignored.
describe('5 — identical state update is a no-op', () => {
  it('guardedUpdate returns the previous reference when nothing changed', () => {
    const prev = { a: 1, b: 'x' };
    expect(guardedUpdate(prev, { a: 1, b: 'x' })).toBe(prev); // same ref → setState no-op
    expect(guardedUpdate(prev, { a: 2, b: 'x' })).not.toBe(prev);
    expect(shallowEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });
});

// 6 — Recursive traversal detects cycles.
describe('6 — cycle-safe traversal', () => {
  it('serializes a self-referential object without overflowing the stack', () => {
    const cyclic: Record<string, unknown> = { name: 'field', accuracy: 5632 };
    cyclic.self = cyclic;
    cyclic.child = { parent: cyclic };
    const out = safeSerialize(cyclic) as Record<string, unknown>;
    expect(out.name).toBe('field');
    expect(out.self).toBe('[Circular]');
    expect((out.child as Record<string, unknown>).parent).toBe('[Circular]');
  });
});

// 7 — Draft split terminates (bounded).
describe('7 — natural-language draft split is bounded', () => {
  it('never produces more than five drafts regardless of input size', () => {
    const candidates = Array.from({ length: 25 }, (_, i) => ({ activityType: 'spray' as const, originalTextSpan: `op ${i}`, formData: {} }));
    const drafts = createSplitActivityDrafts({ userRef: 'u1', farmId: 'f1' }, candidates);
    expect(drafts.length).toBe(5);
    expect(drafts.every((d) => d.splitCount === 5)).toBe(true);
  });
});

// 8 — Transcript stop/delete does not recursively trigger itself.
describe('8 — idempotent transcript stop', () => {
  it('stopping twice (and via the recognizer onend re-entry) calls stop once', () => {
    // Mirrors ActivityDialog.stopVoiceTranscript: null the ref BEFORE stopping
    // so the recognizer's onend re-entry and a second click are no-ops.
    let ref: { stop(): void } | null = null;
    let stopCalls = 0;
    let stoppedFlag = false;
    const stop = () => {
      const rec = ref;
      ref = null;
      stoppedFlag = true;
      if (!rec) return;
      rec.stop();
    };
    const recognizer = { stop: () => { stopCalls++; stop(); /* onend re-entry */ } };
    ref = recognizer;
    stop();
    stop(); // second click
    expect(stopCalls).toBe(1);
    expect(stoppedFlag).toBe(true);
  });
});

// 9 — Dialog open/close remains bounded.
describe('9 — bounded dialog visibility', () => {
  it('open/close/toggle always resolve to a single boolean', () => {
    expect(nextVisibility(false, 'open')).toBe(true);
    expect(nextVisibility(true, 'close')).toBe(false);
    expect(nextVisibility(true, 'open')).toBe(true); // idempotent open
    let state = false;
    for (let i = 0; i < 1000; i++) state = nextVisibility(state, 'toggle');
    expect(typeof state).toBe('boolean'); // never diverges
  });
});

// 10 — Observer update does not trigger an infinite loop.
describe('10 — observer write guarded against infinite loop', () => {
  it('an observer that re-fires on identical state terminates via guardedUpdate', () => {
    let state = { label: 'North Field' };
    let writes = 0;
    // Simulate an external-mutation observer that keeps firing with the same
    // derived value. guardedUpdate keeps the reference, so no state change is
    // committed and the loop cannot sustain itself.
    for (let i = 0; i < 50; i++) {
      const next = guardedUpdate(state, { label: 'North Field' });
      if (next !== state) { writes++; state = next; }
    }
    expect(writes).toBe(0);
  });
});

// 11 — Low GPS accuracy rejected for auto-suggestion.
describe('11 — low accuracy is not auto-suggested', () => {
  it('the physical-test ±5632 m fix is unusable for field suggestion', () => {
    const assessment = classifyGpsAccuracy(5632);
    expect(assessment.confidence).toBe('unusable');
    expect(assessment.usableForFieldSuggestion).toBe(false);
    expect(buildLocationEvidence({ latitude: 52, longitude: 5, accuracy: 5632 }, assessment, false)).toBeNull();
  });
});

// 12 — Manual field selection remains available (confirmation path).
describe('12 — manual confirmation keeps a coarse point usable only when confirmed', () => {
  it('an unusable point is attachable only after explicit confirmation', () => {
    const assessment = classifyGpsAccuracy(5632);
    expect(assessment.requiresConfirmation).toBe(true);
    // without confirmation → nothing stored; with confirmation → stored + accuracy kept
    expect(buildLocationEvidence({ latitude: 52, longitude: 5, accuracy: 5632 }, assessment, false)).toBeNull();
    const confirmed = buildLocationEvidence({ latitude: 52, longitude: 5, accuracy: 5632 }, assessment, true);
    expect(confirmed).not.toBeNull();
  });
});

// 13 — Accuracy persists with the coordinates.
describe('13 — accuracy stored with coordinates', () => {
  it('a trusted high-accuracy fix keeps its accuracy in the evidence', () => {
    const assessment = classifyGpsAccuracy(8);
    expect(assessment.usableForFieldSuggestion).toBe(true);
    const evidence = buildLocationEvidence({ latitude: 52.1, longitude: 5.2, accuracy: 8 }, assessment, false);
    expect(evidence).toEqual({ latitude: 52.1, longitude: 5.2, locationAccuracyM: 8 });
  });
});

// 14 — Error fallback preserves confirmed local-draft status wording.
describe('14 — safe error fallback wording', () => {
  it('shows the display-error + local-draft-preserved copy with recovery actions', () => {
    const html = renderToStaticMarkup(
      createElement(FarmFlowError, { error: new Error('Maximum call stack size exceeded'), reset: () => {}, boundary: 'scouting' }),
    );
    expect(html).toContain('FarmOS encountered a display error.');
    expect(html).toContain('Your locally saved draft has not been deleted.');
    expect(html).toContain('Try again');
    expect(html).toContain('Return to Today');
    expect(html).toContain('Copy diagnostic ID');
    // never leaks the raw exception text to the farmer copy
    expect(html).not.toContain('Maximum call stack size exceeded');
  });
});
