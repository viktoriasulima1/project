import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
const { mockDb } = vi.hoisted(() => ({
  mockDb: { field: { findFirst: vi.fn() }, soilAnalysis: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() } },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));

import { createSoilAnalysis, deleteSoilAnalysis } from '../soil-analyses';
import { getActiveFarmOrThrow } from '@/lib/farm';

const FIELD_ID = 'a2661b3b-2333-4cdd-82f1-746b9124312f';
const ANALYSIS_ID = '607e7cda-b27c-45b5-898d-04ee3eea7a2a';

describe('createSoilAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.field.findFirst.mockResolvedValue({ id: FIELD_ID, farmId: 'farm-1' });
    mockDb.soilAnalysis.create.mockResolvedValue({ id: ANALYSIS_ID });
  });

  it('creates a soil analysis for a field owned by the active farm', async () => {
    const result = await createSoilAnalysis({ fieldId: FIELD_ID, analysisDate: '2026-08-01', phLevel: 6.5, pIndex: 30, kIndex: 20, mgIndex: 10, organicMatterPct: 3.2 });
    expect(result).toEqual({ success: true, soilAnalysisId: ANALYSIS_ID });
    expect(mockDb.soilAnalysis.create).toHaveBeenCalledWith({
      data: { fieldId: FIELD_ID, analysisDate: new Date('2026-08-01'), phLevel: 6.5, pIndex: 30, kIndex: 20, mgIndex: 10, organicMatterPct: 3.2, notes: undefined },
    });
  });

  it('refuses a field belonging to another farm without creating a record', async () => {
    mockDb.field.findFirst.mockResolvedValue(null);
    const result = await createSoilAnalysis({ fieldId: FIELD_ID, analysisDate: '2026-08-01' });
    expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND', field: 'fieldId' } });
    expect(mockDb.soilAnalysis.create).not.toHaveBeenCalled();
  });

  it('rejects a pH value outside the valid 0-14 range', async () => {
    const result = await createSoilAnalysis({ fieldId: FIELD_ID, analysisDate: '2026-08-01', phLevel: 20 });
    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_VALUE' } });
    expect(mockDb.soilAnalysis.create).not.toHaveBeenCalled();
  });

  it('does not reveal farm details when there is no active farm', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('foreign farm details'));
    const result = await createSoilAnalysis({ fieldId: FIELD_ID, analysisDate: '2026-08-01' });
    expect(result).toMatchObject({ success: false, error: { code: 'AUTH_REQUIRED' } });
    expect(mockDb.soilAnalysis.create).not.toHaveBeenCalled();
  });
});

describe('deleteSoilAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.soilAnalysis.findFirst.mockResolvedValue({ id: ANALYSIS_ID });
    mockDb.soilAnalysis.delete.mockResolvedValue({ id: ANALYSIS_ID });
  });

  it('deletes an analysis scoped to the active farm', async () => {
    const result = await deleteSoilAnalysis(ANALYSIS_ID);
    expect(result).toEqual({ success: true, soilAnalysisId: ANALYSIS_ID });
    expect(mockDb.soilAnalysis.findFirst).toHaveBeenCalledWith({ where: { id: ANALYSIS_ID, field: { farmId: 'farm-1' } } });
    expect(mockDb.soilAnalysis.delete).toHaveBeenCalledWith({ where: { id: ANALYSIS_ID } });
  });

  it('refuses to delete an analysis belonging to another farm', async () => {
    mockDb.soilAnalysis.findFirst.mockResolvedValue(null);
    const result = await deleteSoilAnalysis(ANALYSIS_ID);
    expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(mockDb.soilAnalysis.delete).not.toHaveBeenCalled();
  });
});
