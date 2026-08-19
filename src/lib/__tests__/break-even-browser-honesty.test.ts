import { describe, expect, it } from 'vitest';
import { aggregateHarvestYield } from '../finance-data';
import { findVisibleDomainCodeLeaks } from '../visible-domain-code';

describe('visible domain-code detection', () => {
  const codes = ['MISSING_HARVEST', 'ADD_HARVEST'];

  it('ignores codes that exist only in script/catalog content', () => {
    const rawHtml = '<script>{"MISSING_HARVEST":"Ernte fehlt"}</script><main>Ernte fehlt</main>';
    const visibleText = 'Ernte fehlt';
    expect(rawHtml).toContain('MISSING_HARVEST');
    expect(findVisibleDomainCodeLeaks(visibleText, codes)).toEqual([]);
  });

  it('detects a visibly rendered code', () => {
    expect(findVisibleDomainCodeLeaks('Error: MISSING_HARVEST', codes)).toEqual(['MISSING_HARVEST']);
  });

  it('detects a code collected from an accessible aria-label', () => {
    expect(findVisibleDomainCodeLeaks('Ernte fehlt\nADD_HARVEST', codes)).toEqual(['ADD_HARVEST']);
  });
});

describe('harvest evidence aggregation', () => {
  it('keeps no harvest rows missing', () => {
    expect(aggregateHarvestYield([])).toBeNull();
  });

  it('preserves an explicitly recorded zero', () => {
    expect(aggregateHarvestYield([{ grossQuantity: 0, saleableQuantity: 0 }])).toBe(0);
  });

  it('returns the positive recorded quantity', () => {
    expect(aggregateHarvestYield([{ grossQuantity: 12, saleableQuantity: 10 }])).toBe(10);
  });
});
