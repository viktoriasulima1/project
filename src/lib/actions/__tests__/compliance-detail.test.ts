import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
vi.mock('@/lib/compliance-data', () => ({ getChainForRoot: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { auditEvent: { findMany: vi.fn().mockResolvedValue([]) }, stockMovement: { findMany: vi.fn().mockResolvedValue([]) } },
}));

import { getComplianceRecordDetail } from '../compliance-detail';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { getChainForRoot } from '@/lib/compliance-data';

const FARM = { id: 'farm-1' } as never;

describe('getComplianceRecordDetail — Part 17 test 4: cross-farm audit access rejected', () => {
  beforeEach(() => {
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM);
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM);
  });

  it('returns an error, not another farm\'s chain, when the root id belongs to a different farm', async () => {
    // getChainForRoot is itself farm-scoped (queries WHERE fieldSeason.field.farmId
    // = the calling farm's id) — a root id from another farm simply never
    // matches, so it correctly returns an empty array here.
    vi.mocked(getChainForRoot).mockResolvedValue([]);
    const result = await getComplianceRecordDetail('another-farms-activity-id');
    expect(result.error).toContain('not found');
    expect(result.detail).toBeUndefined();
  });

  it('returns detail when the chain belongs to this farm', async () => {
    vi.mocked(getChainForRoot).mockResolvedValue([
      { id: 'act-1', version: 1, correctionOfId: null, isReversal: false, correctionReason: null, correctionDiff: null, createdAt: new Date('2026-01-01'), date: new Date('2026-01-01') },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const result = await getComplianceRecordDetail('act-1');
    expect(result.error).toBeUndefined();
    expect(result.detail?.chain).toHaveLength(1);
    expect(result.detail?.chain[0].labels).toContain('original');
    expect(result.detail?.chain[0].labels).toContain('current');
  });

  it('returns an error when there is no farm at all', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('No farm.'));
    const result = await getComplianceRecordDetail('any-id');
    expect(result.error).toBe('Farm not found.');
  });
});
