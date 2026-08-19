import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));

vi.mock('@/lib/db', () => {
  const _tx = {
    season: { updateMany: vi.fn(), create: vi.fn() },
  };
  const db = {
    $transaction: vi.fn((cb: (tx: typeof _tx) => unknown) => cb(_tx)),
    _tx,
    field: { findFirst: vi.fn() },
    season: { findFirst: vi.fn() },
    fieldSeason: { create: vi.fn() },
  };
  return { db };
});

import { createSeason, addFieldToSeason } from '../seasons';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { db } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (db as any)._tx as {
  season: { updateMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

const FARM = { id: 'farm-1', clerkUserId: 'user-1' };

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe('createSeason — only one active season per farm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    tx.season.create.mockResolvedValue({ id: 'season-new', year: 2026 });
  });

  it('deactivates any existing active season before creating the new one, inside the same transaction', async () => {
    const result = await createSeason({}, fd({ year: '2026', startDate: '2026-01-01', endDate: '2026-12-31' }));
    expect(result.success).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.season.updateMany).toHaveBeenCalledWith({
      where: { farmId: 'farm-1', isActive: true },
      data: { isActive: false },
    });
  });

  it('rejects an end date before the start date without touching the database', async () => {
    const result = await createSeason({}, fd({ year: '2026', startDate: '2026-12-31', endDate: '2026-01-01' }));
    expect(result.error).toBeDefined();
    expect(tx.season.create).not.toHaveBeenCalled();
  });

  it('surfaces a clear error on a duplicate season without corrupting prior state', async () => {
    // Real Prisma unique-constraint errors carry `code: 'P2002'` — that's
    // what classifyError() actually keys off, not the message text.
    tx.season.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed on the fields: (`farmId`,`year`)'), { code: 'P2002' }),
    );
    const result = await createSeason({}, fd({ year: '2026', startDate: '2026-01-01', endDate: '2026-12-31' }));
    expect(result.error).toContain('already exists');
    expect(result.error).not.toContain('Unique constraint');
  });
});

describe('addFieldToSeason — cross-entity ownership verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
  });

  it('rejects a field that does not belong to the current farm', async () => {
    vi.mocked(db.field.findFirst).mockResolvedValue(null);
    const result = await addFieldToSeason({}, fd({ fieldId: 'field-foreign', seasonId: 'season-1', crop: 'wheat' }));
    expect(result.error).toContain('Field not found');
    expect(db.fieldSeason.create).not.toHaveBeenCalled();
  });

  it('rejects a season that does not belong to the current farm', async () => {
    vi.mocked(db.field.findFirst).mockResolvedValue({ id: 'field-1', name: 'Test', farmId: 'farm-1' } as never);
    vi.mocked(db.season.findFirst).mockResolvedValue(null);
    const result = await addFieldToSeason({}, fd({ fieldId: 'field-1', seasonId: 'season-foreign', crop: 'wheat' }));
    expect(result.error).toContain('Season not found');
    expect(db.fieldSeason.create).not.toHaveBeenCalled();
  });

  it('creates the field season when both field and season belong to the farm', async () => {
    vi.mocked(db.field.findFirst).mockResolvedValue({ id: 'field-1', name: 'Test', farmId: 'farm-1' } as never);
    vi.mocked(db.season.findFirst).mockResolvedValue({ id: 'season-1', farmId: 'farm-1' } as never);
    vi.mocked(db.fieldSeason.create).mockResolvedValue({ id: 'fs-1' } as never);
    const result = await addFieldToSeason({}, fd({ fieldId: 'field-1', seasonId: 'season-1', crop: 'wheat' }));
    expect(result.success).toBe(true);
  });

  it('surfaces a clear conflict error, never a raw Prisma message, when the field is already in this season', async () => {
    vi.mocked(db.field.findFirst).mockResolvedValue({ id: 'field-1', name: 'Rijnkamp Noord', farmId: 'farm-1' } as never);
    vi.mocked(db.season.findFirst).mockResolvedValue({ id: 'season-1', farmId: 'farm-1' } as never);
    vi.mocked(db.fieldSeason.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint failed on the fields: (`fieldId`,`seasonId`)'), { code: 'P2002' }),
    );
    const result = await addFieldToSeason({}, fd({ fieldId: 'field-1', seasonId: 'season-1', crop: 'wheat' }));
    expect(result.error).toContain('already added');
    expect(result.error).toContain('Rijnkamp Noord');
    expect(result.error).not.toContain('Unique constraint');
  });
});
