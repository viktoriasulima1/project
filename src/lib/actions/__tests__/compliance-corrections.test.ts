import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn(), getClerkUserId: vi.fn() }));
vi.mock('@/lib/ctgb-snapshot', () => ({
  buildCtgbSnapshotExtra: vi.fn(() => ({
    ctgbSourceProductId: null,
    ctgbSourceVersion: null,
    ctgbRawChecksum: null,
    ctgbComplianceStatus: 'manual_unverified',
    ctgbSelectedUse: null,
  })),
}));

vi.mock('@/lib/db', () => {
  const _tx = {
    activity: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    inventoryItem: { findFirst: vi.fn() },
    machine: { findFirst: vi.fn() },
    stockMovement: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    complianceRecord: { create: vi.fn(), findFirst: vi.fn() },
    auditEvent: { create: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  };
  const db = {
    $transaction: vi.fn((cb: (tx: typeof _tx) => unknown) => cb(_tx)),
    _tx,
    activity: { findFirst: vi.fn() },
    inventoryItem: { findFirst: vi.fn() },
  };
  return { db };
});

import { correctActivity, reverseActivity, previewActivityCorrection, previewActivityReversal } from '../compliance-corrections';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { buildCtgbSnapshotExtra } from '@/lib/ctgb-snapshot';
import { db } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (db as any)._tx as {
  activity: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  inventoryItem: { findFirst: ReturnType<typeof vi.fn> };
  machine: { findFirst: ReturnType<typeof vi.fn> };
  stockMovement: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  complianceRecord: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  auditEvent: { create: ReturnType<typeof vi.fn> };
  $executeRaw: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
};

const IDS = {
  farm: 'a0000001-0000-4000-8000-000000000001',
  fieldSeason: 'b0000002-0000-4000-8000-000000000002',
  product: 'c0000003-0000-4000-8000-000000000003',
  newProduct: 'c0000003-0000-4000-8000-000000000009',
  machine: 'e0000005-0000-4000-8000-000000000005',
  activity: 'f0000006-0000-4000-8000-000000000006',
  corrected: 'f0000006-0000-4000-8000-000000000007',
};

const FARM = { id: IDS.farm, clerkUserId: 'user-001' };

const PREVIOUS_ACTIVITY = {
  id: IDS.activity,
  fieldSeasonId: IDS.fieldSeason,
  status: 'completed',
  type: 'spray',
  isReversal: false,
  version: 1,
  correctionOfId: null,
  rootActivityId: null,
  operatorName: 'Jan de Vries',
  certificateNumber: null,
  waterVolumePerHa: '200.0',
  nozzleType: 'flat_fan',
  machineId: IDS.machine,
  areaHa: '10.00',
  productId: IDS.product,
  dosePerHa: '2.000',
  doseUnit: 'L',
  bbchStage: null,
  notes: null,
  weatherTempC: null,
  weatherWindKmh: null,
  weatherWindDir: null,
  weatherHumidity: null,
  date: new Date('2026-06-01T10:00:00.000Z'),
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
  fieldSeason: {
    crop: 'wheat',
    field: { name: 'Rijnkamp Noord', hectares: '24.30' },
    season: { year: 2026 },
  },
  product: { id: IDS.product, name: 'Amistar Opti', farmId: IDS.farm, currentStock: '480.000' },
  machine: { id: IDS.machine, name: 'Sprayer 1', farmId: IDS.farm },
};

function correctionFd(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    activityId: IDS.activity,
    expectedVersion: '1',
    correctionReason: 'Treated area was measured wrong on the day.',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    operatorName: 'Jan de Vries',
    machineId: IDS.machine,
    nozzleType: 'flat_fan',
    productId: IDS.product,
    dosePerHa: '2',
    doseUnit: 'L',
    waterVolumePerHa: '200',
    areaHa: '10',
    date: '2026-06-01T10:00',
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

function reversalFd(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    activityId: IDS.activity,
    expectedVersion: '1',
    reason: 'This spray never actually happened — recorded by mistake.',
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe('correctActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-001');
    (db.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    tx.activity.findFirst.mockImplementation(({ where }: { where: { correctionOfId?: string } }) => {
      if (where.correctionOfId) return Promise.resolve(null); // no existing correction by default
      return Promise.resolve(PREVIOUS_ACTIVITY);
    });
    tx.activity.findMany.mockResolvedValue([PREVIOUS_ACTIVITY]); // chain = just the original
    tx.activity.create.mockResolvedValue({ id: IDS.corrected });
    tx.machine.findFirst.mockResolvedValue({ farmId: IDS.farm, name: 'Sprayer 1' });
    tx.inventoryItem.findFirst.mockResolvedValue({
      id: IDS.product, name: 'Amistar Opti', registrationNumber: 'CTB123', farmId: IDS.farm, currentStock: '480.000', ctgbProductReference: null,
    });
    tx.stockMovement.create.mockResolvedValue({ id: 'movement-1' });
    tx.complianceRecord.create.mockResolvedValue({ id: 'compliance-1' });
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    tx.$executeRaw.mockResolvedValue(1);
    tx.$queryRaw.mockResolvedValue([]);
  });

  // Test 6
  it('creates a new effective version referencing the original, incrementing the version number', async () => {
    const result = await correctActivity({}, correctionFd());
    expect(result.success).toBe(true);
    expect(tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correctionOfId: IDS.activity, rootActivityId: IDS.activity, version: 2, isReversal: false }) }),
    );
  });

  // Test 7
  it('never updates the original activity row', async () => {
    await correctActivity({}, correctionFd());
    expect(tx.activity.update).not.toHaveBeenCalled();
  });

  // Test 8
  it('requires a correction reason of meaningful length', async () => {
    const result = await correctActivity({}, correctionFd({ correctionReason: 'too short' }));
    expect(result.fieldErrors?.correctionReason).toBeDefined();
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  // Test 9
  it('records old and new values for exactly the fields that changed', async () => {
    await correctActivity({}, correctionFd({ areaHa: '12' }));
    expect(tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correctionDiff: expect.objectContaining({ areaHa: { old: 10, new: 12 } }),
        }),
      }),
    );
    // Unchanged fields must not appear in the diff.
    const call = tx.activity.create.mock.calls[0][0];
    expect(call.data.correctionDiff.operatorName).toBeUndefined();
  });

  // Test 10
  it('rejects a correction submitted against a stale (already-corrected) version', async () => {
    const alreadyCorrected = { ...PREVIOUS_ACTIVITY, id: 'newer-version-id', version: 2, correctionOfId: IDS.activity, createdAt: new Date('2026-06-02T00:00:00.000Z') };
    tx.activity.findMany.mockResolvedValue([PREVIOUS_ACTIVITY, alreadyCorrected]);
    const result = await correctActivity({}, correctionFd({ expectedVersion: '1' }));
    expect(result.error).toContain('changed by another action');
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  // Test 11
  it('is idempotent under a double submission with the same idempotency key', async () => {
    tx.activity.findFirst.mockImplementation(({ where }: { where: { correctionOfId?: string } }) => {
      if (where.correctionOfId) {
        return Promise.resolve({ id: 'already-created-correction', correctionDiff: { idempotencyKey: '11111111-1111-4111-8111-111111111111' } });
      }
      return Promise.resolve(PREVIOUS_ACTIVITY);
    });
    const result = await correctActivity({}, correctionFd());
    expect(result.success).toBe(true);
    expect(result.correctedActivityId).toBe('already-created-correction');
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  // Test 12
  it('adds a compensating stock movement when the corrected quantity is lower', async () => {
    // 10ha × 2L/ha = 20L originally; correcting to 8ha × 2L/ha = 16L → -4L.
    await correctActivity({}, correctionFd({ areaHa: '8' }));
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: 'correction', quantity: 4 }) }),
    );
  });

  // Test 13
  it('deducts the additional quantity when the corrected quantity is higher', async () => {
    // 20L originally; correcting to 12ha × 2L/ha = 24L → +4L additional deduction.
    await correctActivity({}, correctionFd({ areaHa: '12' }));
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: 'out', quantity: 4 }) }),
    );
  });

  it('blocks the correction when the additional deduction exceeds available stock', async () => {
    tx.$executeRaw.mockResolvedValue(0); // guarded UPDATE matched 0 rows = insufficient stock
    const result = await correctActivity({}, correctionFd({ areaHa: '12' }));
    expect(result.error).toContain('Insufficient stock');
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  // Test 14
  it('never updates or deletes an existing stock movement — only creates new ones', async () => {
    await correctActivity({}, correctionFd({ areaHa: '8' }));
    expect(tx.stockMovement.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.delete).not.toHaveBeenCalled();
  });

  // Test 16
  it('acquires a row lock before making any writes (concurrency safety)', async () => {
    await correctActivity({}, correctionFd());
    expect(tx.$queryRaw).toHaveBeenCalled();
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const createOrder = tx.activity.create.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(createOrder);
  });

  // Test 2
  it('shares one correlationId across the activity, compliance, and stock-movement audit events', async () => {
    await correctActivity({}, correctionFd({ areaHa: '8' }));
    const correlationIds = new Set(tx.auditEvent.create.mock.calls.map((c) => c[0].data.correlationId));
    expect(correlationIds.size).toBe(1);
    const stockMovementCorrelationId = tx.stockMovement.create.mock.calls[0][0].data.correlationId;
    expect(correlationIds.has(stockMovementCorrelationId)).toBe(true);
  });

  // Test 21
  it('uses the NEW product\'s Ctgb reference when the product is changed in a correction, not the old one', async () => {
    const newCtgbRow = { id: 'ctgb-2', sourceProductId: 'src-2' };
    tx.inventoryItem.findFirst.mockResolvedValue({
      id: IDS.newProduct, name: 'New Product', registrationNumber: 'CTB999', farmId: IDS.farm, currentStock: '100.000', ctgbProductReference: newCtgbRow,
    });
    await correctActivity({}, correctionFd({ productId: IDS.newProduct }));
    expect(vi.mocked(buildCtgbSnapshotExtra)).toHaveBeenCalledWith(newCtgbRow, 'wheat', 2, 'L');
  });

  it('rejects a product that does not belong to this farm', async () => {
    tx.inventoryItem.findFirst.mockResolvedValue({ id: IDS.newProduct, name: 'X', registrationNumber: null, farmId: 'OTHER-FARM', currentStock: '10', ctgbProductReference: null });
    const result = await correctActivity({}, correctionFd({ productId: IDS.newProduct }));
    expect(result.error).toContain('does not belong to this farm');
  });

  it('rejects correcting a record that is itself a reversal', async () => {
    tx.activity.findFirst.mockImplementation(({ where }: { where: { correctionOfId?: string } }) => {
      if (where.correctionOfId) return Promise.resolve(null);
      return Promise.resolve({ ...PREVIOUS_ACTIVITY, isReversal: true });
    });
    const result = await correctActivity({}, correctionFd());
    expect(result.error).toContain('reversed record');
  });
});

describe('reverseActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-001');
    (db.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    tx.activity.findFirst.mockImplementation(({ where }: { where: { correctionOfId?: string } }) => {
      if (where.correctionOfId) return Promise.resolve(null);
      return Promise.resolve(PREVIOUS_ACTIVITY);
    });
    tx.activity.findMany.mockResolvedValue([PREVIOUS_ACTIVITY]);
    tx.activity.create.mockResolvedValue({ id: 'reversal-1' });
    tx.stockMovement.create.mockResolvedValue({ id: 'movement-r1' });
    tx.complianceRecord.findFirst.mockResolvedValue({ id: 'compliance-orig', framework: 'EU_SPRAY_DIARY_2009_128_EC', data: { fieldName: 'Rijnkamp Noord' } });
    tx.complianceRecord.create.mockResolvedValue({ id: 'compliance-r1' });
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    tx.$executeRaw.mockResolvedValue(1);
    tx.$queryRaw.mockResolvedValue([]);
  });

  // Test 15
  it('restores stock via a compensating movement without touching the original movement', async () => {
    const result = await reverseActivity({}, reversalFd());
    expect(result.success).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: 'correction', quantity: 20 }) }),
    );
    expect(tx.stockMovement.update).not.toHaveBeenCalled();
  });

  it('marks the new row isReversal=true and keeps the original visible (never deletes/updates it)', async () => {
    await reverseActivity({}, reversalFd());
    expect(tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isReversal: true, correctionOfId: IDS.activity }) }),
    );
    expect(tx.activity.update).not.toHaveBeenCalled();
  });

  it('requires a reason', async () => {
    const result = await reverseActivity({}, reversalFd({ reason: 'short' }));
    expect(result.fieldErrors?.reason).toBeDefined();
  });

  it('rejects reversing an already-reversed record', async () => {
    tx.activity.findFirst.mockImplementation(({ where }: { where: { correctionOfId?: string } }) => {
      if (where.correctionOfId) return Promise.resolve(null);
      return Promise.resolve({ ...PREVIOUS_ACTIVITY, isReversal: true });
    });
    const result = await reverseActivity({}, reversalFd());
    expect(result.error).toContain('already been reversed');
  });

  it('rejects a reversal submitted against a stale version', async () => {
    const alreadyReversed = { ...PREVIOUS_ACTIVITY, id: 'reversal-existing', version: 2, correctionOfId: IDS.activity, isReversal: true, createdAt: new Date('2026-06-02T00:00:00.000Z') };
    tx.activity.findMany.mockResolvedValue([PREVIOUS_ACTIVITY, alreadyReversed]);
    const result = await reverseActivity({}, reversalFd({ expectedVersion: '1' }));
    expect(result.error).toContain('changed by another action');
  });

  it('is idempotent under a double submission with the same idempotency key', async () => {
    tx.activity.findFirst.mockImplementation(({ where }: { where: { correctionOfId?: string; isReversal?: boolean } }) => {
      if (where.correctionOfId) return Promise.resolve({ id: 'already-reversed', correctionDiff: { idempotencyKey: '22222222-2222-4222-8222-222222222222' } });
      return Promise.resolve(PREVIOUS_ACTIVITY);
    });
    const result = await reverseActivity({}, reversalFd());
    expect(result.reversedActivityId).toBe('already-reversed');
    expect(tx.activity.create).not.toHaveBeenCalled();
  });
});

describe('previewActivityCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(db.activity.findFirst).mockResolvedValue(PREVIOUS_ACTIVITY as never);
  });

  it('previews a stock difference without writing anything', async () => {
    const fd = correctionFd({ areaHa: '8' });
    const result = await previewActivityCorrection(IDS.activity, fd);
    expect(result.preview?.stockChanges).toHaveLength(1);
    expect(result.preview?.stockChanges[0].quantityDelta).toBeCloseTo(-4);
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  it('rejects an activity not belonging to this farm', async () => {
    vi.mocked(db.activity.findFirst).mockResolvedValue(null);
    const result = await previewActivityCorrection('someone-elses-id', correctionFd());
    expect(result.error).toContain('not found');
  });
});

describe('previewActivityReversal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
  });

  it('previews the stock that would be restored', async () => {
    vi.mocked(db.activity.findFirst).mockResolvedValue(PREVIOUS_ACTIVITY as never);
    const result = await previewActivityReversal(IDS.activity);
    expect(result.preview?.stockRestored).toEqual([{ productName: 'Amistar Opti', quantity: 20 }]);
  });
});
