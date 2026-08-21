import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
const { mockDb } = vi.hoisted(() => ({
  mockDb: { employee: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() } },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));

import { createEmployee, updateEmployee, updateEmployeeForm } from '../employees';
import { getActiveFarmOrThrow } from '@/lib/farm';

describe('createEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.employee.create.mockResolvedValue({ id: 'a2661b3b-2333-4cdd-82f1-746b9124312f' });
  });

  it('creates an employee under the authenticated farm', async () => {
    const result = await createEmployee({ name: 'Jan de Boer', role: 'Operator', hasSpraying: true, certNumber: 'NL-123', certExpiry: '2027-05-01' });
    expect(result).toEqual({ success: true, employeeId: 'a2661b3b-2333-4cdd-82f1-746b9124312f' });
    expect(mockDb.employee.create).toHaveBeenCalledWith({
      data: { farmId: 'farm-1', name: 'Jan de Boer', role: 'Operator', hasSpraying: true, certNumber: 'NL-123', certExpiry: new Date('2027-05-01') },
    });
  });

  it('rejects an empty name without creating a record', async () => {
    const result = await createEmployee({ name: '', hasSpraying: false });
    expect(result).toMatchObject({ success: false, error: { code: 'REQUIRED_FIELD', field: 'name' } });
    expect(mockDb.employee.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed certificate expiry date', async () => {
    const result = await createEmployee({ name: 'Jan', certExpiry: 'not-a-date' });
    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_CERTIFICATE_DATE', field: 'certExpiry' } });
    expect(mockDb.employee.create).not.toHaveBeenCalled();
  });

  it('does not reveal farm details when there is no active farm', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('foreign farm details'));
    const result = await createEmployee({ name: 'Jan' });
    expect(result).toMatchObject({ success: false, error: { code: 'AUTH_REQUIRED' } });
    expect(mockDb.employee.create).not.toHaveBeenCalled();
  });

  it('never leaks a raw database error message', async () => {
    mockDb.employee.create.mockRejectedValue(new Error('database unavailable'));
    const result = await createEmployee({ name: 'Jan' });
    expect(result.success).toBe(false);
    if (!result.success) expect(JSON.stringify(result.error)).not.toContain('database unavailable');
  });
});

describe('updateEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.employee.findFirst.mockResolvedValue({ id: 'a2661b3b-2333-4cdd-82f1-746b9124312f', farmId: 'farm-1' });
    mockDb.employee.update.mockResolvedValue({ id: 'a2661b3b-2333-4cdd-82f1-746b9124312f' });
  });

  it('updates an employee that belongs to the active farm', async () => {
    const result = await updateEmployee({ employeeId: 'a2661b3b-2333-4cdd-82f1-746b9124312f', name: 'Jan de Boer', hasSpraying: true, certExpiry: '2027-01-01', isActive: false });
    expect(result).toEqual({ success: true, employeeId: 'a2661b3b-2333-4cdd-82f1-746b9124312f' });
    expect(mockDb.employee.update).toHaveBeenCalledWith({
      where: { id: 'a2661b3b-2333-4cdd-82f1-746b9124312f' },
      data: { name: 'Jan de Boer', role: null, hasSpraying: true, certNumber: null, certExpiry: new Date('2027-01-01'), isActive: false },
    });
  });

  it('refuses to update an employee belonging to another farm', async () => {
    mockDb.employee.findFirst.mockResolvedValue(null);
    const result = await updateEmployee({ employeeId: 'a2661b3b-2333-4cdd-82f1-746b9124312f', name: 'Jan' });
    expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(mockDb.employee.update).not.toHaveBeenCalled();
  });

  it('scopes the ownership check to the active farm', async () => {
    await updateEmployee({ employeeId: 'a2661b3b-2333-4cdd-82f1-746b9124312f', name: 'Jan' });
    expect(mockDb.employee.findFirst).toHaveBeenCalledWith({ where: { id: 'a2661b3b-2333-4cdd-82f1-746b9124312f', farmId: 'farm-1' } });
  });
});

describe('updateEmployeeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.employee.findFirst.mockResolvedValue({ id: 'a2661b3b-2333-4cdd-82f1-746b9124312f', farmId: 'farm-1' });
    mockDb.employee.update.mockResolvedValue({ id: 'a2661b3b-2333-4cdd-82f1-746b9124312f' });
  });

  function fd(overrides: Record<string, string> = {}): FormData {
    const data = new FormData();
    const base: Record<string, string> = { employeeId: 'a2661b3b-2333-4cdd-82f1-746b9124312f', name: 'Jan de Boer', ...overrides };
    for (const [k, v] of Object.entries(base)) data.set(k, v);
    return data;
  }

  it('deactivates an employee when the Active checkbox is unchecked — an unchecked box is simply absent from FormData', async () => {
    // EditForm always renders this checkbox; the browser omits it from
    // FormData when unchecked, exactly like it would if the field had never
    // been rendered at all. That absence must mean false here, not "leave
    // isActive unchanged" — the bug this test guards was a silent no-op on
    // deactivation, mistaking every unchecked submission for undefined.
    const result = await updateEmployeeForm({}, fd());
    expect(result).toEqual({ success: true });
    expect(mockDb.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
  });

  it('keeps an employee active when the Active checkbox is checked', async () => {
    const result = await updateEmployeeForm({}, fd({ isActive: 'on' }));
    expect(result).toEqual({ success: true });
    expect(mockDb.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
    );
  });
});
