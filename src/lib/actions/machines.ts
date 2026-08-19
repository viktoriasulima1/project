'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';

const CreateMachineSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['tractor', 'sprayer', 'combine', 'drill', 'cultivator', 'loader', 'trailer', 'other']),
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
