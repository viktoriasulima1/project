import { describe, it, expect } from 'vitest';
import { previewReallocation, type ReallocationInput, type DestinationField } from '../reallocation-preview';

function dest(over: Partial<DestinationField> = {}): DestinationField {
  return { fieldSeasonId: 'fs1', field: 'Noord', crop: 'wheat', hectares: 10, saleableYield: 60, currentCostEur: 1000, currentRevenueEur: 1500, ...over };
}
function input(over: Partial<ReallocationInput> = {}): ReallocationInput {
  return {
    record: { kind: 'cost', amount: 1000, currency: 'EUR', reversed: false, directlyLinked: false, sourceType: 'manual_expense' },
    method: 'per_hectare', proposed: [{ fieldSeasonId: 'fs1' }, { fieldSeasonId: 'fs2' }],
    destinations: [dest({ fieldSeasonId: 'fs1', field: 'Noord', hectares: 30 }), dest({ fieldSeasonId: 'fs2', field: 'Zuid', hectares: 10 })],
    currentAllocations: [], fullAllocation: true, farmCurrency: 'EUR', ...over,
  };
}

describe('previewReallocation', () => {
  it('1. direct field — 100% to one field', () => {
    const p = previewReallocation(input({ method: 'direct_field', proposed: [{ fieldSeasonId: 'fs1' }] }));
    expect(p.blocked).toEqual([]);
    expect(p.resolved).toEqual([{ fieldSeasonId: 'fs1', percentage: 100, amount: 1000 }]);
    expect(p.totalAllocated).toBe(1000);
    expect(p.remainingUnallocated).toBe(0);
  });

  it('2. selected fields — manual percentages', () => {
    const p = previewReallocation(input({ method: 'selected_fields', proposed: [{ fieldSeasonId: 'fs1', percentage: 60 }, { fieldSeasonId: 'fs2', percentage: 40 }] }));
    expect(p.resolved.map(r => r.amount)).toEqual([600, 400]);
  });

  it('3. selected fields — manual amounts', () => {
    const p = previewReallocation(input({ method: 'selected_fields', proposed: [{ fieldSeasonId: 'fs1', amount: 700 }, { fieldSeasonId: 'fs2', amount: 300 }] }));
    expect(p.resolved.map(r => r.amount)).toEqual([700, 300]);
  });

  it('4. per hectare — proportional to area (30/10 → 75/25)', () => {
    const p = previewReallocation(input());
    expect(p.resolved.map(r => r.amount)).toEqual([750, 250]);
  });

  it('5. per yield — proportional to recorded saleable yield', () => {
    const p = previewReallocation(input({ method: 'per_yield', destinations: [dest({ fieldSeasonId: 'fs1', saleableYield: 80 }), dest({ fieldSeasonId: 'fs2', saleableYield: 20 })] }));
    expect(p.resolved.map(r => r.amount)).toEqual([800, 200]);
  });

  it('6. crop level — no per-field split; full amount stays field-unallocated with a crop-level tag', () => {
    const p = previewReallocation(input({ method: 'crop_level', proposed: [] }));
    expect(p.resolved).toEqual([]);
    expect(p.remainingUnallocated).toBe(1000);
    expect(p.warnings.join(' ')).toMatch(/crop level/i);
  });

  it('7. partial allocation leaves a visible remainder', () => {
    const p = previewReallocation(input({ method: 'selected_fields', fullAllocation: false, proposed: [{ fieldSeasonId: 'fs1', percentage: 70 }] }));
    expect(p.totalAllocated).toBe(700);
    expect(p.remainingUnallocated).toBe(300);
    expect(p.warnings.join(' ')).toMatch(/unallocated/i);
  });

  it('8. unallocated — full amount stays unallocated', () => {
    const p = previewReallocation(input({ method: 'unallocated', proposed: [] }));
    expect(p.totalAllocated).toBe(0);
    expect(p.remainingUnallocated).toBe(1000);
  });

  it('9. percent total below 100 in full allocation is blocked', () => {
    const p = previewReallocation(input({ method: 'selected_fields', proposed: [{ fieldSeasonId: 'fs1', percentage: 50 }, { fieldSeasonId: 'fs2', percentage: 40 }] }));
    expect(p.blocked.join(' ')).toMatch(/must total 100%/);
  });

  it('10. percent total above 100 is blocked', () => {
    const p = previewReallocation(input({ method: 'selected_fields', proposed: [{ fieldSeasonId: 'fs1', percentage: 70 }, { fieldSeasonId: 'fs2', percentage: 40 }] }));
    expect(p.blocked.join(' ')).toMatch(/exceed 100%|must total 100%/);
  });

  it('11. duplicate destination rejected', () => {
    const p = previewReallocation(input({ method: 'selected_fields', proposed: [{ fieldSeasonId: 'fs1', percentage: 50 }, { fieldSeasonId: 'fs1', percentage: 50 }] }));
    expect(p.blocked.join(' ')).toMatch(/more than once/);
  });

  it('12. a field not in the farm/season destination set is rejected', () => {
    const p = previewReallocation(input({ method: 'selected_fields', proposed: [{ fieldSeasonId: 'foreign', percentage: 100 }] }));
    expect(p.blocked.join(' ')).toMatch(/does not belong to this farm/);
  });

  it('14. reversed record cannot be allocated', () => {
    const p = previewReallocation(input({ record: { ...input().record, reversed: true } }));
    expect(p.blocked.join(' ')).toMatch(/reversed/);
  });

  it('directly-linked activity cost cannot be reallocated', () => {
    const p = previewReallocation(input({ record: { ...input().record, directlyLinked: true } }));
    expect(p.blocked.join(' ')).toMatch(/already assigned through the completed activity/);
  });

  it('cross-currency record is rejected', () => {
    const p = previewReallocation(input({ record: { ...input().record, currency: 'USD' } }));
    expect(p.blocked.join(' ')).toMatch(/another currency/);
  });

  it('16. deterministic cent rounding — parent equals children exactly (33/33/34 of €10)', () => {
    const p = previewReallocation(input({
      record: { ...input().record, amount: 10 }, method: 'selected_fields',
      proposed: [{ fieldSeasonId: 'fs1', percentage: 33.3333 }, { fieldSeasonId: 'fs2', percentage: 33.3333 }, { fieldSeasonId: 'fs3', percentage: 33.3334 }],
      destinations: [dest({ fieldSeasonId: 'fs1' }), dest({ fieldSeasonId: 'fs2' }), dest({ fieldSeasonId: 'fs3' })],
    }));
    expect(p.resolved.map(r => r.amount)).toEqual([3.33, 3.33, 3.34]);
    expect(p.totalAllocated).toBe(10);
  });

  it('17. same input gives same output (determinism)', () => {
    const a = previewReallocation(input());
    const b = previewReallocation(input());
    expect(a).toEqual(b);
  });

  it('18. parent/children totals reconcile exactly for an awkward split', () => {
    const p = previewReallocation(input({ record: { ...input().record, amount: 100.01 }, destinations: [dest({ fieldSeasonId: 'fs1', hectares: 1 }), dest({ fieldSeasonId: 'fs2', hectares: 1 })] }));
    const sum = p.resolved.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100.01);
  });

  it('19. missing yield blocks per-yield allocation', () => {
    const p = previewReallocation(input({ method: 'per_yield', destinations: [dest({ fieldSeasonId: 'fs1', saleableYield: null }), dest({ fieldSeasonId: 'fs2', saleableYield: 20 })] }));
    expect(p.blocked.join(' ')).toMatch(/saleable yield is missing/);
  });

  it('20. missing revenue does not fabricate a margin impact for a cost allocation', () => {
    const p = previewReallocation(input({ method: 'direct_field', proposed: [{ fieldSeasonId: 'fs1' }], destinations: [dest({ fieldSeasonId: 'fs1', currentRevenueEur: null })] }));
    const impact = p.perField[0];
    expect(impact.marginAfterEur).toBeNull();
    expect(impact.marginPerHaChangeEur).toBeNull();
    expect(impact.marginReasonCode).toBe('MISSING_REVENUE');
  });

  it('field impact = delta vs current allocation (re-allocation)', () => {
    const p = previewReallocation(input({ method: 'direct_field', proposed: [{ fieldSeasonId: 'fs1' }], destinations: [dest({ fieldSeasonId: 'fs1', currentCostEur: 1000 })], currentAllocations: [{ fieldSeasonId: 'fs1', amount: 400 }] }));
    // record amount 1000, previously 400 on this field → after = 1000 + (1000-400) = 1600
    expect(p.perField[0].afterCostEur).toBe(1600);
  });

  it('computes margin/ha change when both cost and revenue are recorded', () => {
    const p = previewReallocation(input({ method: 'direct_field', proposed: [{ fieldSeasonId: 'fs1' }], destinations: [dest({ fieldSeasonId: 'fs1', hectares: 10, currentCostEur: 1000, currentRevenueEur: 3000 })] }));
    // +1000 cost on 10ha → margin/ha change -100
    expect(p.perField[0].marginPerHaChangeEur).toBe(-100);
  });

  it('30. preview is pure — no mutation of the input object', () => {
    const inp = input();
    const snapshot = JSON.parse(JSON.stringify(inp));
    previewReallocation(inp);
    expect(JSON.parse(JSON.stringify(inp))).toEqual(snapshot);
  });
});
