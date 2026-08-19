import { Topbar } from '@/components/layout/Topbar';
import { StubPage } from '@/components/layout/StubPage';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { InventoryClient } from '@/components/inventory/InventoryClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inventory — FarmOS' };

export default async function InventoryPage() {
  const farm = await requireFarm();
  const rawItems = await db.inventoryItem.findMany({
    where: { farmId: farm.id },
    include: { ctgbProductReference: { select: { authorisationStatus: true } } },
    orderBy: { name: 'asc' },
  });

  if (rawItems.length === 0) {
    return (
      <>
        <Topbar title="Inventory" subtitle="Stock levels, product register, and expiry tracking" farmName={farm.name} />
        <StubPage
          icon="◫"
          title="No products yet"
          description="Add products to track stock, costs and activity usage. Search the official Ctgb register, or add one manually."
          action={{ label: 'Add a product', href: '/onboarding?step=inventory' }}
        />
      </>
    );
  }

  const items = rawItems.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
    currentStock: Number(i.currentStock),
    minimumStock: Number(i.minimumStock),
    purchasePricePerUnit: i.purchasePricePerUnit != null ? Number(i.purchasePricePerUnit) : null,
    registrationNumber: i.registrationNumber,
    isManualEntry: i.isManualEntry,
    ctgbAuthorisationStatus: i.ctgbProductReference?.authorisationStatus ?? null,
  }));

  return (
    <>
      <Topbar
        title="Inventory"
        subtitle={`${items.length} product${items.length !== 1 ? 's' : ''} on record`}
        farmName={farm.name}
      />
      <InventoryClient items={items} />
    </>
  );
}
