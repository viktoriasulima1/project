import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    farm: { findUnique: vi.fn(), create: vi.fn() },
    inventoryItem: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    employee: { create: vi.fn() },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockGetClerkUserId } = vi.hoisted(() => ({ mockGetClerkUserId: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getClerkUserId: mockGetClerkUserId }));

import { createFarm, addOnboardingInventoryItem, addOnboardingEmployee } from '../onboarding';

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe('createFarm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when there is no authenticated Clerk session', async () => {
    mockGetClerkUserId.mockResolvedValue(null);
    const result = await createFarm({}, fd({ name: 'Test Farm', location: 'Somewhere' }));
    expect(result.errorCode).toBe('AUTH_REQUIRED');
    expect(mockDb.farm.create).not.toHaveBeenCalled();
  });

  it('links the farm to the real Clerk session id, never a client-supplied value (no mass assignment)', async () => {
    mockGetClerkUserId.mockResolvedValue('user_real_session');
    mockDb.farm.findUnique.mockResolvedValue(null);
    mockDb.farm.create.mockResolvedValue({ id: 'farm-new' });

    const form = fd({ name: 'Test Farm', location: 'Somewhere', clerkUserId: 'user_attacker_supplied' });
    const result = await createFarm({}, form);

    expect(result.success).toBe(true);
    expect(mockDb.farm.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clerkUserId: 'user_real_session' }) }),
    );
  });

  it('does not create a second farm for a user who already owns one — idempotent under duplicate submission', async () => {
    mockGetClerkUserId.mockResolvedValue('user_real_session');
    mockDb.farm.findUnique.mockResolvedValue({ id: 'farm-existing', clerkUserId: 'user_real_session' });

    const result = await createFarm({}, fd({ name: 'Test Farm', location: 'Somewhere' }));

    expect(result.success).toBe(true);
    expect(result.farmId).toBe('farm-existing');
    expect(mockDb.farm.create).not.toHaveBeenCalled();
  });

  it('returns field errors for missing required fields without touching the database', async () => {
    mockGetClerkUserId.mockResolvedValue('user_real_session');
    const result = await createFarm({}, fd({ name: '', location: '' }));
    expect(result.fieldErrorCodes).toEqual(expect.objectContaining({ name: ['FARM_NAME_REQUIRED'], location: ['REQUIRED_FIELD'] }));
    expect(mockDb.farm.create).not.toHaveBeenCalled();
  });
});

describe('addOnboardingInventoryItem — ownership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when the Clerk user owns no farm', async () => {
    mockGetClerkUserId.mockResolvedValue('user_no_farm');
    mockDb.farm.findUnique.mockResolvedValue(null);
    const result = await addOnboardingInventoryItem({}, fd({ name: 'Product', category: 'fungicide', unit: 'L' }));
    expect(result.errorCode).toBe('NOT_FOUND');
    expect(mockDb.inventoryItem.create).not.toHaveBeenCalled();
  });

  it("creates the item under the caller's own farm", async () => {
    mockGetClerkUserId.mockResolvedValue('user_owns_farm');
    mockDb.farm.findUnique.mockResolvedValue({ id: 'farm-mine' });
    const result = await addOnboardingInventoryItem({}, fd({ name: 'Product', category: 'fungicide', unit: 'L' }));
    expect(result.success).toBe(true);
    expect(mockDb.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ farmId: 'farm-mine' }) }),
    );
  });
});

describe('addOnboardingInventoryItem — category-dependent fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClerkUserId.mockResolvedValue('user_owns_farm');
    mockDb.farm.findUnique.mockResolvedValue({ id: 'farm-mine' });
    mockDb.inventoryItem.count.mockResolvedValue(0);
  });

  it('persists crop-protection fields for a fungicide', async () => {
    await addOnboardingInventoryItem({}, fd({
      name: 'Amistar Opti', category: 'fungicide', unit: 'L',
      registrationNumber: 'CTB 13093N', activeIngredient: 'Azoxystrobin', fracCode: 'C3', hracCode: '', phiDays: '14',
    }));

    expect(mockDb.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationNumber: 'CTB 13093N',
          activeIngredient: 'Azoxystrobin',
          fracCode: 'C3',
          phiDays: 14,
        }),
      }),
    );
  });

  it('does not persist crop-protection fields for a fertiliser, even if submitted', async () => {
    await addOnboardingInventoryItem({}, fd({
      name: 'KAS 27% N', category: 'fertiliser', unit: 'kg',
      registrationNumber: 'SHOULD-NOT-SAVE', nitrogenPercent: '27',
    }));

    expect(mockDb.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationNumber: undefined,
          nitrogenPercent: 27,
        }),
      }),
    );
  });

  it('does not persist fertiliser N/P/K fields for a herbicide, even if a valid-looking value was submitted', async () => {
    await addOnboardingInventoryItem({}, fd({
      name: 'Roundup', category: 'herbicide', unit: 'L',
      nitrogenPercent: '27',
    }));

    const call = mockDb.inventoryItem.create.mock.calls[0][0];
    expect(call.data.nitrogenPercent).toBeUndefined();
  });

  it('logs first_inventory_item_created only when this is the farm\'s first product', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockDb.inventoryItem.count.mockResolvedValue(0);

    await addOnboardingInventoryItem({}, fd({ name: 'Product', category: 'seed', unit: 'bag' }));

    const events = consoleSpy.mock.calls.map(([, payload]) => JSON.parse(payload as string).event);
    expect(events).toContain('first_inventory_item_created');
    consoleSpy.mockRestore();
  });

  it('does not log first_inventory_item_created when the farm already has products', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockDb.inventoryItem.count.mockResolvedValue(2);

    await addOnboardingInventoryItem({}, fd({ name: 'Product', category: 'seed', unit: 'bag' }));

    const events = consoleSpy.mock.calls.map(([, payload]) => JSON.parse(payload as string).event);
    expect(events).not.toContain('first_inventory_item_created');
    consoleSpy.mockRestore();
  });
});

describe('addOnboardingEmployee — ownership and no verification claim', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when the Clerk user owns no farm', async () => {
    mockGetClerkUserId.mockResolvedValue('user_no_farm');
    mockDb.farm.findUnique.mockResolvedValue(null);
    const result = await addOnboardingEmployee({}, fd({ name: 'Jan' }));
    expect(result.errorCode).toBe('NOT_FOUND');
    expect(mockDb.employee.create).not.toHaveBeenCalled();
  });

  it("creates the employee under the caller's own farm", async () => {
    mockGetClerkUserId.mockResolvedValue('user_owns_farm');
    mockDb.farm.findUnique.mockResolvedValue({ id: 'farm-mine' });
    const result = await addOnboardingEmployee(
      {},
      fd({ name: 'Jan', certNumber: 'NL-1', certExpiry: '2030-01-01' }),
    );
    expect(result.success).toBe(true);
    expect(mockDb.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ farmId: 'farm-mine' }) }),
    );
  });
});
