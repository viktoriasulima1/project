import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
const { mockDb } = vi.hoisted(() => ({
  mockDb: { machine: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() } },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));

import { createMachine, createMachineDetailed, updateMachine } from '../machines';
import { getActiveFarmOrThrow } from '@/lib/farm';

describe('createMachine characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.machine.create.mockResolvedValue({ id: '607e7cda-b27c-45b5-898d-04ee3eea7a2a', name: 'Field sprayer' });
  });

  it('creates a machine under the authenticated farm with canonical type', async () => {
    const result = await createMachine('Field sprayer', 'sprayer');
    expect(result).toEqual({ success: true, machineId: '607e7cda-b27c-45b5-898d-04ee3eea7a2a', name: 'Field sprayer' });
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

describe('createMachineDetailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.machine.create.mockResolvedValue({ id: '607e7cda-b27c-45b5-898d-04ee3eea7a2a' });
  });

  it('creates a machine with the full field set under the authenticated farm', async () => {
    const result = await createMachineDetailed({ name: 'Tractor 1', type: 'tractor', make: 'John Deere', model: '6120M', year: 2019, hoursSinceService: 40, nextServiceDueHours: 250, isCertified: true });
    expect(result).toEqual({ success: true, machineId: '607e7cda-b27c-45b5-898d-04ee3eea7a2a' });
    expect(mockDb.machine.create).toHaveBeenCalledWith({
      data: { farmId: 'farm-1', name: 'Tractor 1', type: 'tractor', make: 'John Deere', model: '6120M', year: 2019, hoursSinceService: 40, nextServiceDueHours: 250, isCertified: true },
    });
  });

  it('rejects a non-canonical machine type', async () => {
    const result = await createMachineDetailed({ name: 'Tractor 1', type: 'spaceship' as never });
    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_MACHINE_TYPE' } });
    expect(mockDb.machine.create).not.toHaveBeenCalled();
  });
});

describe('updateMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.machine.findFirst.mockResolvedValue({ id: '607e7cda-b27c-45b5-898d-04ee3eea7a2a', farmId: 'farm-1' });
    mockDb.machine.update.mockResolvedValue({ id: '607e7cda-b27c-45b5-898d-04ee3eea7a2a' });
  });

  it('updates a machine that belongs to the active farm', async () => {
    const result = await updateMachine({ machineId: '607e7cda-b27c-45b5-898d-04ee3eea7a2a', name: 'Tractor 1', type: 'tractor', hoursSinceService: 55, isCertified: false });
    expect(result).toEqual({ success: true, machineId: '607e7cda-b27c-45b5-898d-04ee3eea7a2a' });
    expect(mockDb.machine.update).toHaveBeenCalledWith({
      where: { id: '607e7cda-b27c-45b5-898d-04ee3eea7a2a' },
      data: { name: 'Tractor 1', type: 'tractor', make: null, model: null, year: null, hoursSinceService: 55, nextServiceDueHours: null, isCertified: false },
    });
  });

  it('refuses to update a machine belonging to another farm', async () => {
    mockDb.machine.findFirst.mockResolvedValue(null);
    const result = await updateMachine({ machineId: '607e7cda-b27c-45b5-898d-04ee3eea7a2a', name: 'Tractor 1', type: 'tractor' });
    expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(mockDb.machine.update).not.toHaveBeenCalled();
  });
});
