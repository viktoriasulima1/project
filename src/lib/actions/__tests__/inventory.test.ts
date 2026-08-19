import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));

const { mockDb } = vi.hoisted(() => ({
  mockDb: { inventoryItem: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));

const { mockSearchCtgbProducts, mockGetCtgbProductById, mockUpsertCachedProduct, mockIsRateLimited } = vi.hoisted(() => ({
  mockSearchCtgbProducts: vi.fn(),
  mockGetCtgbProductById: vi.fn(),
  mockUpsertCachedProduct: vi.fn(),
  mockIsRateLimited: vi.fn(),
}));
vi.mock('@/integrations/ctgb/client', () => ({ searchCtgbProducts: mockSearchCtgbProducts, getCtgbProductById: mockGetCtgbProductById }));
vi.mock('@/integrations/ctgb/cache', () => ({ upsertCachedProduct: mockUpsertCachedProduct }));
vi.mock('@/lib/rate-limit', () => ({ isRateLimited: mockIsRateLimited }));

import { createInventoryItem, searchCtgbProductsAction, updateInventoryNutrients } from '../inventory';
import { getActiveFarmOrThrow } from '@/lib/farm';

const FARM = { id: 'farm-1' } as never;

function fd(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const base: Record<string, string> = {
    name: 'Amistar Opti',
    category: 'fungicide',
    unit: 'L',
    currentStock: '500',
    minimumStock: '50',
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) form.set(k, v);
  return form;
}

describe('createInventoryItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM);
    mockDb.inventoryItem.create.mockResolvedValue({ id: 'item-1' });
    mockIsRateLimited.mockReturnValue(false);
    mockSearchCtgbProducts.mockResolvedValue({ state: 'ok', products: [] });
  });

  it('creates a manual-entry item marked isManualEntry=true with no Ctgb link', async () => {
    const result = await createInventoryItem({}, fd());
    expect(result.success).toBe(true);
    expect(mockDb.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isManualEntry: true, ctgbProductReferenceId: undefined }) }),
    );
  });

  it('creates a Ctgb-linked item marked isManualEntry=false after re-verifying the product', async () => {
    mockGetCtgbProductById.mockResolvedValue({
      state: 'ok',
      products: [{ sourceProductId: 'ctgb-1', officialName: 'Amistar Opti', authorisationNumber: 'NL-1', uses: [] }],
    });
    mockUpsertCachedProduct.mockResolvedValue('local-ref-1');

    const result = await createInventoryItem({}, fd({ ctgbSourceProductId: 'ctgb-1' }));
    expect(result.success).toBe(true);
    expect(mockDb.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isManualEntry: false,
          ctgbProductReferenceId: 'local-ref-1',
          registrationNumber: 'NL-1',
          name: 'Amistar Opti',
        }),
      }),
    );
  });

  // Test 10 (Sprint 18 Part 17): "Cross-farm product rejection" — the farm
  // id an item is created under always comes from the authenticated
  // session, never from client-submitted form data (there is no farmId
  // field in the schema at all, so this is structurally enforced, not just
  // conventionally).
  it('always uses the authenticated farm id, ignoring any farmId-like field a client might submit', async () => {
    const tampered = fd({ farmId: 'someone-elses-farm' });
    await createInventoryItem({}, tampered);
    expect(mockDb.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ farmId: 'farm-1' }) }),
    );
  });

  it('rejects creation when the selected Ctgb product cannot be verified (unavailable, nothing cached)', async () => {
    mockGetCtgbProductById.mockResolvedValue({ state: 'unavailable', products: [] });
    const result = await createInventoryItem({}, fd({ ctgbSourceProductId: 'ctgb-missing' }));
    expect(result.error?.code).toBe('CTGB_PRODUCT_UNVERIFIED');
    expect(mockDb.inventoryItem.create).not.toHaveBeenCalled();
  });

  it('returns a safe error when not signed in / no farm', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const result = await createInventoryItem({}, fd());
    expect(result.error?.code).toBe('AUTH_REQUIRED');
  });

  it('rejects invalid canonical unit without creating inventory', async () => {
    const result = await createInventoryItem({}, fd({ unit: 'litres' }));
    expect(result.fieldErrors?.unit.code).toBe('INVALID_UNIT');
    expect(mockDb.inventoryItem.create).not.toHaveBeenCalled();
  });

  it('rejects negative quantity without creating inventory', async () => {
    const result = await createInventoryItem({}, fd({ currentStock: '-1' }));
    expect(result.fieldErrors?.currentStock.code).toBe('INVALID_QUANTITY');
    expect(result.values?.currentStock).toBe('-1');
    expect(mockDb.inventoryItem.create).not.toHaveBeenCalled();
  });

  it('does not create inventory when the database create fails', async () => {
    mockDb.inventoryItem.create.mockRejectedValue(new Error('database unavailable'));
    const result = await createInventoryItem({}, fd());
    expect(result.success).not.toBe(true);
    expect(result.error?.code).toBe('GENERIC');
    expect(JSON.stringify(result.error)).not.toContain('database unavailable');
    expect(mockDb.inventoryItem.create).toHaveBeenCalledTimes(1);
  });

  it('maps Ctgb search authentication, rate limiting and provider failure to safe codes', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValueOnce(new Error('private auth details'));
    expect((await searchCtgbProductsAction('amistar')).error?.code).toBe('AUTH_REQUIRED');
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM);
    mockIsRateLimited.mockReturnValueOnce(true);
    expect((await searchCtgbProductsAction('amistar')).error?.code).toBe('RATE_LIMITED');
    mockSearchCtgbProducts.mockResolvedValueOnce({ state: 'unavailable', products: [], unavailableReason: 'upstream private detail' });
    const provider = await searchCtgbProductsAction('amistar');
    expect(provider.error?.code).toBe('PROVIDER_UNAVAILABLE');
    expect(JSON.stringify(provider)).not.toContain('upstream private detail');
  });
});

describe('updateInventoryNutrients', () => {
  const ITEM_ID = 'a2661b3b-2333-4cdd-82f1-746b9124312f';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.inventoryItem.findFirst.mockResolvedValue({ id: ITEM_ID, farmId: 'farm-1' });
    mockDb.inventoryItem.update.mockResolvedValue({ id: ITEM_ID });
  });

  it('sets nitrogen/phosphorus/potassium composition on a product owned by the active farm', async () => {
    const result = await updateInventoryNutrients({ itemId: ITEM_ID, nitrogenPercent: 20, phosphorusPercent: 10, potassiumPercent: 10 });
    expect(result).toEqual({ success: true, itemId: ITEM_ID });
    expect(mockDb.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { nitrogenPercent: 20, phosphorusPercent: 10, potassiumPercent: 10 },
    });
  });

  it('refuses to update a product belonging to another farm', async () => {
    mockDb.inventoryItem.findFirst.mockResolvedValue(null);
    const result = await updateInventoryNutrients({ itemId: ITEM_ID, nitrogenPercent: 20 });
    expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(mockDb.inventoryItem.update).not.toHaveBeenCalled();
  });

  it('rejects a percentage outside the valid 0-100 range', async () => {
    const result = await updateInventoryNutrients({ itemId: ITEM_ID, nitrogenPercent: 150 });
    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_QUANTITY' } });
    expect(mockDb.inventoryItem.update).not.toHaveBeenCalled();
  });
});
