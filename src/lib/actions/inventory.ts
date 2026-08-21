'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';
import { searchCtgbProducts, getCtgbProductById } from '@/integrations/ctgb/client';
import { upsertCachedProduct } from '@/integrations/ctgb/cache';
import type { CtgbLookupResult } from '@/integrations/ctgb/types';
import { isRateLimited } from '@/lib/rate-limit';

export type CtgbSearchActionResult = Omit<CtgbLookupResult, 'unavailableReason'> & { error?: UserFacingError };

function safeCaught(context: string, error: unknown): UserFacingError {
  const { message: _legacy, ...safe } = handleActionError(context, error, randomUUID());
  return safe;
}

/** Ctgb authorisation data is public, but the action requires an active farm
 * so it cannot become an unauthenticated proxy to the upstream provider. */
export async function searchCtgbProductsAction(query: string): Promise<CtgbSearchActionResult> {
  if (!query || query.trim().length < 2) return { state: 'ok', products: [] };
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { state: 'unavailable', products: [], error: userError('AUTH_REQUIRED') };
  }
  if (isRateLimited(`ctgb-search:${farm.id}`)) {
    return { state: 'unavailable', products: [], error: userError('RATE_LIMITED') };
  }
  const result = await searchCtgbProducts(query.trim());
  return result.state === 'unavailable'
    ? { state: result.state, products: result.products, error: userError('PROVIDER_UNAVAILABLE') }
    : { state: result.state, products: result.products };
}

const CreateInventoryItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(['herbicide', 'fungicide', 'insecticide', 'fertiliser', 'seed', 'fuel', 'other']),
  unit: z.enum(['L', 'kg', 'T', 'bag', 'box']),
  currentStock: z.coerce.number().min(0).max(999999).default(0),
  minimumStock: z.coerce.number().min(0).max(999999).optional(),
  purchasePricePerUnit: z.coerce.number().min(0).max(999999).optional(),
  supplierName: z.string().max(120).optional().or(z.literal('')),
  expiryDate: z.string().date().optional().or(z.literal('')),
  ctgbSourceProductId: z.string().max(100).optional().or(z.literal('')),
});

export type CreateInventoryItemState = {
  error?: UserFacingError;
  fieldErrors?: Record<string, UserFacingError>;
  values?: Record<string, string>;
  success?: boolean;
  itemId?: string;
};

function inventoryValidationErrors(error: z.ZodError): Record<string, UserFacingError> {
  const fieldErrors: Record<string, UserFacingError> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.');
    if (!field || fieldErrors[field]) continue;
    const code = field === 'category' ? 'INVALID_INVENTORY_CATEGORY'
      : field === 'unit' ? 'INVALID_UNIT'
        : field === 'expiryDate' ? 'INVALID_DATE'
          : ['currentStock', 'minimumStock', 'purchasePricePerUnit'].includes(field) ? 'INVALID_QUANTITY'
            : issue.code === 'too_small' ? 'REQUIRED_FIELD' : 'INVALID_VALUE';
    fieldErrors[field] = userError(code, { field });
  }
  return fieldErrors;
}

export async function createInventoryItem(
  _prev: CreateInventoryItemState,
  formData: FormData,
): Promise<CreateInventoryItemState> {
  const values = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
  const parsed = CreateInventoryItemSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: inventoryValidationErrors(parsed.error), values };

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: userError('AUTH_REQUIRED'), values };
  }

  const d = parsed.data;
  try {
    let ctgbProductReferenceId: string | undefined;
    let registrationNumber: string | undefined;
    let officialName: string | undefined;

    if (d.ctgbSourceProductId) {
      const lookup = await getCtgbProductById(d.ctgbSourceProductId);
      const product = lookup.products.find((candidate) => candidate.sourceProductId === d.ctgbSourceProductId);
      if (!product) return { error: userError('CTGB_PRODUCT_UNVERIFIED'), values };
      ctgbProductReferenceId = await upsertCachedProduct(product);
      registrationNumber = product.authorisationNumber;
      officialName = product.officialName;
    }

    const item = await db.inventoryItem.create({
      data: {
        farmId: farm.id,
        name: officialName ?? d.name,
        category: d.category,
        unit: d.unit,
        currentStock: d.currentStock,
        minimumStock: d.minimumStock ?? 0,
        purchasePricePerUnit: d.purchasePricePerUnit || undefined,
        supplierName: d.supplierName || undefined,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
        registrationNumber,
        ctgbProductReferenceId,
        isManualEntry: !ctgbProductReferenceId,
      },
    });
    revalidatePath('/inventory');
    return { success: true, itemId: item.id };
  } catch (error) {
    return { error: safeCaught('createInventoryItem', error), values };
  }
}

// ── Nutrient composition (Part of nutrient-balance — Sprint 28) ────────────
// A narrow, dedicated update limited to N/P/K percentages, not a general
// inventory-item edit action (createInventoryItem's siblings — quantity,
// price, expiry — have no update path yet; this only unblocks the nitrogen
// balance page, which needs a way to fill in composition on a fertiliser
// product that already exists).

const UpdateInventoryNutrientsSchema = z.object({
  itemId: z.string().uuid(),
  nitrogenPercent: z.coerce.number().min(0).max(100).optional(),
  phosphorusPercent: z.coerce.number().min(0).max(100).optional(),
  potassiumPercent: z.coerce.number().min(0).max(100).optional(),
});

export type UpdateInventoryNutrientsResult =
  | { success: true; itemId: string }
  | { success: false; error: UserFacingError };

export async function updateInventoryNutrients(
  input: z.infer<typeof UpdateInventoryNutrientsSchema>,
): Promise<UpdateInventoryNutrientsResult> {
  const parsed = UpdateInventoryNutrientsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || undefined;
    const code = field === 'itemId' ? 'NOT_FOUND' : 'INVALID_QUANTITY';
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
    const existing = await db.inventoryItem.findFirst({ where: { id: d.itemId, farmId: farm.id } });
    if (!existing) return { success: false, error: userError('NOT_FOUND') };

    const item = await db.inventoryItem.update({
      where: { id: d.itemId },
      data: {
        // A blank field means "don't know yet," not "clear this" — this form
        // has no way to distinguish the two, and the composition list only
        // ever shows a product while N/P is still unset, so leaving one
        // field blank while filling in another (entirely plausible: a
        // farmer often knows N/P from the bag but not K, or vice versa)
        // must never wipe a value already recorded in an earlier visit.
        nitrogenPercent: d.nitrogenPercent ?? (existing.nitrogenPercent != null ? Number(existing.nitrogenPercent) : null),
        phosphorusPercent: d.phosphorusPercent ?? (existing.phosphorusPercent != null ? Number(existing.phosphorusPercent) : null),
        potassiumPercent: d.potassiumPercent ?? (existing.potassiumPercent != null ? Number(existing.potassiumPercent) : null),
      },
    });
    revalidatePath('/nutrients');
    return { success: true, itemId: item.id };
  } catch (error) {
    return { success: false, error: safeCaught('updateInventoryNutrients', error) };
  }
}

export type UpdateInventoryNutrientsFormState = { error?: UserFacingError; success?: boolean };

export async function updateInventoryNutrientsForm(
  _previous: UpdateInventoryNutrientsFormState,
  formData: FormData,
): Promise<UpdateInventoryNutrientsFormState> {
  const result = await updateInventoryNutrients({
    itemId: String(formData.get('itemId') ?? ''),
    nitrogenPercent: formData.get('nitrogenPercent') ? String(formData.get('nitrogenPercent')) : undefined,
    phosphorusPercent: formData.get('phosphorusPercent') ? String(formData.get('phosphorusPercent')) : undefined,
    potassiumPercent: formData.get('potassiumPercent') ? String(formData.get('potassiumPercent')) : undefined,
  } as unknown as z.infer<typeof UpdateInventoryNutrientsSchema>);
  return result.success ? { success: true } : { error: result.error };
}
