import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sprint 25 Part 1 — proves the safe purchase policy: finalized purchases are
// reversal-only (never edited in place), the original stays in history, the
// reversal is a compensating stock movement (not a mutation), and a purchase
// whose stock has been partly consumed cannot be reversed at all (which would
// corrupt weighted-average valuation) — it must be corrected another way.

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn(), getClerkUserId: vi.fn() }));

vi.mock('@/lib/db', () => {
  const tx = {
    inventoryPurchase: { findFirst: vi.fn(), update: vi.fn() },
    inventoryItem: { update: vi.fn() },
    stockMovement: { create: vi.fn() },
  };
  const db = { _tx: tx, $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)), auditEvent: { create: vi.fn() } };
  return { db };
});

import { reverseInventoryPurchase } from '../economics';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { db } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (db as any)._tx as {
  inventoryPurchase: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  inventoryItem: { update: ReturnType<typeof vi.fn> };
  stockMovement: { create: ReturnType<typeof vi.fn> };
};

const FARM = { id: 'farm-1', currency: 'EUR' };
const REASON = 'Wrong supplier invoice attached to this purchase.';

function activePurchase(over: Record<string, unknown> = {}) {
  return {
    id: 'p1', farmId: FARM.id, inventoryItemId: 'item-1', quantity: 100, totalAmount: 500, unitCost: 5,
    notes: null, status: 'active', inventoryItem: { id: 'item-1', currentStock: 100, purchasePricePerUnit: 5 }, ...over,
  };
}

describe('reverseInventoryPurchase — safe purchase policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-1');
    (db.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    tx.inventoryPurchase.findFirst.mockResolvedValue(activePurchase());
    tx.inventoryPurchase.update.mockResolvedValue({});
    tx.inventoryItem.update.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
  });

  it('requires a reason of at least 10 characters', async () => {
    const result = await reverseInventoryPurchase('p1', 'short');
    expect(result.error).toMatch(/10 characters/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to reverse a purchase whose stock has already been partly consumed', async () => {
    // stock (60) < purchased qty (100): some was already used → cannot reverse.
    tx.inventoryPurchase.findFirst.mockResolvedValue(activePurchase({ inventoryItem: { id: 'item-1', currentStock: 60, purchasePricePerUnit: 5 } }));
    const result = await reverseInventoryPurchase('p1', REASON);
    expect(result.error).toMatch(/already been consumed/i);
    expect(tx.inventoryPurchase.update).not.toHaveBeenCalled(); // original untouched
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('preserves the original (marks it reversed, never deletes) and compensates via a correction stock movement', async () => {
    const result = await reverseInventoryPurchase('p1', REASON);
    expect(result.success).toBe(true);
    expect(tx.inventoryPurchase.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1' }, data: expect.objectContaining({ status: 'reversed' }) }));
    expect(tx.stockMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direction: 'correction', quantity: 100, purchaseId: 'p1' }) }));
    // stock is decremented by the reversed quantity, not left negative or duplicated
    expect(tx.inventoryItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currentStock: { decrement: 100 } }) }));
  });

  it('records a reversed audit event, preserving history', async () => {
    await reverseInventoryPurchase('p1', REASON);
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'reversed', entityType: 'InventoryPurchase' }) }));
  });

  it('rejects a purchase that is not active/owned by this farm', async () => {
    tx.inventoryPurchase.findFirst.mockResolvedValue(null);
    const result = await reverseInventoryPurchase('p1', REASON);
    expect(result.error).toMatch(/not found/i);
  });
});
