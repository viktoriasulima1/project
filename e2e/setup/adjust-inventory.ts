import { PrismaClient } from '@prisma/client';

function getE2ePrisma(): PrismaClient {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e|test/i.test(url)) {
    throw new Error('adjust-inventory.ts refuses to run without a valid E2E_DATABASE_URL (must contain "e2e" or "test").');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Test-only, direct-DB adjustment of an already-seeded InventoryItem —
 * mirrors seed-farms.ts's own "bypass the UI for setup, not for the thing
 * under test" convention. Used by Sprint 16 E2E specs to give a seeded
 * product a real purchase price (Finance golden flow) without needing an
 * `updateInventoryItem` action, which doesn't exist yet (see
 * docs/FarmOS_False_Completeness_Audit.md #3).
 */
export async function setInventoryItemFields(
  productId: string,
  data: { purchasePricePerUnit?: number; minimumStock?: number },
): Promise<void> {
  const prisma = getE2ePrisma();
  try {
    await prisma.inventoryItem.update({ where: { id: productId }, data });
  } finally {
    await prisma.$disconnect();
  }
}
