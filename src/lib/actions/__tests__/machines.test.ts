import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
const { mockDb } = vi.hoisted(() => ({ mockDb: { machine: { create: vi.fn() } } }));
vi.mock('@/lib/db', () => ({ db: mockDb }));

import { createMachine } from '../machines';
import { getActiveFarmOrThrow } from '@/lib/farm';

describe('createMachine characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.machine.create.mockResolvedValue({ id: 'machine-1', name: 'Field sprayer' });
  });

  it('creates a machine under the authenticated farm with canonical type', async () => {
    const result = await createMachine('Field sprayer', 'sprayer');
    expect(result).toEqual({ success: true, machineId: 'machine-1', name: 'Field sprayer' });
    expect(mockDb.machine.create).toHaveBeenCalledWith({ data: { farmId: 'farm-1', name: 'Field sprayer', type: 'sprayer' } });
  });

  it('rejects an empty name without creating a machine', async () => {
    const result = await createMachine('', 'sprayer');
    expect(result).toMatchObject({ success: false, error: { code: 'REQUIRED_FIELD', field: 'name' } });
    expect(mockDb.machine.create).not.toHaveBeenCalled();
  });

  it('rejects a non-canonical machine type without creating a machine', async () => {
    const result = await createMachine('Field sprayer', 'translated-sprayer');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INVALID_MACHINE_TYPE');
    expect(mockDb.machine.create).not.toHaveBeenCalled();
  });

  it('does not reveal whether a farm exists when authentication has no active farm', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('foreign farm details'));
    const result = await createMachine('Field sprayer', 'sprayer');
    expect(result).toMatchObject({ success: false, error: { code: 'AUTH_REQUIRED' } });
    expect(mockDb.machine.create).not.toHaveBeenCalled();
  });

  it('does not report success when the database create fails', async () => {
    mockDb.machine.create.mockRejectedValue(new Error('database unavailable'));
    const result = await createMachine('Field sprayer', 'sprayer');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('GENERIC');
      expect(JSON.stringify(result.error)).not.toContain('database unavailable');
    }
    expect(mockDb.machine.create).toHaveBeenCalledTimes(1);
  });
});
