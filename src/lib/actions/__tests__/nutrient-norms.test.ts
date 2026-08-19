import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
const { mockDb } = vi.hoisted(() => ({ mockDb: { nutrientNormReference: { upsert: vi.fn() } } }));
vi.mock('@/lib/db', () => ({ db: mockDb }));

import { upsertNutrientNormReference } from '../nutrient-norms';
import { getActiveFarmOrThrow } from '@/lib/farm';

describe('upsertNutrientNormReference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.nutrientNormReference.upsert.mockResolvedValue({ id: 'norm-1' });
  });

  it('upserts one reference per farm and crop, never looking anything up automatically', async () => {
    const result = await upsertNutrientNormReference({ crop: 'wheat', nitrogenNormKgPerHa: 220, phosphateNormKgPerHa: 65, source: 'RVO Tabel 2, 2026', verifiedAt: '2026-02-01' });
    expect(result).toEqual({ success: true, normId: 'norm-1' });
    expect(mockDb.nutrientNormReference.upsert).toHaveBeenCalledWith({
      where: { farmId_crop: { farmId: 'farm-1', crop: 'wheat' } },
      create: { farmId: 'farm-1', crop: 'wheat', nitrogenNormKgPerHa: 220, phosphateNormKgPerHa: 65, source: 'RVO Tabel 2, 2026', verifiedAt: new Date('2026-02-01') },
      update: { nitrogenNormKgPerHa: 220, phosphateNormKgPerHa: 65, source: 'RVO Tabel 2, 2026', verifiedAt: new Date('2026-02-01') },
    });
  });

  it('rejects a nitrogen norm outside the sane 0-999 range', async () => {
    const result = await upsertNutrientNormReference({ crop: 'wheat', nitrogenNormKgPerHa: 5000 });
    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_QUANTITY' } });
    expect(mockDb.nutrientNormReference.upsert).not.toHaveBeenCalled();
  });

  it('does not reveal farm details when there is no active farm', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('foreign farm details'));
    const result = await upsertNutrientNormReference({ crop: 'wheat' });
    expect(result).toMatchObject({ success: false, error: { code: 'AUTH_REQUIRED' } });
    expect(mockDb.nutrientNormReference.upsert).not.toHaveBeenCalled();
  });
});
