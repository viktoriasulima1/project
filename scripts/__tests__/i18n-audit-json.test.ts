import { describe, expect, it } from 'vitest';
import {
  APPROVED_SUPPRESSION_CATEGORIES,
  classifyReachability,
  contractFamily,
  probableModule,
  redactMatchedText,
  safeJson,
  structuredFinding,
  suppressionCategory,
} from '../i18n-audit-json';

describe('localization audit structured output', () => {
  it('has stable JSON ordering and schema', () => {
    const sources = new Map([['src/lib/a.ts', 'export function run() {}']]);
    const a = structuredFinding('src/lib/a.ts:1 prose "Visible error text."', 'resolvers', sources);
    const parsed = JSON.parse(safeJson([a], '2026-08-01T00:00:00.000Z'));
    expect(parsed).toMatchObject({ schemaVersion: 1, generatedAt: '2026-08-01T00:00:00.000Z', findingCount: 1 });
    expect(parsed.findings[0].file).toBe('src/lib/a.ts');
  });

  it('records the source audit', () => {
    const finding = structuredFinding('src/lib/a.ts:2 prose "Visible error text."', 'resolvers', new Map());
    expect(finding.sourceAudit).toBe('resolvers');
  });

  it('groups files into product modules', () => {
    expect(probableModule('src/app/api/scouting/photos/route.ts')).toBe('Scouting photo/storage');
    expect(probableModule('src/lib/actions/field-operations.ts')).toBe('Work Orders / Planning');
  });

  it('accepts only documented suppression categories', () => {
    for (const category of APPROVED_SUPPRESSION_CATEGORIES) expect(suppressionCategory(`// i18n-audit-ignore: ${category}`)).toBe(category);
    expect(suppressionCategory('// no audit marker')).toBeNull();
  });

  it('rejects undocumented suppression comments', () => {
    expect(suppressionCategory('// i18n-audit-ignore')).toBe('invalid');
    expect(suppressionCategory('// i18n-audit-ignore: convenient')).toBe('invalid');
  });

  it('detects raw error forwarding as its own contract family', () => {
    expect(contractFamily('src/components/Form.tsx', 'raw framework/caught error forwarding')).toBe('raw technical forwarding');
  });

  it('classifies test-only paths', () => {
    expect(classifyReachability('src/lib/__tests__/thing.test.ts', 'message')).toBe('TEST_ONLY');
  });

  it('classifies internal configuration diagnostics', () => {
    expect(classifyReachability('src/lib/storage-config.ts', 'provider must be configured')).toBe('INTERNAL_DIAGNOSTIC');
  });

  it('does not mistake canonical single-token values for prose in structured descriptions', () => {
    expect(contractFamily('src/lib/state.ts', 'code: READY')).toBe('generic/status prose');
  });

  it('redacts secret-like values from JSON evidence', () => {
    const text = redactMatchedText('authorization=Bearer-secret token=abc123 password=hunter2');
    expect(text).not.toMatch(/abc123|hunter2/);
    expect(text).toContain('[REDACTED]');
  });
});
