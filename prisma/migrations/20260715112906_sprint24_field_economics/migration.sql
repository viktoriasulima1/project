-- CreateEnum
CREATE TYPE "EconomicEntryKind" AS ENUM ('cost', 'revenue');

-- CreateEnum
CREATE TYPE "EconomicSourceType" AS ENUM ('inventory_input', 'labour', 'machinery', 'fuel', 'contractor', 'field_rent', 'utilities', 'soil_lab', 'miscellaneous', 'manual_expense', 'crop_sale', 'subsidy', 'contract_income', 'insurance_compensation', 'other_income');

-- CreateEnum
CREATE TYPE "CostAllocationMethod" AS ENUM ('direct_field', 'per_hectare', 'per_crop_area', 'equal_active_field', 'yield_proportional', 'unallocated');

-- CreateEnum
CREATE TYPE "FinancialConfidence" AS ENUM ('recorded', 'allocated', 'estimated', 'missing');

-- CreateEnum
CREATE TYPE "EconomicRecordStatus" AS ENUM ('active', 'corrected', 'reversed');

-- CreateEnum
CREATE TYPE "HarvestUnit" AS ENUM ('kg', 'tonnes', 'boxes', 'pieces');

-- CreateEnum
CREATE TYPE "RevenueType" AS ENUM ('crop_sale', 'subsidy', 'contract_income', 'insurance_compensation', 'other_farm_income');

-- CreateEnum
CREATE TYPE "RevenueStatus" AS ENUM ('expected', 'approved', 'received');

-- CreateEnum
CREATE TYPE "LabourCostType" AS ENUM ('employee', 'owner_estimate', 'contractor');

-- CreateEnum
CREATE TYPE "FuelCostPolicy" AS ENUM ('included_in_hourly_rate', 'tracked_separately');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "actualHours" DECIMAL(7,2),
ADD COLUMN     "fuelUsed" DECIMAL(10,3),
ADD COLUMN     "machineHours" DECIMAL(7,2);

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "costEffectiveFrom" DATE,
ADD COLUMN     "hourlyOperationalCost" DECIMAL(10,2),
ADD COLUMN     "labourCostType" "LabourCostType" NOT NULL DEFAULT 'employee';

-- AlterTable
ALTER TABLE "machines" ADD COLUMN     "contractorRate" DECIMAL(10,2),
ADD COLUMN     "costEffectiveFrom" DATE,
ADD COLUMN     "fuelConsumptionPerHour" DECIMAL(8,3),
ADD COLUMN     "fuelCostPolicy" "FuelCostPolicy" NOT NULL DEFAULT 'included_in_hourly_rate',
ADD COLUMN     "hourlyOperationalCost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "season_plan_items" ADD COLUMN     "expectedContractorCostEur" DECIMAL(12,2),
ADD COLUMN     "expectedInputCostEur" DECIMAL(12,2),
ADD COLUMN     "expectedLabourCostEur" DECIMAL(12,2),
ADD COLUMN     "expectedMachineCostEur" DECIMAL(12,2),
ADD COLUMN     "expectedOverheadEur" DECIMAL(12,2),
ADD COLUMN     "expectedRevenueEur" DECIMAL(14,2),
ADD COLUMN     "expectedSalePrice" DECIMAL(12,4),
ADD COLUMN     "expectedYieldQuantity" DECIMAL(14,3),
ADD COLUMN     "expectedYieldUnit" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "purchaseId" TEXT;

-- CreateTable
CREATE TABLE "economic_entries" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "fieldSeasonId" TEXT,
    "fieldId" TEXT,
    "crop" "CropName",
    "kind" "EconomicEntryKind" NOT NULL,
    "sourceType" "EconomicSourceType" NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "quantity" DECIMAL(14,3),
    "unit" TEXT,
    "unitCost" DECIMAL(12,4),
    "costDate" DATE NOT NULL,
    "allocationMethod" "CostAllocationMethod" NOT NULL,
    "confidence" "FinancialConfidence" NOT NULL,
    "status" "EconomicRecordStatus" NOT NULL DEFAULT 'active',
    "reversalOfId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economic_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_cost_snapshots" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "sourceType" "EconomicSourceType" NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(12,4),
    "priceSource" TEXT,
    "priceEffectiveDate" DATE,
    "totalCost" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "confidence" "FinancialConfidence" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_purchases" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "supplier" TEXT,
    "purchaseDate" DATE NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "vatAmount" DECIMAL(12,2),
    "batchLot" TEXT,
    "invoiceReference" TEXT,
    "notes" TEXT,
    "status" "EconomicRecordStatus" NOT NULL DEFAULT 'active',
    "correctionOfId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_expenses" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "fieldSeasonId" TEXT,
    "sourceType" "EconomicSourceType" NOT NULL,
    "description" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(14,3),
    "unit" TEXT,
    "allocationMethod" "CostAllocationMethod" NOT NULL,
    "confidence" "FinancialConfidence" NOT NULL DEFAULT 'recorded',
    "reference" TEXT,
    "notes" TEXT,
    "status" "EconomicRecordStatus" NOT NULL DEFAULT 'active',
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvest_results" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "fieldSeasonId" TEXT NOT NULL,
    "activityId" TEXT,
    "harvestDate" DATE NOT NULL,
    "harvestedAreaHa" DECIMAL(8,2) NOT NULL,
    "grossQuantity" DECIMAL(14,3) NOT NULL,
    "saleableQuantity" DECIMAL(14,3),
    "unit" "HarvestUnit" NOT NULL,
    "moisturePercent" DECIMAL(5,2),
    "qualityGrade" TEXT,
    "storageLocation" TEXT,
    "batchLot" TEXT,
    "wasteLoss" DECIMAL(14,3),
    "status" "EconomicRecordStatus" NOT NULL DEFAULT 'active',
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harvest_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_entries" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "fieldSeasonId" TEXT,
    "type" "RevenueType" NOT NULL,
    "name" TEXT NOT NULL,
    "revenueDate" DATE NOT NULL,
    "quantity" DECIMAL(14,3),
    "unit" TEXT,
    "pricePerUnit" DECIMAL(12,4),
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "buyer" TEXT,
    "qualityGrade" TEXT,
    "batchReference" TEXT,
    "allocationMethod" "CostAllocationMethod" NOT NULL,
    "revenueStatus" "RevenueStatus" NOT NULL DEFAULT 'received',
    "reference" TEXT,
    "notes" TEXT,
    "status" "EconomicRecordStatus" NOT NULL DEFAULT 'active',
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "economic_entries_farmId_seasonId_kind_idx" ON "economic_entries"("farmId", "seasonId", "kind");

-- CreateIndex
CREATE INDEX "economic_entries_fieldSeasonId_idx" ON "economic_entries"("fieldSeasonId");

-- CreateIndex
CREATE INDEX "economic_entries_sourceType_sourceEntityId_idx" ON "economic_entries"("sourceType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "economic_entries_correlationId_idx" ON "economic_entries"("correlationId");

-- CreateIndex
CREATE INDEX "activity_cost_snapshots_inventoryItemId_idx" ON "activity_cost_snapshots"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_cost_snapshots_activityId_sourceType_itemName_key" ON "activity_cost_snapshots"("activityId", "sourceType", "itemName");

-- CreateIndex
CREATE INDEX "inventory_purchases_farmId_purchaseDate_idx" ON "inventory_purchases"("farmId", "purchaseDate");

-- CreateIndex
CREATE INDEX "inventory_purchases_inventoryItemId_idx" ON "inventory_purchases"("inventoryItemId");

-- CreateIndex
CREATE INDEX "financial_expenses_farmId_expenseDate_idx" ON "financial_expenses"("farmId", "expenseDate");

-- CreateIndex
CREATE INDEX "financial_expenses_fieldSeasonId_idx" ON "financial_expenses"("fieldSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "harvest_results_activityId_key" ON "harvest_results"("activityId");

-- CreateIndex
CREATE INDEX "harvest_results_farmId_harvestDate_idx" ON "harvest_results"("farmId", "harvestDate");

-- CreateIndex
CREATE INDEX "harvest_results_fieldSeasonId_idx" ON "harvest_results"("fieldSeasonId");

-- CreateIndex
CREATE INDEX "revenue_entries_farmId_revenueDate_idx" ON "revenue_entries"("farmId", "revenueDate");

-- CreateIndex
CREATE INDEX "revenue_entries_fieldSeasonId_idx" ON "revenue_entries"("fieldSeasonId");

-- CreateIndex
CREATE INDEX "stock_movements_purchaseId_idx" ON "stock_movements"("purchaseId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "inventory_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economic_entries" ADD CONSTRAINT "economic_entries_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economic_entries" ADD CONSTRAINT "economic_entries_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economic_entries" ADD CONSTRAINT "economic_entries_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economic_entries" ADD CONSTRAINT "economic_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "economic_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_cost_snapshots" ADD CONSTRAINT "activity_cost_snapshots_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_cost_snapshots" ADD CONSTRAINT "activity_cost_snapshots_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "inventory_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_expenses" ADD CONSTRAINT "financial_expenses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_expenses" ADD CONSTRAINT "financial_expenses_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_expenses" ADD CONSTRAINT "financial_expenses_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_results" ADD CONSTRAINT "harvest_results_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_results" ADD CONSTRAINT "harvest_results_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_results" ADD CONSTRAINT "harvest_results_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_results" ADD CONSTRAINT "harvest_results_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
