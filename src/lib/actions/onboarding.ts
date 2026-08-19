'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getClerkUserId } from '@/lib/farm';
import { logProductEvent } from '@/lib/product-events';
import { handleActionError } from '@/lib/user-error';
import type { SafeErrorCode } from '@/i18n/error-codes';

export type OnboardingFormState = {
  errorCode?: SafeErrorCode;
  fieldErrorCodes?: Record<string, SafeErrorCode[]>;
  success?: boolean;
  farmId?: string;
};

function validationCodes(fields: readonly string[], overrides: Partial<Record<string, SafeErrorCode>> = {}): Record<string, SafeErrorCode[]> {
  return Object.fromEntries(fields.map((field) => [field, [overrides[field] ?? 'REQUIRED_FIELD']]));
}

// ─── Step: Farm details + location ────────────────────────────────────────────
// NOTE: farmType / legalName / city / province / postalCode / timezone /
// currency exist as DB columns (migration 20260713000001_sprint8_onboarding)
// but are deliberately NOT collected here yet — the generated Prisma Client
// was not regenerated this sprint (pre-existing environment blocker, see
// docs/Sprint_8_Onboarding_Report.md), so referencing those fields in a
// typed `db.farm.create({ data: {...} })` call would not compile. Follow-up
// once `npx prisma generate` can run again.
const CreateFarmSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().min(1).max(200),
  country: z.string().length(2).default('NL'),
  totalHectares: z.coerce.number().min(0).max(99999).optional(),
  brpNumber: z.string().max(20).optional().or(z.literal('')),
  vatNumber: z.string().max(30).optional().or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export async function createFarm(
  _prev: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return { errorCode: 'AUTH_REQUIRED' };
  }

  const raw = Object.fromEntries(formData);
  const parsed = CreateFarmSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrorCodes: validationCodes(parsed.error.issues.map((issue) => String(issue.path[0])), { name: 'FARM_NAME_REQUIRED', totalHectares: 'INVALID_AREA', latitude: 'INVALID_COORDINATES', longitude: 'INVALID_COORDINATES' }) };
  }

  // Idempotent: if this Clerk user already owns a farm, don't create a
  // second one — just report success with the existing farm. This also
  // makes double form submission (e.g. a double-click) safe.
  const existing = await db.farm.findUnique({ where: { clerkUserId } });
  if (existing) {
    return { success: true, farmId: existing.id };
  }

  const { name, location, country, totalHectares, brpNumber, vatNumber, latitude, longitude } = parsed.data;

  try {
    const farm = await db.farm.create({
      data: {
        clerkUserId,
        name,
        location,
        country,
        totalHectares: totalHectares ?? 0,
        brpNumber: brpNumber || undefined,
        vatNumber: vatNumber || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      },
    });

    revalidatePath('/dashboard');
    revalidatePath('/onboarding');
    return { success: true, farmId: farm.id };
  } catch (e) {
    return { errorCode: handleActionError('createFarm', e).code };
  }
}

// ─── Step: optional first inventory product ───────────────────────────────────
// Progressive disclosure: `category` drives which advanced fields the UI
// shows, but the server always validates the full set — a category-specific
// field simply stays undefined/optional if the UI never rendered it, and
// crop_protection/fertiliser fields only make DB sense on those categories
// (checked below, not by the schema — Zod validates shape, not category
// cross-field rules). Seed/fuel/other have no category-specific extra
// fields: the schema has no crop/variety/batch/certification columns for
// InventoryItem, and inventing them without a real migration would be
// exactly the kind of "invent regulatory data" this must not do.
const AddInventoryItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(['herbicide', 'fungicide', 'insecticide', 'fertiliser', 'seed', 'fuel', 'other']),
  unit: z.enum(['L', 'kg', 'T', 'bag', 'box']),
  currentStock: z.coerce.number().min(0).max(999999).default(0),
  minimumStock: z.coerce.number().min(0).max(999999).optional(),
  purchasePricePerUnit: z.coerce.number().min(0).max(999999).optional(),
  supplierName: z.string().max(120).optional().or(z.literal('')),
  expiryDate: z.string().date().optional().or(z.literal('')),
  // Crop protection (herbicide/fungicide/insecticide) advanced fields
  registrationNumber: z.string().max(50).optional().or(z.literal('')),
  activeIngredient: z.string().max(200).optional().or(z.literal('')),
  fracCode: z.string().max(20).optional().or(z.literal('')),
  hracCode: z.string().max(20).optional().or(z.literal('')),
  phiDays: z.coerce.number().int().min(0).max(365).optional().or(z.literal('')),
  // Fertiliser advanced fields
  nitrogenPercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  phosphorusPercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  potassiumPercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
});

const CROP_PROTECTION_CATEGORIES = new Set(['herbicide', 'fungicide', 'insecticide']);

export async function addOnboardingInventoryItem(
  _prev: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return { errorCode: 'AUTH_REQUIRED' };

  const farm = await db.farm.findUnique({ where: { clerkUserId } });
  if (!farm) return { errorCode: 'NOT_FOUND' };

  const raw = Object.fromEntries(formData);
  const parsed = AddInventoryItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrorCodes: validationCodes(parsed.error.issues.map((issue) => String(issue.path[0])), { category: 'INVALID_INVENTORY_CATEGORY', unit: 'INVALID_UNIT', expiryDate: 'INVALID_CERTIFICATE_DATE' }) };
  }

  const d = parsed.data;
  const isCropProtection = CROP_PROTECTION_CATEGORIES.has(d.category);
  const isFertiliser = d.category === 'fertiliser';

  try {
    const itemCountBefore = await db.inventoryItem.count({ where: { farmId: farm.id } });

    await db.inventoryItem.create({
      data: {
        farmId: farm.id,
        name: d.name,
        category: d.category,
        unit: d.unit,
        currentStock: d.currentStock,
        minimumStock: d.minimumStock ?? 0,
        purchasePricePerUnit: d.purchasePricePerUnit || undefined,
        supplierName: d.supplierName || undefined,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
        // Only ever persisted for the category they apply to — never let
        // fertiliser N/P/K leak onto a herbicide row or vice versa, even if
        // a crafted request included them.
        registrationNumber: isCropProtection ? (d.registrationNumber || undefined) : undefined,
        activeIngredient: isCropProtection ? (d.activeIngredient || undefined) : undefined,
        fracCode: isCropProtection ? (d.fracCode || undefined) : undefined,
        hracCode: isCropProtection ? (d.hracCode || undefined) : undefined,
        phiDays: isCropProtection && d.phiDays !== '' ? d.phiDays : undefined,
        nitrogenPercent: isFertiliser && d.nitrogenPercent !== '' ? d.nitrogenPercent : undefined,
        phosphorusPercent: isFertiliser && d.phosphorusPercent !== '' ? d.phosphorusPercent : undefined,
        potassiumPercent: isFertiliser && d.potassiumPercent !== '' ? d.potassiumPercent : undefined,
      },
    });

    if (itemCountBefore === 0) {
      logProductEvent({ event: 'first_inventory_item_created', farmId: farm.id, module: 'inventory' });
    }

    revalidatePath('/inventory');
    revalidatePath('/onboarding');
    return { success: true };
  } catch (e) {
    return { errorCode: handleActionError('addOnboardingInventoryItem', e).code };
  }
}

// ─── Step: optional first employee / spray licence ────────────────────────────

const AddEmployeeSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(60).optional().or(z.literal('')),
  hasSpraying: z.coerce.boolean().optional(),
  certNumber: z.string().max(50).optional().or(z.literal('')),
  certExpiry: z.string().date().optional().or(z.literal('')),
});

export async function addOnboardingEmployee(
  _prev: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return { errorCode: 'AUTH_REQUIRED' };

  const farm = await db.farm.findUnique({ where: { clerkUserId } });
  if (!farm) return { errorCode: 'NOT_FOUND' };

  const raw = Object.fromEntries(formData);
  const parsed = AddEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrorCodes: validationCodes(parsed.error.issues.map((issue) => String(issue.path[0])), { certExpiry: 'INVALID_CERTIFICATE_DATE' }) };
  }

  const { name, role, hasSpraying, certNumber, certExpiry } = parsed.data;

  // Certificate details are recorded as entered — NOT verified against any
  // registry. UI copy must make this explicit; never claim verification here.
  try {
    await db.employee.create({
      data: {
        farmId: farm.id,
        name,
        role: role || undefined,
        hasSpraying: hasSpraying ?? false,
        certNumber: certNumber || undefined,
        certExpiry: certExpiry ? new Date(certExpiry) : undefined,
      },
    });

    revalidatePath('/onboarding');
    return { success: true };
  } catch (e) {
    return { errorCode: handleActionError('addOnboardingEmployee', e).code };
  }
}
