import type { Prisma } from '@prisma/client';

/**
 * Pure correction-preview logic — deliberately NOT in a `'use server'` file.
 * A `'use server'` file's exports are all wrapped into Server Action
 * references by Next.js's compiler, which requires every export to be an
 * async function; this one is a plain synchronous function called BOTH
 * from within `correctActivity`'s own transaction (synchronously, no
 * network boundary) and from the read-only `previewActivityCorrection`
 * Server Action — it must stay an ordinary function, not get wrapped into
 * an RPC reference, or the synchronous in-transaction call would receive a
 * Promise instead of the real result.
 */

export interface CorrectionFieldDiff {
  old: string | number | null;
  new: string | number | null;
}

export interface StockChangePreview {
  inventoryItemId: string;
  productName: string;
  /** Positive = additional deduction; negative = stock restored. */
  quantityDelta: number;
  direction: 'out' | 'correction';
  resultingStockBelowZero: boolean;
}

export interface CorrectionPreview {
  diff: Record<string, CorrectionFieldDiff>;
  stockChanges: StockChangePreview[];
  warnings: string[];
  isSignificantProductChange: boolean;
}

export interface CorrectableData {
  operatorName: string;
  certificateNumber?: string;
  waterVolumePerHa?: number | '';
  nozzleType?: string;
  machineId?: string;
  areaHa: number;
  productId?: string;
  dosePerHa?: number | '';
  doseUnit?: string;
  bbchStage?: number | '';
  date: string;
  weatherTempC?: number | '';
  weatherWindKmh?: number | '';
  weatherWindDir?: string;
  weatherHumidity?: number | '';
  notes?: string;
}

export type PreviousActivityForCorrection = Prisma.ActivityGetPayload<{
  include: {
    product: { select: { id: true; name: true; farmId: true; currentStock: true } };
    machine: { select: { id: true; name: true; farmId: true } };
  };
}>;

/** Computes the diff and stock-movement preview for a proposed correction
 * against the previous effective version. Used both by the read-only
 * preview action and by the real correction action, so they can never
 * disagree (Part 4: "calculated stock difference preview"). */
export function computeCorrectionPreview(
  previous: PreviousActivityForCorrection,
  submitted: CorrectableData,
  currentStockByProductId: Map<string, number>,
): CorrectionPreview {
  const diff: Record<string, CorrectionFieldDiff> = {};
  const warnings: string[] = [];

  const prevProductId = previous.productId ?? '';
  const newProductId = submitted.productId ?? '';
  const isSignificantProductChange = prevProductId !== newProductId;

  function noteDiff(key: string, oldVal: string | number | null, newVal: string | number | null) {
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      diff[key] = { old: oldVal, new: newVal };
    }
  }

  noteDiff('areaHa', Number(previous.areaHa), submitted.areaHa);
  noteDiff('dosePerHa', previous.dosePerHa != null ? Number(previous.dosePerHa) : null, submitted.dosePerHa || null);
  noteDiff('doseUnit', previous.doseUnit, submitted.doseUnit || null);
  noteDiff('waterVolumePerHa', previous.waterVolumePerHa != null ? Number(previous.waterVolumePerHa) : null, submitted.waterVolumePerHa || null);
  noteDiff('operatorName', previous.operatorName, submitted.operatorName);
  noteDiff('certificateNumber', previous.certificateNumber, submitted.certificateNumber || null);
  noteDiff('machineId', previous.machine?.name ?? null, submitted.machineId || null);
  noteDiff('nozzleType', previous.nozzleType, submitted.nozzleType || null);
  noteDiff('bbchStage', previous.bbchStage, submitted.bbchStage || null);
  noteDiff('notes', previous.notes, submitted.notes || null);
  noteDiff('productId', previous.product?.name ?? null, isSignificantProductChange ? '(new product)' : previous.product?.name ?? null);

  if (isSignificantProductChange) {
    warnings.push('The product on this record is being changed — this is a significant correction. Both the original and corrected product will remain visible.');
  }

  const stockChanges: StockChangePreview[] = [];
  const prevTotal = previous.productId && previous.dosePerHa ? Number(previous.dosePerHa) * Number(previous.areaHa) : 0;
  const newTotal = submitted.productId && submitted.dosePerHa ? submitted.dosePerHa * submitted.areaHa : 0;

  if (prevProductId && prevProductId !== newProductId) {
    // Old product fully released.
    const stock = currentStockByProductId.get(prevProductId) ?? 0;
    stockChanges.push({
      inventoryItemId: prevProductId,
      productName: previous.product?.name ?? 'previous product',
      quantityDelta: -prevTotal,
      direction: 'correction',
      resultingStockBelowZero: stock + prevTotal < 0,
    });
  }
  if (newProductId && newProductId !== prevProductId) {
    const stock = currentStockByProductId.get(newProductId) ?? 0;
    stockChanges.push({
      inventoryItemId: newProductId,
      productName: '(new product)',
      quantityDelta: newTotal,
      direction: 'out',
      resultingStockBelowZero: stock - newTotal < 0,
    });
  }
  if (prevProductId && prevProductId === newProductId) {
    const deltaTotal = newTotal - prevTotal;
    if (deltaTotal !== 0) {
      const stock = currentStockByProductId.get(prevProductId) ?? 0;
      stockChanges.push({
        inventoryItemId: prevProductId,
        productName: previous.product?.name ?? 'product',
        quantityDelta: deltaTotal,
        direction: deltaTotal > 0 ? 'out' : 'correction',
        resultingStockBelowZero: stock - deltaTotal < 0,
      });
    }
  }

  for (const change of stockChanges) {
    if (change.resultingStockBelowZero) {
      warnings.push(`${change.productName}: this correction would take recorded stock below zero.`);
    }
  }

  return { diff, stockChanges, warnings, isSignificantProductChange };
}
