import { describe, it, expect } from 'vitest';
import { computeStockPreview, computeCostPreview, composeScoutingNotes } from '../activity-form-logic';

describe('computeStockPreview', () => {
  it('returns null when there is no product stock to compare against', () => {
    expect(computeStockPreview(undefined, '2', '10')).toBeNull();
  });

  it('returns null when dose is not yet entered', () => {
    expect(computeStockPreview(500, '', '10')).toBeNull();
  });

  it('returns null when area is not yet entered', () => {
    expect(computeStockPreview(500, '2', '')).toBeNull();
  });

  it('returns null when dose or area are not valid numbers', () => {
    expect(computeStockPreview(500, 'abc', '10')).toBeNull();
    expect(computeStockPreview(500, '2', 'xyz')).toBeNull();
  });

  it('computes total used and resulting stock for a normal case', () => {
    const result = computeStockPreview(500, '2', '10');
    expect(result).toEqual({ totalUsed: 20, resultingStock: 480, insufficient: false });
  });

  it('flags insufficient stock when the projected result would go negative', () => {
    const result = computeStockPreview(10, '5', '5');
    expect(result).toEqual({ totalUsed: 25, resultingStock: -15, insufficient: true });
  });

  it('treats an exact zero remaining as sufficient, not insufficient', () => {
    const result = computeStockPreview(20, '2', '10');
    expect(result).toEqual({ totalUsed: 20, resultingStock: 0, insufficient: false });
  });
});

describe('computeCostPreview', () => {
  it('returns null when the product has no recorded price, never a fabricated €0', () => {
    expect(computeCostPreview(null, '2', '10')).toBeNull();
    expect(computeCostPreview(undefined, '2', '10')).toBeNull();
  });

  it('returns null when dose is not yet entered', () => {
    expect(computeCostPreview(34.5, '', '10')).toBeNull();
  });

  it('returns null when area is not yet entered', () => {
    expect(computeCostPreview(34.5, '2', '')).toBeNull();
  });

  it('returns null when dose or area are not valid numbers', () => {
    expect(computeCostPreview(34.5, 'abc', '10')).toBeNull();
    expect(computeCostPreview(34.5, '2', 'xyz')).toBeNull();
  });

  it('computes dose × area × unit price for a normal case', () => {
    expect(computeCostPreview(34.5, '2', '10')).toEqual({ totalCost: 690 });
  });

  it('computes a zero total for a genuinely free product, distinct from an unknown price', () => {
    expect(computeCostPreview(0, '2', '10')).toEqual({ totalCost: 0 });
  });
});

describe('composeScoutingNotes', () => {
  it('always includes category and severity', () => {
    const notes = composeScoutingNotes({ category: 'Disease', severity: 'Moderate', affectedHa: '', userNotes: '' });
    expect(notes).toBe('Category: Disease · Severity: Moderate');
  });

  it('includes affected area only when provided', () => {
    const notes = composeScoutingNotes({ category: 'Pest', severity: 'Low', affectedHa: '2.5', userNotes: '' });
    expect(notes).toBe('Category: Pest · Severity: Low · Affected: 2.5 ha');
  });

  it('appends free-text user notes last, when provided', () => {
    const notes = composeScoutingNotes({ category: 'Weed pressure', severity: 'High', affectedHa: '1', userNotes: 'Found near the ditch edge' });
    expect(notes).toBe('Category: Weed pressure · Severity: High · Affected: 1 ha · Found near the ditch edge');
  });
});
