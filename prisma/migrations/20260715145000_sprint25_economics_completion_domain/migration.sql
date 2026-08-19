CREATE TYPE "ContractorRateType" AS ENUM ('total', 'per_hectare', 'per_hour', 'per_tonne', 'per_operation');

ALTER TABLE "financial_expenses" ADD COLUMN "correctionOfId" TEXT, ADD COLUMN "correctionReason" TEXT, ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "offlineDraftId" TEXT, ADD COLUMN "submissionHash" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "harvest_results" ADD COLUMN "correctionOfId" TEXT, ADD COLUMN "correctionReason" TEXT, ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "offlineDraftId" TEXT, ADD COLUMN "submissionHash" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "inventory_purchases" ADD COLUMN "correctionReason" TEXT, ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "offlineDraftId" TEXT, ADD COLUMN "submissionHash" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "revenue_entries" ADD COLUMN "correctionOfId" TEXT, ADD COLUMN "correctionReason" TEXT, ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "offlineDraftId" TEXT, ADD COLUMN "submissionHash" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "work_order_employees" ADD COLUMN "actualHours" DECIMAL(7,2), ADD COLUMN "plannedHours" DECIMAL(7,2);

CREATE TABLE "employee_rates" (
  "id" TEXT NOT NULL, "farmId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "hourlyOperationalCost" DECIMAL(10,2) NOT NULL, "labourCostType" "LabourCostType" NOT NULL,
  "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_rates_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "machine_rates" (
  "id" TEXT NOT NULL, "farmId" TEXT NOT NULL, "machineId" TEXT NOT NULL,
  "hourlyOperationalCost" DECIMAL(10,2) NOT NULL, "fuelCostPolicy" "FuelCostPolicy" NOT NULL,
  "fuelConsumptionPerHour" DECIMAL(8,3), "contractorRate" DECIMAL(10,2),
  "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "machine_rates_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "activity_labour_cost_snapshots" (
  "id" TEXT NOT NULL, "activityId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "employeeRateId" TEXT,
  "employeeName" TEXT NOT NULL, "labourCostType" "LabourCostType" NOT NULL, "actualHours" DECIMAL(7,2) NOT NULL,
  "hourlyRate" DECIMAL(10,2), "totalCost" DECIMAL(14,2), "effectiveFrom" DATE, "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "confidence" "FinancialConfidence" NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_labour_cost_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "activity_machine_cost_snapshots" (
  "id" TEXT NOT NULL, "activityId" TEXT NOT NULL, "machineId" TEXT NOT NULL, "machineRateId" TEXT,
  "machineName" TEXT NOT NULL, "actualHours" DECIMAL(7,2) NOT NULL, "hourlyRate" DECIMAL(10,2),
  "machineCost" DECIMAL(14,2), "fuelCostPolicy" "FuelCostPolicy" NOT NULL, "fuelInventoryItemId" TEXT,
  "fuelLitres" DECIMAL(10,3), "fuelUnitCost" DECIMAL(12,4), "fuelCost" DECIMAL(14,2), "totalCost" DECIMAL(14,2),
  "effectiveFrom" DATE, "currency" CHAR(3) NOT NULL DEFAULT 'EUR', "confidence" "FinancialConfidence" NOT NULL,
  "method" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_machine_cost_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "contractor_costs" (
  "id" TEXT NOT NULL, "farmId" TEXT NOT NULL, "seasonId" TEXT NOT NULL, "fieldSeasonId" TEXT,
  "workOrderId" TEXT, "activityId" TEXT, "contractor" TEXT NOT NULL, "operation" TEXT NOT NULL,
  "costDate" DATE NOT NULL, "rateType" "ContractorRateType" NOT NULL, "quantity" DECIMAL(14,3) NOT NULL,
  "unit" TEXT NOT NULL, "rate" DECIMAL(12,4) NOT NULL, "totalAmount" DECIMAL(14,2) NOT NULL,
  "reference" TEXT, "status" "EconomicRecordStatus" NOT NULL DEFAULT 'active', "correctionOfId" TEXT,
  "correctionReason" TEXT, "version" INTEGER NOT NULL DEFAULT 1, "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "machineId" TEXT,
  CONSTRAINT "contractor_costs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "economic_allocations" (
  "id" TEXT NOT NULL, "farmId" TEXT NOT NULL, "economicEntryId" TEXT NOT NULL, "fieldSeasonId" TEXT,
  "percentage" DECIMAL(7,4) NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "originalAmount" DECIMAL(14,2) NOT NULL,
  "method" "CostAllocationMethod" NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "status" "EconomicRecordStatus" NOT NULL DEFAULT 'active', "correctionOfId" TEXT, "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "economic_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_rates_farmId_effectiveFrom_idx" ON "employee_rates"("farmId", "effectiveFrom");
CREATE UNIQUE INDEX "employee_rates_employeeId_effectiveFrom_key" ON "employee_rates"("employeeId", "effectiveFrom");
CREATE INDEX "machine_rates_farmId_effectiveFrom_idx" ON "machine_rates"("farmId", "effectiveFrom");
CREATE UNIQUE INDEX "machine_rates_machineId_effectiveFrom_key" ON "machine_rates"("machineId", "effectiveFrom");
CREATE INDEX "activity_labour_cost_snapshots_employeeId_idx" ON "activity_labour_cost_snapshots"("employeeId");
CREATE UNIQUE INDEX "activity_labour_cost_snapshots_activityId_employeeId_key" ON "activity_labour_cost_snapshots"("activityId", "employeeId");
CREATE UNIQUE INDEX "activity_machine_cost_snapshots_activityId_key" ON "activity_machine_cost_snapshots"("activityId");
CREATE INDEX "activity_machine_cost_snapshots_machineId_idx" ON "activity_machine_cost_snapshots"("machineId");
CREATE INDEX "contractor_costs_farmId_costDate_idx" ON "contractor_costs"("farmId", "costDate");
CREATE UNIQUE INDEX "contractor_costs_activityId_status_key" ON "contractor_costs"("activityId", "status");
CREATE INDEX "economic_allocations_farmId_status_idx" ON "economic_allocations"("farmId", "status");
CREATE INDEX "economic_allocations_economicEntryId_idx" ON "economic_allocations"("economicEntryId");
CREATE UNIQUE INDEX "financial_expenses_offlineDraftId_key" ON "financial_expenses"("offlineDraftId");
CREATE UNIQUE INDEX "financial_expenses_idempotencyKey_key" ON "financial_expenses"("idempotencyKey");
CREATE UNIQUE INDEX "harvest_results_offlineDraftId_key" ON "harvest_results"("offlineDraftId");
CREATE UNIQUE INDEX "harvest_results_idempotencyKey_key" ON "harvest_results"("idempotencyKey");
CREATE UNIQUE INDEX "inventory_purchases_offlineDraftId_key" ON "inventory_purchases"("offlineDraftId");
CREATE UNIQUE INDEX "inventory_purchases_idempotencyKey_key" ON "inventory_purchases"("idempotencyKey");
CREATE UNIQUE INDEX "inventory_purchases_farmId_invoiceReference_key" ON "inventory_purchases"("farmId", "invoiceReference");
CREATE UNIQUE INDEX "revenue_entries_offlineDraftId_key" ON "revenue_entries"("offlineDraftId");
CREATE UNIQUE INDEX "revenue_entries_idempotencyKey_key" ON "revenue_entries"("idempotencyKey");

ALTER TABLE "employee_rates" ADD CONSTRAINT "employee_rates_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_rates" ADD CONSTRAINT "employee_rates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_rates" ADD CONSTRAINT "machine_rates_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_rates" ADD CONSTRAINT "machine_rates_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_labour_cost_snapshots" ADD CONSTRAINT "activity_labour_cost_snapshots_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_labour_cost_snapshots" ADD CONSTRAINT "activity_labour_cost_snapshots_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_labour_cost_snapshots" ADD CONSTRAINT "activity_labour_cost_snapshots_employeeRateId_fkey" FOREIGN KEY ("employeeRateId") REFERENCES "employee_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_machine_cost_snapshots" ADD CONSTRAINT "activity_machine_cost_snapshots_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_machine_cost_snapshots" ADD CONSTRAINT "activity_machine_cost_snapshots_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_machine_cost_snapshots" ADD CONSTRAINT "activity_machine_cost_snapshots_machineRateId_fkey" FOREIGN KEY ("machineRateId") REFERENCES "machine_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_machine_cost_snapshots" ADD CONSTRAINT "activity_machine_cost_snapshots_fuelInventoryItemId_fkey" FOREIGN KEY ("fuelInventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "contractor_costs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contractor_costs" ADD CONSTRAINT "contractor_costs_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "economic_allocations" ADD CONSTRAINT "economic_allocations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "economic_allocations" ADD CONSTRAINT "economic_allocations_economicEntryId_fkey" FOREIGN KEY ("economicEntryId") REFERENCES "economic_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "economic_allocations" ADD CONSTRAINT "economic_allocations_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "economic_allocations" ADD CONSTRAINT "economic_allocations_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "economic_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_expenses" ADD CONSTRAINT "financial_expenses_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "financial_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "harvest_results" ADD CONSTRAINT "harvest_results_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "harvest_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "revenue_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
