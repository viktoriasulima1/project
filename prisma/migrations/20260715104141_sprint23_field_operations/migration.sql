-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('soil_preparation', 'sow', 'fertilise', 'spray', 'irrigate', 'scout', 'tillage', 'harvest', 'custom');

-- CreateEnum
CREATE TYPE "SeasonPlanStatus" AS ENUM ('draft', 'planned', 'converted', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('draft', 'ready', 'assigned', 'in_progress', 'blocked', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'released', 'consumed');

-- CreateTable
CREATE TABLE "operation_templates" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "defaultDurationHours" DECIMAL(6,2),
    "defaultInstructions" TEXT,
    "defaultChecklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_plan_items" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldSeasonId" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "title" TEXT NOT NULL,
    "windowStart" DATE NOT NULL,
    "windowEnd" DATE NOT NULL,
    "expectedAreaHa" DECIMAL(7,2),
    "expectedProductId" TEXT,
    "expectedQuantity" DECIMAL(10,3),
    "expectedCostEur" DECIMAL(10,2),
    "reason" TEXT,
    "dependencyId" TEXT,
    "status" "SeasonPlanStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seasonId" TEXT,

    CONSTRAINT "season_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldSeasonId" TEXT NOT NULL,
    "sourcePlanItemId" TEXT,
    "completedActivityId" TEXT,
    "operationType" "OperationType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'draft',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'medium',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "estimatedHours" DECIMAL(6,2),
    "machineId" TEXT,
    "instructions" TEXT,
    "checklist" JSONB,
    "blockerReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_employees" (
    "workOrderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_employees_pkey" PRIMARY KEY ("workOrderId","employeeId")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_templates_farmId_idx" ON "operation_templates"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "operation_templates_farmId_name_key" ON "operation_templates"("farmId", "name");

-- CreateIndex
CREATE INDEX "season_plan_items_farmId_windowStart_idx" ON "season_plan_items"("farmId", "windowStart");

-- CreateIndex
CREATE INDEX "season_plan_items_fieldSeasonId_idx" ON "season_plan_items"("fieldSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_completedActivityId_key" ON "work_orders"("completedActivityId");

-- CreateIndex
CREATE INDEX "work_orders_farmId_status_dueDate_idx" ON "work_orders"("farmId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "work_orders_fieldSeasonId_idx" ON "work_orders"("fieldSeasonId");

-- CreateIndex
CREATE INDEX "work_orders_sourcePlanItemId_idx" ON "work_orders"("sourcePlanItemId");

-- CreateIndex
CREATE INDEX "work_order_employees_employeeId_idx" ON "work_order_employees"("employeeId");

-- CreateIndex
CREATE INDEX "inventory_reservations_farmId_status_idx" ON "inventory_reservations"("farmId", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_inventoryItemId_status_idx" ON "inventory_reservations"("inventoryItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_workOrderId_inventoryItemId_key" ON "inventory_reservations"("workOrderId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "operation_templates" ADD CONSTRAINT "operation_templates_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_plan_items" ADD CONSTRAINT "season_plan_items_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_plan_items" ADD CONSTRAINT "season_plan_items_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_plan_items" ADD CONSTRAINT "season_plan_items_expectedProductId_fkey" FOREIGN KEY ("expectedProductId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_plan_items" ADD CONSTRAINT "season_plan_items_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "season_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_plan_items" ADD CONSTRAINT "season_plan_items_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_sourcePlanItemId_fkey" FOREIGN KEY ("sourcePlanItemId") REFERENCES "season_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_completedActivityId_fkey" FOREIGN KEY ("completedActivityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_employees" ADD CONSTRAINT "work_order_employees_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_employees" ADD CONSTRAINT "work_order_employees_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
