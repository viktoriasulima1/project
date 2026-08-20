import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn(), getClerkUserId: vi.fn() }));

// The db mock exposes a `_tx` object that represents the transaction context.
// Tests configure _tx's methods before each call.
vi.mock('@/lib/db', () => {
  const _tx = {
    fieldSeason: { findFirst: vi.fn() },
    activity: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    inventoryItem: { findFirst: vi.fn() },
    machine: { findFirst: vi.fn() },
    employee: { findFirst: vi.fn() },
    stockMovement: { create: vi.fn() },
    complianceRecord: { create: vi.fn() },
    // Sprint 19 — every mutating path now also writes an audit event.
    auditEvent: { create: vi.fn() },
    $executeRaw: vi.fn(),
  };
  const db = {
    $transaction: vi.fn((cb: (tx: typeof _tx) => unknown) => cb(_tx)),
    _tx,
    // Used directly (outside the transaction) by createActivity to check
    // whether this is the farm's first-ever activity, for product events.
    activity: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn() },
  };
  return { db };
});

// Import after mocks are registered
import { completeActivity, createActivity, deleteActivity } from '../activities';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { db } from '@/lib/db';

// Access the transaction context through the module-private _tx field
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (db as any)._tx as {
  fieldSeason:     { findFirst: ReturnType<typeof vi.fn> };
  activity:        { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  inventoryItem:   { findFirst: ReturnType<typeof vi.fn> };
  machine:         { findFirst: ReturnType<typeof vi.fn> };
  employee:        { findFirst: ReturnType<typeof vi.fn> };
  stockMovement:   { create: ReturnType<typeof vi.fn> };
  complianceRecord:{ create: ReturnType<typeof vi.fn> };
  auditEvent:      { create: ReturnType<typeof vi.fn> };
  $executeRaw:     ReturnType<typeof vi.fn>;
};

// ─── Test data ────────────────────────────────────────────────────────────────

// Must be valid RFC 4122 UUIDs — Zod v4 validates version nibble (must be 1-5) and variant bits
const IDS = {
  farm:         'a0000001-0000-4000-8000-000000000001',
  fieldSeason:  'b0000002-0000-4000-8000-000000000002',
  product:      'c0000003-0000-4000-8000-000000000003',
  fertProduct:  'd0000004-0000-4000-8000-000000000004',
  machine:      'e0000005-0000-4000-8000-000000000005',
  activity:     'f0000006-0000-4000-8000-000000000006',
  inventoryOut: '10000007-0000-4000-8000-000000000007',
  inventoryOut2:'20000008-0000-4000-8000-000000000008',
};

const FARM = { id: IDS.farm, clerkUserId: 'user-001' };

const FIELD_SEASON = {
  id: IDS.fieldSeason,
  field: { name: 'Rijnkamp Noord', hectares: '24.30', farmId: IDS.farm },
  season: { year: 2026 },
  crop: 'wheat',
};

// Defaults represent a fully valid spray (all fields spray now requires via
// superRefine) — tests exercising a non-spray/no-product path pass
// `type` plus cleared product fields explicitly, rather than relying on
// these being individually optional at the base schema level.
function fd(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const base: Record<string, string> = {
    fieldSeasonId: IDS.fieldSeason,
    type: 'spray',
    date: '2026-07-07',
    operatorName: 'Jan de Vries',
    areaHa: '10',
    machineId: IDS.machine,
    nozzleType: 'flat_fan',
    productId: IDS.product,
    dosePerHa: '2',
    doseUnit: 'L',
    waterVolumePerHa: '200',
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) form.set(k, v);
  return form;
}

// ─── createActivity ───────────────────────────────────────────────────────────

describe('createActivity', () => {
  beforeEach(() => {
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-001');
    tx.fieldSeason.findFirst.mockResolvedValue(FIELD_SEASON);
    tx.activity.create.mockResolvedValue({ id: IDS.activity });
    tx.complianceRecord.create.mockResolvedValue({ id: 'compliance-1' });
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    tx.$executeRaw.mockResolvedValue(1);
    tx.stockMovement.create.mockResolvedValue({ id: 'movement-1' });
    vi.mocked(db.activity.findFirst).mockResolvedValue(null);
    // fd()'s defaults now always include a product (spray requires one) —
    // give it plenty of stock by default so tests not specifically about
    // stock edge cases don't accidentally trip "insufficient stock."
    tx.inventoryItem.findFirst.mockResolvedValue({
      name: 'Amistar Opti', registrationNumber: 'CTB123', currentStock: '500.000', farmId: IDS.farm,
    });
    // fd()'s defaults now always include a machineId (spray requires one) —
    // default it to a machine owned by this farm.
    tx.machine.findFirst.mockResolvedValue({ farmId: IDS.farm });
    tx.employee.findFirst.mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.$transaction as any).mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  });

  afterEach(() => vi.clearAllMocks());

  it('succeeds with valid spray form data', async () => {
    const result = await createActivity({}, fd());
    expect(result.success).toBe(true);
    expect(result.activityId).toBe(IDS.activity);
  });

  it('offline retry with the same key and payload returns the existing activity without duplicate effects', async () => {
    vi.mocked(db.activity.findFirst).mockResolvedValue({ id: IDS.activity, submissionHash: 'placeholder' } as never);
    // Obtain the canonical hash written by the first attempt.
    vi.mocked(db.activity.findFirst).mockResolvedValueOnce(null);
    const first = await createActivity({}, fd({ localDraftId: '30000008-0000-4000-8000-000000000008', idempotencyKey: '40000008-0000-4000-8000-000000000008' }));
    const hash = tx.activity.create.mock.calls[0][0].data.submissionHash;
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-001');
    vi.mocked(db.activity.findFirst).mockResolvedValue({ id: IDS.activity, submissionHash: hash } as never);
    const retry = await createActivity({}, fd({ localDraftId: '30000008-0000-4000-8000-000000000008', idempotencyKey: '40000008-0000-4000-8000-000000000008' }));
    expect(first.success).toBe(true);
    expect(retry).toEqual({ success: true, activityId: IDS.activity });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.complianceRecord.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('same offline idempotency key with changed payload is a conflict', async () => {
    vi.mocked(db.activity.findFirst).mockResolvedValue({ id: IDS.activity, submissionHash: 'different-hash' } as never);
    const result = await createActivity({}, fd({ localDraftId: '30000008-0000-4000-8000-000000000008', idempotencyKey: '40000008-0000-4000-8000-000000000008', notes: 'changed' }));
    expect(result.safeErrorCategory).toBe('conflict');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns fieldErrors when required fields are missing', async () => {
    const form = new FormData();
    form.set('type', 'spray');
    const result = await createActivity({}, form);
    expect(result.fieldErrors).toBeDefined();
    expect(result.success).toBeUndefined();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.activity.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.complianceRecord.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('returns error when farm is not found', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const result = await createActivity({}, fd());
    expect(result.error?.code).toBe('AUTH_REQUIRED');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns error when fieldSeason does not belong to farm', async () => {
    tx.fieldSeason.findFirst.mockResolvedValue(null);
    const result = await createActivity({}, fd());
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(result.error?.category).toBe('authorization');
  });

  it('returns error when product does not belong to farm — cross-farm protection', async () => {
    tx.inventoryItem.findFirst.mockResolvedValue({
      name: 'Amistar',
      registrationNumber: null,
      currentStock: '100.000',
      farmId: 'OTHER-FARM-ID', // different farm!
    });
    const result = await createActivity({}, fd({ productId: IDS.product, dosePerHa: '2', doseUnit: 'L' }));
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(result.error?.category).toBe('authorization');
  });

  it('returns error when machine does not belong to farm — cross-farm protection (Sprint 12 fix)', async () => {
    tx.machine.findFirst.mockResolvedValue({ farmId: 'OTHER-FARM-ID' });
    const result = await createActivity({}, fd());
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(result.error?.category).toBe('authorization');
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  it('returns error when the machine id does not exist at all', async () => {
    tx.machine.findFirst.mockResolvedValue(null);
    const result = await createActivity({}, fd());
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('blocks a spray when the matched operator has no spraying certification', async () => {
    tx.employee.findFirst.mockResolvedValue({ hasSpraying: false, certExpiry: null });
    const result = await createActivity({}, fd());
    expect(result.error?.code).toBe('OPERATOR_NOT_CERTIFIED');
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  it('blocks a spray when the matched operator\'s certificate has expired', async () => {
    tx.employee.findFirst.mockResolvedValue({ hasSpraying: true, certExpiry: new Date('2020-01-01') });
    const result = await createActivity({}, fd());
    expect(result.error?.code).toBe('OPERATOR_CERTIFICATE_EXPIRED');
    expect(tx.activity.create).not.toHaveBeenCalled();
  });

  it('allows a spray when the matched operator is certified and not expired', async () => {
    const farFuture = new Date(); farFuture.setFullYear(farFuture.getFullYear() + 1);
    tx.employee.findFirst.mockResolvedValue({ hasSpraying: true, certExpiry: farFuture });
    const result = await createActivity({}, fd());
    expect(result.success).toBe(true);
  });

  it('does not block a spray when the operator name matches no employee record', async () => {
    tx.employee.findFirst.mockResolvedValue(null);
    const result = await createActivity({}, fd({ operatorName: 'Contractor Not In Team' }));
    expect(result.success).toBe(true);
  });

  it('does not check operator certification for non-spray activity types', async () => {
    const result = await createActivity({}, fd({
      type: 'fertilise', machineId: '', nozzleType: '', waterVolumePerHa: '',
      productId: IDS.fertProduct, dosePerHa: '50', doseUnit: 'kg',
    }));
    expect(tx.employee.findFirst).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('returns error when stock is insufficient (app-level pre-check)', async () => {
    tx.inventoryItem.findFirst.mockResolvedValue({
      name: 'Amistar',
      registrationNumber: 'CTB123',
      currentStock: '5.000', // only 5L available
      farmId: IDS.farm,
    });
    // 10 ha × 2 L/ha = 20L needed
    const result = await createActivity({}, fd({ productId: IDS.product, dosePerHa: '2', doseUnit: 'L' }));
    expect(result.error?.code).toBe('INSUFFICIENT_STOCK');
  });

  it('returns error when concurrent DB deduction wins (race condition protection)', async () => {
    tx.inventoryItem.findFirst.mockResolvedValue({
      name: 'Amistar',
      registrationNumber: null,
      currentStock: '20.000',
      farmId: IDS.farm,
    });
    tx.$executeRaw.mockResolvedValue(0); // 0 rows updated = another TX won the race
    const result = await createActivity({}, fd({ productId: IDS.product, dosePerHa: '2', doseUnit: 'L' }));
    expect(result.error?.code).toBe('INSUFFICIENT_STOCK');
  });

  it('creates denormalized compliance record for spray type', async () => {
    await createActivity({}, fd());
    expect(tx.complianceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activityId: IDS.activity,
          framework: 'EU_SPRAY_DIARY_2009_128_EC',
          data: expect.objectContaining({
            fieldName: 'Rijnkamp Noord',
            crop: 'wheat',
            seasonYear: 2026,
            operatorName: 'Jan de Vries',
          }),
        }),
      })
    );
  });

  it('does NOT create compliance record for non-spray types', async () => {
    await createActivity({}, fd({ type: 'fertilise' }));
    expect(tx.complianceRecord.create).not.toHaveBeenCalled();
  });

  it('accepts a decimal wind speed reading and rounds it before writing to the SmallInt column', async () => {
    const result = await createActivity({}, fd({ weatherWindKmh: '10.5' }));
    expect(result.success).toBe(true);
    expect(tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ weatherWindKmh: 11 }),
      }),
    );
  });

  it('does not touch inventory when no product provided (harvest, which does not require one)', async () => {
    await createActivity({}, fd({ type: 'harvest', productId: '', dosePerHa: '', doseUnit: '' }));
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  // ─── Sprint 16 — planned vs completed status ───────────────────────────────

  it('defaults to status "completed" when not specified, preserving pre-Sprint-16 behavior', async () => {
    await createActivity({}, fd());
    expect(tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('a planned spray does not deduct stock', async () => {
    const result = await createActivity({}, fd({ status: 'planned' }));
    expect(result.success).toBe(true);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('a completed spray deducts stock', async () => {
    const result = await createActivity({}, fd({ status: 'completed' }));
    expect(result.success).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalled();
  });

  it('a planned spray does not create a compliance record', async () => {
    await createActivity({}, fd({ status: 'planned' }));
    expect(tx.complianceRecord.create).not.toHaveBeenCalled();
  });

  it('a completed spray creates a compliance record', async () => {
    await createActivity({}, fd({ status: 'completed' }));
    expect(tx.complianceRecord.create).toHaveBeenCalled();
  });

  it('a planned activity with insufficient current stock still saves (stock is only checked at completion time)', async () => {
    tx.inventoryItem.findFirst.mockResolvedValue({
      name: 'Amistar', registrationNumber: null, currentStock: '1.000', farmId: IDS.farm,
    });
    const result = await createActivity({}, fd({ status: 'planned', productId: IDS.product, dosePerHa: '2', doseUnit: 'L' }));
    expect(result.success).toBe(true);
  });

  describe('first-activity product events', () => {
    afterEach(() => vi.restoreAllMocks());

    it('logs first_activity_started and first_activity_completed when this is the farm\'s first activity', async () => {
      vi.mocked(db.activity.count).mockResolvedValue(0);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await createActivity({}, fd());

      const events = consoleSpy.mock.calls.map(([, payload]) => JSON.parse(payload as string).event);
      expect(events).toContain('first_activity_started');
      expect(events).toContain('first_activity_completed');
    });

    it('does not log first-activity events when the farm already has activities', async () => {
      vi.mocked(db.activity.count).mockResolvedValue(3);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await createActivity({}, fd());

      const events = consoleSpy.mock.calls.map(([, payload]) => JSON.parse(payload as string).event);
      expect(events).not.toContain('first_activity_started');
      expect(events).not.toContain('first_activity_completed');
    });

    it('logs first_activity_failed with a safe error category when the first activity fails', async () => {
      vi.mocked(db.activity.count).mockResolvedValue(0);
      tx.fieldSeason.findFirst.mockResolvedValue(null); // triggers "Field not found" error
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await createActivity({}, fd());

      const failedEvent = consoleSpy.mock.calls
        .map(([, payload]) => JSON.parse(payload as string))
        .find((e) => e.event === 'first_activity_failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent.success).toBe(false);
      expect(failedEvent.errorCategory).toBe('authorization');
    });
  });

  it('deducts stock and creates StockMovement when product + dose provided', async () => {
    tx.inventoryItem.findFirst.mockResolvedValue({
      name: 'KAS 27%',
      registrationNumber: null,
      currentStock: '5000.000', // 5000 kg available; 200 kg/ha × 10 ha = 2000 kg needed
      farmId: IDS.farm,
    });
    const result = await createActivity({}, fd({ productId: IDS.fertProduct, dosePerHa: '200', doseUnit: 'kg' }));
    expect(result.success).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'out',
          quantity: 2000, // 10 ha × 200 kg/ha
          activityId: IDS.activity,
        }),
      })
    );
  });
});

// ─── deleteActivity ───────────────────────────────────────────────────────────

describe('deleteActivity', () => {
  beforeEach(() => {
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-001');
    tx.$executeRaw.mockResolvedValue(1);
    tx.stockMovement.create.mockResolvedValue({});
    tx.activity.update.mockResolvedValue({});
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.$transaction as any).mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  });

  afterEach(() => vi.clearAllMocks());

  // Sprint 19 Part 3/9 finding (docs/Sprint_19_Compliance_Audit.md §3): a
  // completed regulated activity must go through reverseActivity instead.
  it('refuses to delete a completed activity, directing to Reverse instead', async () => {
    tx.activity.findFirst.mockResolvedValue({ id: IDS.activity, status: 'completed', stockMovements: [] });
    const result = await deleteActivity(IDS.activity);
    expect(result.error?.code).toBe('INVALID_VALUE');
    expect(tx.activity.update).not.toHaveBeenCalled();
  });

  it('soft-deletes the activity — sets deletedAt, does not hard-delete', async () => {
    tx.activity.findFirst.mockResolvedValue({ id: IDS.activity, status: 'planned', stockMovements: [] });
    const result = await deleteActivity(IDS.activity);
    expect(result.error).toBeUndefined();
    expect(tx.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it('restores stock for each outbound movement (stock reversal)', async () => {
    tx.activity.findFirst.mockResolvedValue({
      id: IDS.activity,
      stockMovements: [{ inventoryItemId: IDS.inventoryOut, quantity: '20.000' }],
    });
    await deleteActivity(IDS.activity);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'correction',
          quantity: 20,
          inventoryItemId: IDS.inventoryOut,
        }),
      })
    );
  });

  it('restores stock for multiple outbound movements', async () => {
    tx.activity.findFirst.mockResolvedValue({
      id: IDS.activity,
      stockMovements: [
        { inventoryItemId: IDS.inventoryOut, quantity: '10.000' },
        { inventoryItemId: IDS.inventoryOut2, quantity: '5.500' },
      ],
    });
    await deleteActivity(IDS.activity);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
  });

  it('returns error when activity not found or already soft-deleted', async () => {
    tx.activity.findFirst.mockResolvedValue(null);
    const result = await deleteActivity(IDS.activity);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('returns error when farm not found', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const result = await deleteActivity('act-001');
    expect(result.error).toBeDefined();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('completeActivity target authentication boundary', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects before the transaction when the active farm is unavailable', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const result = await completeActivity(IDS.activity);
    expect(result.error?.code).toBe('AUTH_REQUIRED');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.activity.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.complianceRecord.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
