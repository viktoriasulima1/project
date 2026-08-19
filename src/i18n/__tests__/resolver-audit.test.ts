import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards the `i18n:audit -- resolvers` heuristic (domain-prose blind-spot
 * detector). Mirrors `looksLikeProse` in scripts/i18n-audit.ts.
 */
function looksLikeProse(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) return false;
  if (v.includes('/') || v.includes('@') || v.includes('.ts') || v.includes('${') || v.includes('_')) return false;
  if (!/\s/.test(v)) return false;
  if (!/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v)) return false;
  return /^[A-Z]/.test(v) || /[.?!]"?$/.test(v);
}

describe('resolver-prose heuristic', () => {
  it('flags user-facing domain sentences', () => {
    expect(looksLikeProse('No active crop season is available.')).toBe(true);
    expect(looksLikeProse('Attention required')).toBe(true);
    expect(looksLikeProse('Plan a crop season before assessing crop health.')).toBe(true);
  });
  it('ignores canonical tokens, enums and identifiers', () => {
    expect(looksLikeProse('no_active_season')).toBe(false); // snake_case token
    expect(looksLikeProse('attention_required')).toBe(false);
    expect(looksLikeProse('active')).toBe(false); // single word
    expect(looksLikeProse('@/lib/db')).toBe(false); // path
    expect(looksLikeProse('high')).toBe(false);
  });
  it('the field-health resolver is now prose-free (Stage 2B regression guard)', () => {
    // Stage 2B finalized the resolver to codes only. It must never regress to
    // embedding farmer-facing English or an exported English label map.
    const src = readFileSync(path.resolve(process.cwd(), 'src/lib/scouting/field-health.ts'), 'utf8');
    expect(src).not.toMatch(/No active crop season is available\./);
    expect(src).not.toMatch(/FIELD_HEALTH_LABELS/);
    expect(src).not.toMatch(/\bexplanation\b/);
    expect(src).not.toMatch(/primaryEvidence/);
    expect(src).not.toMatch(/recommendedAction/);
  });
});
