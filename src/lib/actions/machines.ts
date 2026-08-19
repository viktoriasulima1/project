'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';

const MACHINE_TYPES = ['tractor', 'sprayer', 'combine', 'drill', 'cultivator', 'loader', 'trailer', 'other'] as const;

const CreateMachineSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(MACHINE_TYPES),
});

export type CreateMachineResult =
  | { success: true; machineId: string; name: string }
  | { success: false; error: UserFacingError };

function safeCaught(error: unknown): UserFacingError {
  const { message: _legacy, ...safe } = handleActionError('createMachine', error, randomUUID());
  return safe;
}

export async function createMachine(name: string, type: string): Promise<CreateMachineResult> {
  const parsed = CreateMachineSchema.safeParse({ name, type });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.') || undefined;
    const code = field === 'type' ? 'INVALID_MACHINE_TYPE'
      : parsed.error.issues[0]?.code === 'too_small' ? 'REQUIRED_FIELD' : 'INVALID_VALUE';
    return { success: false, error: userError(code, { field }) };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }

  try {
    const machine = await db.machine.create({ data: { farmId: farm.id, name: parsed.data.name, type: parsed.data.type } });
    return { success: true, machineId: machine.id, name: machine.name };
  } catch (error) {
    return { success: false, error: safeCaught(error) };
  }
}

// ── Machines management page: full field set, create + update ─────────────

const MachineDetailFieldsSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(MACHINE_TYPES),
  make: z.string().max(80).optional().or(z.literal('')),
  model: z.string().max(80).optional().or(z.literal('')),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  hoursSinceService: z.coerce.number().int().nonnegative().optional(),
  nextServiceDueHours: z.coerce.number().int().nonnegative().optional(),
  isCertified: z.coerce.boolean().optional(),
});

export type MachineDetailInput = z.infer<typeof MachineDetailFieldsSchema>;

export type MachineActionResult =
  | { success: true; machineId: string }
  | { success: false; error: UserFacingError };

function parseMachineDetail(input: unknown): { success: true; data: MachineDetailInput } | { success: false; error: UserFacingError } {
  const parsed = MachineDetailFieldsSchema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  const field = issue?.path.join('.') || undefined;
  const code = field === 'type' ? 'INVALID_MACHINE_TYPE'
    : issue?.code === 'too_small' ? 'REQUIRED_FIELD'
      : 'INVALID_VALUE';
  return { success: false, error: userError(code, { field }) };
}

export async function createMachineDetailed(input: MachineDetailInput): Promise<MachineActionResult> {
  const parsed = parseMachineDetail(input);
  if (!parsed.success) return parsed;

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }

  const d = parsed.data;
  try {
    const machine = await db.machine.create({
      data: {
        farmId: farm.id,
        name: d.name,
        type: d.type,
        make: d.make || undefined,
        model: d.model || undefined,
        year: d.year,
        hoursSinceService: d.hoursSinceService,
        nextServiceDueHours: d.nextServiceDueHours,
        isCertified: d.isCertified ?? true,
      },
    });
    revalidatePath('/machines');
    return { success: true, machineId: machine.id };
  } catch (error) {
    return { success: false, error: safeCaught(error) };
  }
}

const UpdateMachineSchema = MachineDetailFieldsSchema.extend({ machineId: z.string().uuid() });

export async function updateMachine(input: MachineDetailInput & { machineId: string }): Promise<MachineActionResult> {
  const parsed = UpdateMachineSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || undefined;
    const code = field === 'type' ? 'INVALID_MACHINE_TYPE'
      : issue?.code === 'too_small' ? 'REQUIRED_FIELD'
        : field === 'machineId' ? 'NOT_FOUND'
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
    const existing = await db.machine.findFirst({ where: { id: d.machineId, farmId: farm.id } });
    if (!existing) return { success: false, error: userError('NOT_FOUND') };

    const machine = await db.machine.update({
      where: { id: d.machineId },
      data: {
        name: d.name,
        type: d.type,
        make: d.make || null,
        model: d.model || null,
        year: d.year ?? null,
        hoursSinceService: d.hoursSinceService ?? null,
        nextServiceDueHours: d.nextServiceDueHours ?? null,
        isCertified: d.isCertified ?? true,
      },
    });
    revalidatePath('/machines');
    return { success: true, machineId: machine.id };
  } catch (error) {
    return { success: false, error: safeCaught(error) };
  }
}

// ── useActionState-compatible form wrappers ─────────────────────────────────

export type MachineFormState = { error?: UserFacingError; success?: boolean };

function readMachineFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? ''),
    make: String(formData.get('make') ?? ''),
    model: String(formData.get('model') ?? ''),
    year: formData.get('year') ? String(formData.get('year')) : undefined,
    hoursSinceService: formData.get('hoursSinceService') ? String(formData.get('hoursSinceService')) : undefined,
    nextServiceDueHours: formData.get('nextServiceDueHours') ? String(formData.get('nextServiceDueHours')) : undefined,
    isCertified: formData.get('isCertified') === 'on' || formData.get('isCertified') === 'true',
  };
}

export async function createMachineDetailedForm(_previous: MachineFormState, formData: FormData): Promise<MachineFormState> {
  const result = await createMachineDetailed(readMachineFields(formData) as unknown as MachineDetailInput);
  return result.success ? { success: true } : { error: result.error };
}

export async function updateMachineForm(_previous: MachineFormState, formData: FormData): Promise<MachineFormState> {
  const machineId = String(formData.get('machineId') ?? '');
  const result = await updateMachine({ ...(readMachineFields(formData) as unknown as MachineDetailInput), machineId });
  return result.success ? { success: true } : { error: result.error };
}
