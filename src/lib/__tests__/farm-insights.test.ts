import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    task: { findMany: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
    complianceItem: { findMany: vi.fn() },
    employee: { findMany: vi.fn() },
    season: { findFirst: vi.fn() },
    complianceRecord: { findMany: vi.fn() },
    fieldSeason: { findMany: vi.fn() },
    field: { findMany: vi.fn() },
  },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('../db', () => ({ db: mockDb }));

const { mockFetchWeather } = vi.hoisted(() => ({ mockFetchWeather: vi.fn() }));
vi.mock('@/lib/weather', () => ({ fetchWeather: mockFetchWeather }));
vi.mock('../weather', () => ({ fetchWeather: mockFetchWeather }));

import { getFarmInsights, resolveInsightPriority } from '../farm-insights';

const FARM = { id: 'farm-1', latitude: '52.0000', longitude: '5.9000' } as never;

function setupEmptyMocks() {
  mockDb.task.findMany.mockResolvedValue([]);
  mockDb.inventoryItem.findMany.mockResolvedValue([]);
  mockDb.complianceItem.findMany.mockResolvedValue([]);
  mockDb.employee.findMany.mockResolvedValue([]);
  mockDb.season.findFirst.mockResolvedValue(null);
  mockDb.complianceRecord.findMany.mockResolvedValue([]);
  mockDb.fieldSeason.findMany.mockResolvedValue([]);
  mockDb.field.findMany.mockResolvedValue([]);
  mockFetchWeather.mockResolvedValue(null);
}

describe('resolveInsightPriority', () => {
  // Test 13: Priority engine ranks compliance blocker above low-stock warning
  it('ranks a compliance blocker (expired) above a low-stock warning', () => {
    const compliance = resolveInsightPriority({
      urgency: 9, financialImpact: 3, complianceImpact: 10, agronomicRisk: 1, timeSensitivity: 9, confidence: 9, actionability: 6,
    });
    const lowStock = resolveInsightPriority({
      urgency: 6, financialImpact: 5, complianceImpact: 1, agronomicRisk: 5, timeSensitivity: 6, confidence: 9, actionability: 7,
    });
    expect(compliance.score).toBeGreaterThan(lowStock.score);
    expect(['critical', 'high']).toContain(compliance.severity);
  });

  it('explains which dimensions drove the severity', () => {
    const result = resolveInsightPriority({
      urgency: 9, financialImpact: 1, complianceImpact: 9, agronomicRisk: 1, timeSensitivity: 8, confidence: 5, actionability: 5,
    });
    expect(result.explanation).toContain('priority');
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});

describe('getFarmInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  // Test 16: Empty AI state is shown only when no source data exists
  it('reports hasAnySourceData=false only when every real source is empty', async () => {
    const result = await getFarmInsights(FARM);
    expect(result.hasAnySourceData).toBe(false);
    expect(result.insights).toEqual([]);
  });

  it('reports hasAnySourceData=true once any real source has data, even with no active insight', async () => {
    mockDb.task.findMany.mockResolvedValue([
      { id: 't1', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), status: 'pending', title: 'Future task' },
    ] as never);
    const result = await getFarmInsights(FARM);
    expect(result.hasAnySourceData).toBe(true);
  });

  // Test 11 + 12: shows real rule-based insights, each clearly marked as such
  it('surfaces a real insight for overdue tasks, marked as rule-based', async () => {
    mockDb.task.findMany.mockResolvedValue([
      { id: 't1', dueDate: new Date('2020-01-01'), status: 'pending', title: 'Overdue spray check' },
    ] as never);
    const result = await getFarmInsights(FARM);
    const overdue = result.insights.find((i) => i.id === 'overdue-tasks');
    expect(overdue).toBeDefined();
    expect(overdue!.kind).toBe('rule-based');
    expect(overdue!.evidence).toContain('Task');
  });

  it('surfaces a real insight for low stock, distinct from expiring stock', async () => {
    mockDb.inventoryItem.findMany.mockResolvedValue([
      { id: 'i1', name: 'KAS 27%', currentStock: '10.000', minimumStock: '500.000', expiryDate: null, purchasePricePerUnit: '10.00' },
    ] as never);
    const result = await getFarmInsights(FARM);
    expect(result.insights.find((i) => i.id === 'low-stock')).toBeDefined();
  });

  // Test 20: Cross-farm insight access is rejected
  it('scopes every underlying query to the current farm only', async () => {
    await getFarmInsights(FARM);
    expect(mockDb.task.findMany.mock.calls[0][0].where.farmId).toBe('farm-1');
    expect(mockDb.inventoryItem.findMany.mock.calls[0][0].where.farmId).toBe('farm-1');
    expect(mockDb.complianceItem.findMany.mock.calls[0][0].where.farmId).toBe('farm-1');
    expect(mockDb.employee.findMany.mock.calls[0][0].where.farmId).toBe('farm-1');
  });

  // Stage 2B: the Field Health insight is built from the canonical resolver code
  // + structured evidence, not resolver prose. Grounding facts stay code-derived.
  it('builds the scouting-health insight from canonical Field Health codes/evidence', async () => {
    mockDb.fieldSeason.findMany.mockResolvedValue([
      {
        id: 'fs1', field: { id: 'field-1', name: 'Oosterpolder' }, cropStageRecords: [],
        scoutingVisits: [{ observations: [{ status: 'open', severity: 'high', createdAt: new Date(), suggestions: [], followUpWorkOrder: null }] }],
      },
    ] as never);
    const result = await getFarmInsights(FARM);
    const health = result.insights.find((i) => i.id === 'scouting-health-fs1');
    expect(health).toBeDefined();
    expect(health!.kind).toBe('rule-based');
    // Code-derived English grounding: severe-observation reason + structured evidence count.
    expect(health!.explanation).toContain('severe');
    expect(health!.evidence).toContain('1 severe');
    expect(health!.actionHref).toBe('/scouting?field=field-1'); // CTA destination unchanged
  });

  it('never surfaces more than 3 critical/high insights above the fold', async () => {
    mockDb.task.findMany.mockResolvedValue([
      { id: 't1', dueDate: new Date('2020-01-01'), status: 'pending', title: 'Overdue 1' },
    ] as never);
    mockDb.inventoryItem.findMany.mockResolvedValue([
      { id: 'i1', name: 'Low product', currentStock: '1.000', minimumStock: '500.000', expiryDate: null, purchasePricePerUnit: '10.00' },
    ] as never);
    mockDb.complianceItem.findMany.mockResolvedValue([
      { id: 'c1', title: 'Missing cert', description: 'x', status: 'expired', dueDate: null, module: 'certificate' },
    ] as never);
    mockDb.employee.findMany.mockResolvedValue([
      { id: 'e1', name: 'Jan', hasSpraying: true, certExpiry: new Date('2020-01-01'), certNumber: '123' },
    ] as never);
    const result = await getFarmInsights(FARM);
    expect(result.aboveTheFold.length).toBeLessThanOrEqual(3);
  });
});
