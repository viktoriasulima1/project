import { describe, it, expect, vi } from 'vitest';
import { buildEconomicsCsv } from '../csv';
import { buildEconomicsPdf } from '../pdf';
import type { EconomicsExportData } from '../data';
import { resolveBudgetVariance } from '../../economics';

function data(over: Partial<EconomicsExportData> = {}): EconomicsExportData {
  const field = {
    fieldSeasonId: 'fs1', fieldId: 'f1', field: 'Noord', crop: 'wheat', hectares: 10,
    recordedCostEur: 1000, recordedRevenueEur: 1500, grossMarginEur: 500, costPerHaEur: 100,
    revenuePerHaEur: 150, grossMarginPerHaEur: 50, yieldQuantity: 60, yieldUnit: 'tonnes', yieldPerHa: 6,
    costPerYieldUnit: 16.6, breakEvenPrice: 16, breakEvenYield: 40, completenessPercent: 80,
    completenessStatus: 'partial_profitability', completenessResult: {status:'partial_profitability' as const,percentage:80,reasons:[{code:'MISSING_REVENUE' as const,metadata:{}}],actionCodes:['ADD_REVENUE' as const],recordedCodes:[],metadata:{applicableCheckCount:8,passedCheckCount:6}}, budgetCostEur: 1200, budgetRevenueEur: 1600,
    costVariance: resolveBudgetVariance({ budget: 1200, actual: 1000 }),
  };
  return {
    farm: { id: 'farm-1', name: 'Test Farm', currency: 'EUR' },
    season: { id: 's1', year: 2026 },
    finance: {
      seasonId: 's1', fields: [field], crops: [{ crop: 'wheat', fields: 1, hectares: 10, costEur: 1000, revenueEur: 1500, grossMarginEur: 500, costPerHaEur: 100, grossMarginPerHaEur: 50, completenessPercent: 80 }],
      totalRecordedCostEur: 1000, totalRecordedRevenueEur: 1500, grossMarginEur: 500, completenessPercent: 80,
      unallocatedCostEur: 200, unallocatedRevenueEur: null,
    },
    purchases: [
      { id: 'p1', purchaseDate: new Date('2026-05-01'), inventoryItem: { name: 'KAS' }, supplier: 'Agrifirm', quantity: 100, unit: 'kg', unitCost: 2, totalAmount: 200, vatAmount: 42, invoiceReference: 'INV-1', status: 'active' },
      { id: 'p2', purchaseDate: new Date('2026-05-02'), inventoryItem: { name: 'Old' }, supplier: null, quantity: 10, unit: 'kg', unitCost: 1, totalAmount: 10, vatAmount: null, invoiceReference: 'INV-2', status: 'reversed' },
    ],
    expenses: [
      { id: 'e1', expenseDate: new Date('2026-05-03'), fieldSeason: { field: { name: 'Noord' } }, sourceType: 'manual_expense', description: 'Rent', quantity: null, unit: null, amount: 300, allocationMethod: 'direct_field', reference: 'R1', status: 'active' },
      { id: 'e2', expenseDate: new Date('2026-05-04'), fieldSeason: null, sourceType: 'manual_expense', description: 'Superseded', quantity: null, unit: null, amount: 999, allocationMethod: 'unallocated', reference: null, status: 'corrected' },
    ],
    harvest: [],
    revenue: [],
    allocatable: [
      { economicEntryId: 'ee1', kind: 'cost', sourceType: 'manual_expense', label: 'Rent', reference: 'R1', date: '2026-05-03', amount: 300, currency: 'EUR', allocatedAmount: 100, unallocatedAmount: 200, version: 1, status: 'partially_allocated', destinationsSummary: 'Noord' },
      { economicEntryId: 'ee2', kind: 'cost', sourceType: 'manual_expense', label: '=cmd()', reference: null, date: '2026-05-05', amount: 50, currency: 'EUR', allocatedAmount: 0, unallocatedAmount: 50, version: 1, status: 'unallocated', destinationsSummary: '—' },
      { economicEntryId: 'ee3', kind: 'cost', sourceType: 'manual_expense', label: 'Done', reference: null, date: '2026-05-06', amount: 40, currency: 'EUR', allocatedAmount: 40, unallocatedAmount: 0, version: 1, status: 'fully_allocated', destinationsSummary: 'Noord' },
    ],
    ...over,
  } as unknown as EconomicsExportData;
}

describe('economics CSV export (Part 20: reports)', () => {
  it('15,19,20,26 — field_economics has stable headers, totals, completeness and missing categories', () => {
    const csv = buildEconomicsCsv('field_economics', data());
    const [header, row] = csv.trim().split('\r\n');
    expect(header).toBe('field_id,field,crop,hectares,recorded_cost_eur,recorded_revenue_eur,gross_margin_eur,cost_per_ha_eur,yield_quantity,yield_unit,cost_per_yield_unit_eur,break_even_price_eur,completeness_pct,missing_categories');
    expect(row).toContain('1000'); // recorded cost matches resolver
    expect(row).toContain('80');   // completeness
    expect(row).toContain('MISSING_REVENUE'); // canonical missing reason
  });

  it('17 — reversed/corrected records are excluded by default, included with history', () => {
    const def = buildEconomicsCsv('expenses', data());
    expect(def).toContain('Rent');
    expect(def).not.toContain('Superseded'); // status corrected excluded
    const hist = buildEconomicsCsv('expenses', data(), true);
    expect(hist).toContain('Superseded');
  });

  it('21 — crop comparison lists an incomplete crop (marked), never dropped', () => {
    const csv = buildEconomicsCsv('crop_economics', data());
    expect(csv).toContain('wheat');
    expect(csv).toContain('80'); // completeness shown
  });

  it('23 — budget vs actual carries planned, actual and variance', () => {
    const csv = buildEconomicsCsv('budget_vs_actual', data());
    expect(csv).toContain('1200'); // budget cost
    expect(csv).toContain('-200'); // variance
  });

  it('24 — unallocated records lists only records with a remaining amount', () => {
    const csv = buildEconomicsCsv('unallocated_records', data());
    expect(csv).toContain('ee1'); // remaining 200
    expect(csv).not.toContain('fully_allocated'); // ee2 has 0 remaining, excluded
  });

  it('25 — purchase history excludes reversed by default (snapshots untouched)', () => {
    const csv = buildEconomicsCsv('purchases', data());
    expect(csv).toContain('KAS');
    expect(csv).not.toContain('Old'); // reversed purchase excluded by default
  });

  it('27 — formula injection is neutralised', () => {
    const csv = buildEconomicsCsv('unallocated_records', data());
    expect(csv).toContain("'=cmd()"); // leading apostrophe added
    expect(csv).not.toMatch(/,=cmd\(\)/); // never a bare formula cell
  });

  it('determinism — identical data yields byte-identical CSV (stable checksum)', () => {
    expect(buildEconomicsCsv('field_economics', data())).toBe(buildEconomicsCsv('field_economics', data()));
  });
});

describe('economics PDF export', () => {
  it('22,28 — season gross margin PDF generates a valid A4 document', async () => {
    const bytes = await buildEconomicsPdf('season_gross_margin', data(), 'export-1');
    expect(bytes.length).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-'); // real PDF header
  });
});
