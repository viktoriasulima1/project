import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn(), getClerkUserId: vi.fn() }));
vi.mock('@/lib/weather', () => ({ fetchWeather: vi.fn(), windDirectionLabel: vi.fn(() => 'NE') }));
vi.mock('@/lib/spray-window', () => ({ getAmsterdamDateString: vi.fn(() => '2026-07-07') }));
// This file tests completeActivity's own orchestration, not
// buildCtgbSnapshotExtra's internals (covered separately in
// ctgb-snapshot.test.ts) — mocked here so the narrow, Sprint-18-era
// ctgbProductReference fixtures below (authorisationStatus/sourceUrl/
// fetchedAt only, no `uses` array) don't need to grow into a full
// CtgbProductReference row just to satisfy a function this file isn't
// trying to exercise.
vi.mock('@/lib/ctgb-snapshot', () => ({
  buildCtgbSnapshotExtra: vi.fn(() => ({
    ctgbSourceProductId: null, ctgbSourceVersion: null, ctgbRawChecksum: null,
    ctgbComplianceStatus: 'manual_unverified', ctgbSelectedUse: null,
  })),
}));

vi.mock('@/lib/db', () => {
  const _tx = {
    activity: { findFirst: vi.fn(), update: vi.fn() },
    stockMovement: { create: vi.fn() },
    complianceRecord: { create: vi.fn() },
    // Sprint 19 — every mutating path now also writes an audit event.
    auditEvent: { create: vi.fn() },
    $executeRaw: vi.fn(),
  };
  const db = {
    $transaction: vi.fn((cb: (tx: typeof _tx) => unknown) => cb(_tx)),
    _tx,
  };
  return { db };
});

import { completeActivity } from '../activities';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { fetchWeather } from '@/lib/weather';
import { db } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (db as any)._tx as {
  activity: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  stockMovement: { create: ReturnType<typeof vi.fn> };
  complianceRecord: { create: ReturnType<typeof vi.fn> };
  auditEvent: { create: ReturnType<typeof vi.fn> };
  $executeRaw: ReturnType<typeof vi.fn>;
};

const FARM = { id: 'farm-1', latitude: '52.0000', longitude: '5.9000' } as never;

const PLANNED_SPRAY = {
  id: 'act-1',
  status: 'planned',
  type: 'spray',
  operatorName: 'Jan de Vries',
  certificateNumber: null,
  areaHa: '10.00',
  waterVolumePerHa: '200.0',
  nozzleType: 'flat_fan',
  productId: 'prod-1',
  dosePerHa: '2.000',
  doseUnit: 'L',
  weatherTempC: null,
  weatherWindKmh: null,
  weatherWindDir: null,
  weatherHumidity: null,
  notes: null,
  fieldSeason: {
    crop: 'wheat',
    field: { name: 'Rijnkamp Noord', hectares: '24.30' },
    season: { year: 2026 },
  },
  product: { name: 'Amistar Opti', registrationNumber: 'CTB123', currentStock: '500.000', farmId: 'farm-1' },
};

describe('completeActivity', () => {
  // Several tests below deliberately exercise failure paths that go through
  // handleActionError, which logs via console.error by design (see
  // src/lib/user-error.ts) — real, intentional server-side logging, not a
  // bug. Spied and silenced here so a passing negative-path test doesn't
  // print what looks like an unhandled stack trace next to the test
  // results; restored after every test so a genuinely unexpected error
  // elsewhere would still surface normally.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM);
    vi.mocked(getClerkUserId).mockResolvedValue('user-001');
    tx.activity.update.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({ id: 'movement-1' });
    tx.complianceRecord.create.mockResolvedValue({ id: 'compliance-1' });
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    tx.$executeRaw.mockResolvedValue(1);
    vi.mocked(fetchWeather).mockResolvedValue({
      latitude: 52, longitude: 5.9, timezone: 'Europe/Amsterdam',
      hourly: [{ time: '2026-07-07T12:00', temperature: 20, windSpeed: 8, windGust: 12, windDirection: 90, precipitation: 0, precipitationProbability: 0, relativeHumidity: 55, leafWetness: 0, isDay: 1 }],
      daily: [],
      fetchedAt: '2026-07-07T11:00:00.000Z',
    } as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.$transaction as any).mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('transitions a planned activity to completed, deducting stock and creating a compliance record', async () => {
    tx.activity.findFirst.mockResolvedValue(PLANNED_SPRAY);
    const result = await completeActivity('act-1');
    expect(result.success).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(tx.complianceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ framework: 'EU_SPRAY_DIARY_2009_128_EC' }) }),
    );
    expect(tx.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('rejects completing an activity that is not planned (already completed)', async () => {
    tx.activity.findFirst.mockResolvedValue({ ...PLANNED_SPRAY, status: 'completed' });
    const result = await completeActivity('act-1');
    expect(result.error?.code).toBe('INVALID_VALUE');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects an activity not found or not owned by this farm', async () => {
    tx.activity.findFirst.mockResolvedValue(null);
    const result = await completeActivity('act-1');
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('surfaces insufficient stock at completion time rather than silently succeeding', async () => {
    tx.activity.findFirst.mockResolvedValue({
      ...PLANNED_SPRAY,
      product: { ...PLANNED_SPRAY.product, currentStock: '1.000' },
    });
    const result = await completeActivity('act-1');
    expect(result.error?.code).toBe('INSUFFICIENT_STOCK');
    expect(tx.activity.update).not.toHaveBeenCalled();
  });

  // Test 8 (Sprint 18 Part 17): Historical compliance snapshot remains unchanged.
  // completeActivity only ever reads the Ctgb reference that was joined onto
  // the activity's product AT THE MOMENT of the DB read — it never re-fetches
  // live Ctgb data — so the compliance record it writes is structurally a
  // frozen snapshot, not a live pointer that could change later.
  it('denormalizes the Ctgb snapshot exactly as read at completion time, never re-fetching live data', async () => {
    tx.activity.findFirst.mockResolvedValue({
      ...PLANNED_SPRAY,
      product: {
        ...PLANNED_SPRAY.product,
        ctgbProductReference: {
          authorisationStatus: 'authorised',
          sourceUrl: 'https://public.mst.ctgb.nl/public-api/1.0/authorisations/686',
          fetchedAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      },
    });

    await completeActivity('act-1');

    expect(tx.complianceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({
            ctgbAuthorisationStatusAtCompletion: 'authorised',
            ctgbSourceUrl: 'https://public.mst.ctgb.nl/public-api/1.0/authorisations/686',
            ctgbFetchedAt: '2026-07-01T00:00:00.000Z',
          }),
        }),
      }),
    );
  });

  it('records a null Ctgb snapshot for a manually-entered (non-Ctgb-linked) product, never a fabricated one', async () => {
    tx.activity.findFirst.mockResolvedValue({
      ...PLANNED_SPRAY,
      product: { ...PLANNED_SPRAY.product, ctgbProductReference: null },
    });

    await completeActivity('act-1');

    expect(tx.complianceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({
            ctgbAuthorisationStatusAtCompletion: null,
            ctgbSourceUrl: null,
            ctgbFetchedAt: null,
          }),
        }),
      }),
    );
  });
});
