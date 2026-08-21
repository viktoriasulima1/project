'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';

const EmployeeFieldsSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(60).optional().or(z.literal('')),
  hasSpraying: z.coerce.boolean().optional(),
  certNumber: z.string().max(50).optional().or(z.literal('')),
  certExpiry: z.string().date().optional().or(z.literal('')),
});

export type EmployeeInput = z.infer<typeof EmployeeFieldsSchema>;

export type EmployeeActionResult =
  | { success: true; employeeId: string }
  | { success: false; error: UserFacingError };

function safeCaught(context: string, error: unknown): UserFacingError {
  const { message: _legacy, ...safe } = handleActionError(context, error, randomUUID());
  return safe;
}

function parseEmployeeFields(input: unknown): { success: true; data: EmployeeInput } | { success: false; error: UserFacingError } {
  const parsed = EmployeeFieldsSchema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  const field = issue?.path.join('.') || undefined;
  const code = field === 'certExpiry' ? 'INVALID_CERTIFICATE_DATE'
    : issue?.code === 'too_small' ? 'REQUIRED_FIELD'
      : 'INVALID_VALUE';
  return { success: false, error: userError(code, { field }) };
}

/** Certificate details are recorded as entered — NOT verified against any
 * registry. Callers must make that explicit in the UI, never claim
 * verification here (same rule as onboarding's own employee step). */
export async function createEmployee(input: EmployeeInput): Promise<EmployeeActionResult> {
  const parsed = parseEmployeeFields(input);
  if (!parsed.success) return parsed;

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }

  const d = parsed.data;
  try {
    const employee = await db.employee.create({
      data: {
        farmId: farm.id,
        name: d.name,
        role: d.role || undefined,
        hasSpraying: d.hasSpraying ?? false,
        certNumber: d.certNumber || undefined,
        certExpiry: d.certExpiry ? new Date(d.certExpiry) : undefined,
      },
    });
    revalidatePath('/team');
    return { success: true, employeeId: employee.id };
  } catch (error) {
    return { success: false, error: safeCaught('createEmployee', error) };
  }
}

const UpdateEmployeeSchema = EmployeeFieldsSchema.extend({
  employeeId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});

export async function updateEmployee(
  input: EmployeeInput & { employeeId: string; isActive?: boolean },
): Promise<EmployeeActionResult> {
  const parsed = UpdateEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || undefined;
    const code = field === 'certExpiry' ? 'INVALID_CERTIFICATE_DATE'
      : issue?.code === 'too_small' ? 'REQUIRED_FIELD'
        : field === 'employeeId' ? 'NOT_FOUND'
          : 'INVALID_VALUE';
    return { success: false, error: userError(code, { field }) };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }

  const d = parsed.data;
  try {
    const existing = await db.employee.findFirst({ where: { id: d.employeeId, farmId: farm.id } });
    if (!existing) return { success: false, error: userError('NOT_FOUND') };

    const employee = await db.employee.update({
      where: { id: d.employeeId },
      data: {
        name: d.name,
        role: d.role || null,
        hasSpraying: d.hasSpraying ?? false,
        certNumber: d.certNumber || null,
        certExpiry: d.certExpiry ? new Date(d.certExpiry) : null,
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    revalidatePath('/team');
    return { success: true, employeeId: employee.id };
  } catch (error) {
    return { success: false, error: safeCaught('updateEmployee', error) };
  }
}

// ── useActionState-compatible form wrappers ─────────────────────────────────

export type EmployeeFormState = { error?: UserFacingError; success?: boolean };

function readFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    role: String(formData.get('role') ?? ''),
    hasSpraying: formData.get('hasSpraying') === 'on' || formData.get('hasSpraying') === 'true',
    certNumber: String(formData.get('certNumber') ?? ''),
    certExpiry: String(formData.get('certExpiry') ?? ''),
  };
}

export async function createEmployeeForm(_previous: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const result = await createEmployee(readFields(formData));
  return result.success ? { success: true } : { error: result.error };
}

export async function updateEmployeeForm(_previous: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const employeeId = String(formData.get('employeeId') ?? '');
  // EditForm always renders this checkbox, so an unchecked box (which HTML
  // omits from FormData entirely, indistinguishable at this point from
  // "never rendered") unambiguously means false here — never treat its
  // absence as "leave unchanged," or deactivating a team member silently
  // does nothing.
  const isActiveRaw = formData.get('isActive');
  const result = await updateEmployee({
    ...readFields(formData),
    employeeId,
    isActive: isActiveRaw === 'on' || isActiveRaw === 'true',
  });
  return result.success ? { success: true } : { error: result.error };
}
