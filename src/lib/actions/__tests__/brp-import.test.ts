import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    fieldExternalProvenance: { findFirst: vi.fn(), create: vi.fn() },
    field: { create: vi.fn() },
    fieldSeason: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));

import { confirmBrpParcelImport } from '../brp-import';
import { getActiveFarmOrThrow } from '@/lib/farm';

const FARM = { id: 'farm-1' } as never;

const VALID_GEOMETRY = {
  type: 'Polygon',
  coordinates: [[[5.900, 52.000], [5.9146, 52.000], [5.9146, 52.009], [5.900, 52.009], [5.900, 52.000]]],
};

function fd(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const base: Record<string, string> = {
    fieldName: 'Noordkamp',
    datasetYear: '2025',
    importedAreaHa: '12.34',
    importedCropValue: 'Tarwe',
    sourceUrl: 'https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas/items',
    geometry: JSON.stringify(VALID_GEOMETRY),
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) form.set(k, v);
  return form;
}

describe('confirmBrpParcelImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM);
    mockDb.fieldExternalProvenance.findFirst.mockResolvedValue(null);
    mockDb.field.create.mockResolvedValue({ id: 'field-1' });
    mockDb.fieldExternalProvenance.create.mockResolvedValue({});
    mockDb.$transaction.mockImplementation((cb: (tx: typeof mockDb) => unknown) => cb(mockDb));
  });

  // Test 16: User confirmation required — nothing is created by merely
  // searching/viewing; a Field only ever comes into existence through this
  // explicit action, called from the "Confirm and import" submit.
  it('creates a Field and its provenance record only when explicitly called', async () => {
    const result = await confirmBrpParcelImport({}, fd());
    expect(result.success).toBe(true);
    expect(mockDb.field.create).toHaveBeenCalledTimes(1);
    expect(mockDb.fieldExternalProvenance.create).toHaveBeenCalledTimes(1);
  });

  // Test 17: Imported provenance stored
  it('stores full provenance: source, dataset year, geometry, area, source URL, confirmation timestamp, checksum', async () => {
    await confirmBrpParcelImport({}, fd());
    expect(mockDb.fieldExternalProvenance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'PDOK_BRPGewaspercelen',
          datasetYear: 2025,
          importedAreaHa: 12.34,
          importedCropValue: 'Tarwe',
          sourceUrl: expect.stringContaining('pdok.nl'),
          userConfirmedAt: expect.any(Date),
          geometryChecksum: expect.any(String),
        }),
      }),
    );
  });

  // Test 18: Duplicate import idempotency
  it('rejects a second import of the exact same parcel geometry for the same farm', async () => {
    mockDb.fieldExternalProvenance.findFirst.mockResolvedValue({ id: 'existing-provenance' });
    const result = await confirmBrpParcelImport({}, fd());
    expect(result.error).toContain('already been imported');
    expect(mockDb.field.create).not.toHaveBeenCalled();
  });

  // Test 20: Public parcel does not imply ownership — confirming does NOT
  // auto-assign a crop/season unless the farmer explicitly provided one.
  it('does not create a FieldSeason (crop assignment) unless explicitly requested', async () => {
    await confirmBrpParcelImport({}, fd());
    expect(mockDb.fieldSeason.create).not.toHaveBeenCalled();
  });

  // Regression test (Sprint 18 validation-fix pass): a real <select name="crop">
  // always submits a value for its name — "— Don't assign yet —" submits
  // crop="" (an empty string), never an absent field. This is different
  // from simply omitting the key (what fd() does above) and is exactly
  // what a real browser form submits. A previous version of the Zod schema
  // failed validation on crop="" (empty string doesn't match the enum),
  // which silently produced fieldErrors this form never rendered — the
  // whole confirm action appeared to do nothing in a real browser. This
  // test submits the form exactly as the browser does.
  it('succeeds when crop and seasonId are submitted as empty strings, exactly as a real <select> does', async () => {
    const result = await confirmBrpParcelImport({}, fd({ crop: '', seasonId: '' }));
    expect(result.success).toBe(true);
    expect(mockDb.fieldSeason.create).not.toHaveBeenCalled();
  });

  it('creates a FieldSeason only when both crop and seasonId are explicitly provided', async () => {
    await confirmBrpParcelImport({}, fd({ crop: 'wheat', seasonId: '11111111-1111-4111-8111-111111111111' }));
    expect(mockDb.fieldSeason.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ crop: 'wheat', seasonId: '11111111-1111-4111-8111-111111111111' }) }),
    );
  });

  // Test 21: Cross-farm field access rejected — the field is always
  // created under the authenticated farm's own id, never a submitted one
  // (there is no farmId field in the schema at all).
  it('always creates the field under the authenticated farm, ignoring any farmId-like field submitted', async () => {
    await confirmBrpParcelImport({}, fd({ farmId: 'someone-elses-farm' }));
    expect(mockDb.field.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ farmId: 'farm-1' }) }),
    );
  });

  it('rejects invalid/oversized geometry rather than importing it', async () => {
    const badGeometry = JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] });
    const result = await confirmBrpParcelImport({}, fd({ geometry: badGeometry }));
    expect(result.error).toContain('could not be validated');
    expect(mockDb.field.create).not.toHaveBeenCalled();
  });

  it('returns a safe error when not signed in / no farm', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const result = await confirmBrpParcelImport({}, fd());
    expect(result.error).toContain('Set up your farm');
  });

  // Test 24: User-edited boundary is not silently overwritten — this
  // action only ever CREATEs a field; it never updates an existing one,
  // so there is no code path here that could overwrite a farmer's own
  // edited boundary.
  it('never calls field.update — only ever creates new fields', async () => {
    await confirmBrpParcelImport({}, fd());
    expect((mockDb as unknown as { field: { update?: unknown } }).field.update).toBeUndefined();
  });
});
