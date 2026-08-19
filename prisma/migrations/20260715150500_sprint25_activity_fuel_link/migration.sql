ALTER TABLE "activities" ADD COLUMN "fuelInventoryItemId" TEXT;
CREATE INDEX "activities_fuelInventoryItemId_idx" ON "activities"("fuelInventoryItemId");
ALTER TABLE "activities" ADD CONSTRAINT "activities_fuelInventoryItemId_fkey" FOREIGN KEY ("fuelInventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
