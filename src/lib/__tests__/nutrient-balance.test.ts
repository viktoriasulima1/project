import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { mockDb } = vi.hoisted(() => ({ mockDb: { fieldSeason: { findMany: vi.fn() } } }));
vi.mock('@/lib/db', () => ({ db: mockDb }));

import { getSeasonNutrientBalance } from '../nutrient-balance';

describe('getSeasonNutrientBalance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sums kg of nitrogen and phosphate from fertilise activities using product composition', async () => {
    mockDb.fieldSeason.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        crop: 'wheat',
        field: { id: 'field-1', name: 'North field' },
        activities: [
          { dosePerHa: 200, doseUnit: 'kg', areaHa: 10, product: { name: 'NPK 20-10-10', nitrogenPercent: 20, phosphorusPercent: 10 } },
          { dosePerHa: 100, doseUnit: 'kg', areaHa: 10, product: { name: 'Urea 46%', nitrogenPercent: 46, phosphorusPercent: null } },
        ],
      },
    ]);

    const result = await getSeasonNutrientBalance('farm-1', 'season-1');
    // NPK: 200kg/ha * 10ha = 2000kg total, 20% N = 400kg N, 10% P = 200kg P
    // Urea: 100kg/ha * 10ha = 1000kg total, 46% N = 460kg N, no P recorded
    expect(result).toEqual([
      { fieldId: 'field-1', fieldName: 'North field', crop: 'wheat', nitrogenKg: 860, phosphateKg: 200, incompleteProducts: [], excludedUnitActivities: 0 },
    ]);
  });

  it('reports a product with no composition instead of silently guessing', async () => {
    mockDb.fieldSeason.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        crop: 'potato',
        field: { id: 'field-1', name: 'South field' },
        activities: [
          { dosePerHa: 200, doseUnit: 'kg', areaHa: 5, product: { name: 'Mystery blend', nitrogenPercent: null, phosphorusPercent: null } },
        ],
      },
    ]);

    const result = await getSeasonNutrientBalance('farm-1', 'season-1');
    expect(result[0]).toMatchObject({ nitrogenKg: 0, phosphateKg: 0, incompleteProducts: ['Mystery blend'] });
  });

  it('excludes an activity whose dose unit is not a summable mass and reports the count', async () => {
    mockDb.fieldSeason.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        crop: 'onion',
        field: { id: 'field-1', name: 'East field' },
        activities: [
          { dosePerHa: 3, doseUnit: 'bag', areaHa: 5, product: { name: 'Bagged compost', nitrogenPercent: 5, phosphorusPercent: 2 } },
        ],
      },
    ]);

    const result = await getSeasonNutrientBalance('farm-1', 'season-1');
    expect(result[0]).toMatchObject({ nitrogenKg: 0, phosphateKg: 0, excludedUnitActivities: 1 });
  });

  it('ignores fertilise activities with no linked product', async () => {
    mockDb.fieldSeason.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        crop: 'barley',
        field: { id: 'field-1', name: 'West field' },
        activities: [{ dosePerHa: null, doseUnit: null, areaHa: 5, product: null }],
      },
    ]);

    const result = await getSeasonNutrientBalance('farm-1', 'season-1');
    expect(result[0]).toMatchObject({ nitrogenKg: 0, phosphateKg: 0, incompleteProducts: [], excludedUnitActivities: 0 });
  });
});
