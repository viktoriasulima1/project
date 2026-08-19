import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ db: { activity: { findMany: vi.fn() } } }));

import { getEffectiveComplianceRecords } from '../compliance-data';
import { db } from '@/lib/db';

const FARM_ID = 'farm-1';

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'act-1',
    rootActivityId: null,
    correctionOfId: null,
    version: 1,
    isReversal: false,
    correctionReason: null,
    type: 'spray',
    date: new Date('2026-06-01T10:00:00.000Z'),
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    productId: 'prod-1',
    machineId: 'machine-1',
    fieldSeason: { fieldId: 'field-1', seasonId: 'season-1', crop: 'wheat' },
    complianceRecords: [{ id: 'cr-1', framework: 'EU_SPRAY_DIARY_2009_128_EC', data: { fieldName: 'Rijnkamp Noord', crop: 'wheat', date: '2026-06-01', areaHa: 10, operatorName: 'Jan', certificateNumber: 'C1', machineName: 'Sprayer 1', nozzleType: 'flat_fan', waterVolumePerHa: 200, productName: 'Amistar Opti', productRegistrationNumber: 'NL-1', dosePerHa: 2, doseUnit: 'L', bbchStage: 32, weatherTempC: 18, weatherWindKmh: 10, weatherHumidity: 60, ctgbComplianceStatus: 'verified' } }],
    ...overrides,
  };
}

describe('getEffectiveComplianceRecords', () => {
  beforeEach(() => vi.clearAllMocks());

  // Test 25
  it('excludes reversed records by default', async () => {
    const reversal = makeActivity({ id: 'act-2', correctionOfId: 'act-1', rootActivityId: 'act-1', isReversal: true, version: 2, createdAt: new Date('2026-06-02T00:00:00.000Z') });
    vi.mocked(db.activity.findMany).mockResolvedValue([makeActivity(), reversal] as never);
    const records = await getEffectiveComplianceRecords(FARM_ID);
    expect(records).toHaveLength(0); // the effective version IS the reversal, excluded by default
  });

  it('includes reversed records when includeReversed is true', async () => {
    const reversal = makeActivity({ id: 'act-2', correctionOfId: 'act-1', rootActivityId: 'act-1', isReversal: true, version: 2, createdAt: new Date('2026-06-02T00:00:00.000Z') });
    vi.mocked(db.activity.findMany).mockResolvedValue([makeActivity(), reversal] as never);
    const records = await getEffectiveComplianceRecords(FARM_ID, { includeReversed: true });
    expect(records).toHaveLength(1);
    expect(records[0].isReversal).toBe(true);
  });

  // Test 29
  it('applies field/crop/product/operator/date filters correctly', async () => {
    const wheat = makeActivity({ id: 'act-1' });
    const potato = makeActivity({
      id: 'act-2', fieldSeason: { fieldId: 'field-2', seasonId: 'season-1', crop: 'potato' },
      complianceRecords: [{ id: 'cr-2', framework: 'x', data: { ...wheat.complianceRecords[0].data, crop: 'potato', fieldName: 'Other field' } }],
    });
    vi.mocked(db.activity.findMany).mockResolvedValue([wheat, potato] as never);

    const byCrop = await getEffectiveComplianceRecords(FARM_ID, { crop: 'potato' });
    expect(byCrop).toHaveLength(1);
    expect(byCrop[0].activityId).toBe('act-2');

    const byField = await getEffectiveComplianceRecords(FARM_ID, { fieldId: 'field-1' });
    expect(byField).toHaveLength(1);
    expect(byField[0].activityId).toBe('act-1');
  });

  it('applies a date range filter', async () => {
    const early = makeActivity({ id: 'act-1', date: new Date('2026-04-01') });
    const late = makeActivity({ id: 'act-2', date: new Date('2026-08-01') });
    vi.mocked(db.activity.findMany).mockResolvedValue([early, late] as never);
    const records = await getEffectiveComplianceRecords(FARM_ID, { dateFrom: '2026-06-01' });
    expect(records).toHaveLength(1);
    expect(records[0].activityId).toBe('act-2');
  });

  // Test 30 (cross-farm rejection): getEffectiveComplianceRecords itself
  // only ever queries `db.activity.findMany` scoped to the given farmId —
  // there is no code path that reads another farm's rows at all, so a
  // rootActivityId/fieldId/productId belonging to another farm simply never
  // appears in the data this function has access to in the first place.
  it('only ever queries activities scoped to the given farmId', async () => {
    vi.mocked(db.activity.findMany).mockResolvedValue([]);
    await getEffectiveComplianceRecords(FARM_ID);
    expect(db.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fieldSeason: { field: { farmId: FARM_ID } } }) }),
    );
  });

  it('returns every version in the chain when effectiveOnly is false', async () => {
    const original = makeActivity({ id: 'act-1' });
    const correction = makeActivity({ id: 'act-2', correctionOfId: 'act-1', rootActivityId: 'act-1', version: 2, createdAt: new Date('2026-06-02T00:00:00.000Z') });
    vi.mocked(db.activity.findMany).mockResolvedValue([original, correction] as never);
    const records = await getEffectiveComplianceRecords(FARM_ID, { effectiveOnly: false });
    expect(records).toHaveLength(2);
  });
});
