import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockDb, getMockDb } = vi.hoisted(() => {
  const mockDb = {
    field: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    complianceRecord: { count: vi.fn() },
    activity: { count: vi.fn() },
  };
  return { mockDb, getMockDb: () => mockDb };
});

vi.mock('@/lib/db', () => ({ db: getMockDb() }));

vi.mock('@/lib/farm', () => ({
  getActiveFarmOrThrow: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { deleteField, createField } from '../fields';
import { getActiveFarmOrThrow } from '@/lib/farm';

const mockFarm = { id: 'farm-001', clerkUserId: 'user-001' };

// ─── deleteField ──────────────────────────────────────────────────────────────

describe('deleteField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(mockFarm as never);
    mockDb.field.findFirst.mockResolvedValue({
      id: 'field-001',
      name: 'Test Field',
      farmId: 'farm-001',
    });
    mockDb.complianceRecord.count.mockResolvedValue(0);
    mockDb.activity.count.mockResolvedValue(0);
    mockDb.field.delete.mockResolvedValue({});
    mockDb.field.update.mockResolvedValue({});
  });

  it('hard-deletes a field with no activities', async () => {
    const result = await deleteField('field-001');
    expect(result.error).toBeUndefined();
    expect(mockDb.field.delete).toHaveBeenCalledWith({ where: { id: 'field-001' } });
    expect(mockDb.field.update).not.toHaveBeenCalled();
  });

  it('soft-deletes when compliance records exist — never cascade-deletes regulatory data', async () => {
    mockDb.complianceRecord.count.mockResolvedValue(15);

    const result = await deleteField('field-001');
    expect(result.error).toBeUndefined();
    // Hard delete must NOT be called — cascade would destroy compliance records
    expect(mockDb.field.delete).not.toHaveBeenCalled();
    // Soft delete: sets deletedAt
    expect(mockDb.field.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it('soft-deletes when activities exist (even without compliance records)', async () => {
    mockDb.complianceRecord.count.mockResolvedValue(0);
    mockDb.activity.count.mockResolvedValue(5);

    await deleteField('field-001');
    expect(mockDb.field.delete).not.toHaveBeenCalled();
    expect(mockDb.field.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it('returns error when field does not belong to this farm', async () => {
    mockDb.field.findFirst.mockResolvedValue(null);
    const result = await deleteField('field-foreign');
    expect(result.error).toContain('Field not found');
    expect(mockDb.field.delete).not.toHaveBeenCalled();
    expect(mockDb.field.update).not.toHaveBeenCalled();
  });

  it('returns error when farm not found', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const result = await deleteField('field-001');
    expect(result.error).toBeDefined();
    expect(mockDb.field.delete).not.toHaveBeenCalled();
  });
});

// ─── createField ──────────────────────────────────────────────────────────────

describe('createField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(mockFarm as never);
    mockDb.field.create.mockResolvedValue({ id: 'new-field' });
  });

  it('creates a field with valid data and correct farmId', async () => {
    const fd = new FormData();
    fd.set('name', 'Achterste Kamp');
    fd.set('hectares', '15.5');
    fd.set('soilType', 'clay');

    const result = await createField({}, fd);
    expect(result.success).toBe(true);
    expect(mockDb.field.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Achterste Kamp',
          farmId: 'farm-001',
          soilType: 'clay',
        }),
      })
    );
  });

  it('returns fieldErrors for negative hectares', async () => {
    const fd = new FormData();
    fd.set('name', 'Bad Field');
    fd.set('hectares', '-5');
    fd.set('soilType', 'loam');

    const result = await createField({}, fd);
    expect(result.fieldErrors?.hectares).toBeDefined();
    expect(mockDb.field.create).not.toHaveBeenCalled();
  });

  it('returns fieldErrors for zero hectares', async () => {
    const fd = new FormData();
    fd.set('name', 'Zero Field');
    fd.set('hectares', '0');
    fd.set('soilType', 'loam');

    const result = await createField({}, fd);
    expect(result.fieldErrors?.hectares).toBeDefined();
    expect(mockDb.field.create).not.toHaveBeenCalled();
  });

  it('returns fieldErrors for empty name', async () => {
    const fd = new FormData();
    fd.set('name', '');
    fd.set('hectares', '10');
    fd.set('soilType', 'loam');

    const result = await createField({}, fd);
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it('returns fieldErrors for invalid soilType', async () => {
    const fd = new FormData();
    fd.set('name', 'Test');
    fd.set('hectares', '10');
    fd.set('soilType', 'concrete');

    const result = await createField({}, fd);
    expect(result.fieldErrors?.soilType).toBeDefined();
  });

  it('returns error when farm not found — does not create field', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const fd = new FormData();
    fd.set('name', 'Test');
    fd.set('hectares', '10');
    fd.set('soilType', 'loam');

    const result = await createField({}, fd);
    expect(result.error).toBeDefined();
    expect(mockDb.field.create).not.toHaveBeenCalled();
  });
});
