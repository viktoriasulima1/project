import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, provider, farm } = vi.hoisted(() => ({
  farm: { id: 'farm-own', clerkUserId: 'user-own' },
  provider: { name: 'deterministic', generate: vi.fn() },
  db: {
    aiRequestMetadata: { count: vi.fn(), create: vi.fn() },
    fieldSeason: { findMany: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
    machine: { findMany: vi.fn() },
    workOrder: { findMany: vi.fn() },
    activity: { create: vi.fn() },
  },
}));

vi.mock('@/lib/farm', () => ({
  getActiveFarmOrThrow: vi.fn(async () => farm),
  getClerkUserId: vi.fn(async () => 'user-own'),
}));
vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/lib/ai/configured-provider', () => ({ configuredAIProvider: () => provider }));

import { getActiveFarmOrThrow } from '@/lib/farm';
import { POST } from '../route';

function request(body: string) {
  return new Request('http://localhost/api/ai/activity-parse', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('POST /api/ai/activity-parse characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_DAILY_FARM_LIMIT = '50';
    process.env.AI_DAILY_USER_PARSE_LIMIT = '30';
    db.aiRequestMetadata.count.mockResolvedValue(0);
    db.aiRequestMetadata.create.mockResolvedValue({ id: 'metadata-1' });
    db.fieldSeason.findMany.mockResolvedValue([{ id: 'fs-own', field: { name: 'Noord' } }]);
    db.inventoryItem.findMany.mockResolvedValue([{ id: 'product-own', name: 'Amistar Opti' }]);
    db.machine.findMany.mockResolvedValue([{ id: 'machine-own', name: 'Sprayer 1' }]);
    db.workOrder.findMany.mockResolvedValue([]);
    provider.generate.mockRejectedValue(new Error('private provider failure with secret'));
  });

  it.each([
    ['invalid JSON', '{'],
    ['missing text', '{}'],
    ['empty text', '{"text":""}'],
    ['oversized text', JSON.stringify({ text: 'x'.repeat(2001) })],
  ])('returns the existing safe 400 branch for %s', async (_name, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ ok: false, error: {
      code: 'INVALID_VALUE', category: 'validation', retryable: false, field: 'text', correlationId: expect.stringMatching(/^[a-zA-Z0-9_-]+$/),
    } });
    expect(provider.generate).not.toHaveBeenCalled();
    expect(db.aiRequestMetadata.create).not.toHaveBeenCalled();
    expect(db.activity.create).not.toHaveBeenCalled();
  });

  it('keeps the existing 429 branch and records only safe rate-limit metadata', async () => {
    db.aiRequestMetadata.count.mockResolvedValue(30);
    const response = await POST(request(JSON.stringify({ text: 'Scouted field Noord.' })));
    expect(response.status).toBe(429);
    expect(await json(response)).toEqual({ ok: false, error: {
      code: 'RATE_LIMITED', category: 'rate_limit', retryable: true, correlationId: expect.stringMatching(/^[a-zA-Z0-9_-]+$/),
    } });
    expect(db.aiRequestMetadata.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      farmId: 'farm-own', userReference: 'user-own', provider: 'not_called', model: 'not_called', result: 'rate_limited',
    }) });
    expect(provider.generate).not.toHaveBeenCalled();
    expect(db.activity.create).not.toHaveBeenCalled();
  });

  it('preserves deterministic fallback, successful response shape and draft-only behavior', async () => {
    const response = await POST(request(JSON.stringify({ text: 'Scouted field Noord over 3 hectares.' })));
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      candidate: expect.any(Object), resolution: expect.any(Object), workOrders: [], multiActivity: expect.any(Object),
      mode: 'rule_based', safeguards: { draftOnly: true, authoritativeValidationRequired: true },
    }));
    expect(JSON.stringify(body)).not.toContain('private provider failure');
    expect(db.activity.create).not.toHaveBeenCalled();
    expect(db.aiRequestMetadata.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      farmId: 'farm-own', userReference: 'user-own', result: 'fallback', contextChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    }) });
  });

  it('queries only authenticated-farm entities and accepts no submitted farm identity', async () => {
    await POST(request(JSON.stringify({ text: 'Sprayed Noord with Amistar Opti using Sprayer 1.', farmId: 'farm-foreign' })));
    expect(db.fieldSeason.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      field: { farmId: 'farm-own', deletedAt: null }, season: { isActive: true, farmId: 'farm-own' },
    } }));
    expect(db.inventoryItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { farmId: 'farm-own' } }));
    expect(db.machine.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { farmId: 'farm-own' } }));
  });

  it('preserves the shared authentication/farm failure boundary before parsing or provider use', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValueOnce(new Error('private missing farm context'));
    await expect(POST(request(JSON.stringify({ text: 'Scouted Noord.' })))).rejects.toThrow('private missing farm context');
    expect(provider.generate).not.toHaveBeenCalled();
    expect(db.activity.create).not.toHaveBeenCalled();
  });
});
