import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/finance-data', () => ({ getFinanceData: vi.fn() }));
vi.mock('@/lib/reallocation-data', () => ({ getAllocatableRecords: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { season: { findFirst: vi.fn() }, inventoryPurchase: { findMany: vi.fn() }, financialExpense: { findMany: vi.fn() }, harvestResult: { findMany: vi.fn() }, revenueEntry: { findMany: vi.fn() } } }));

import { getEconomicsExportData } from '../data';
import { db } from '@/lib/db';

const FARM = { id: 'farm-1', currency: 'EUR' } as never;

describe('getEconomicsExportData (Part 17/20 security)', () => {
  it('30,31 — rejects a season that does not belong to this farm', async () => {
    vi.mocked(db.season.findFirst).mockResolvedValue(null as never);
    await expect(getEconomicsExportData(FARM, 'foreign-season')).rejects.toThrow(/does not belong to this farm/);
  });

  it('scopes the season lookup to the requesting farm', async () => {
    vi.mocked(db.season.findFirst).mockResolvedValue(null as never);
    await getEconomicsExportData(FARM, 's1').catch(() => {});
    expect(vi.mocked(db.season.findFirst)).toHaveBeenCalledWith({ where: { id: 's1', farmId: 'farm-1' } });
  });
});
