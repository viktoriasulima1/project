-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'allocation_created';
ALTER TYPE "AuditAction" ADD VALUE 'allocation_changed';
ALTER TYPE "AuditAction" ADD VALUE 'allocation_reversed';

-- AlterEnum
ALTER TYPE "CostAllocationMethod" ADD VALUE 'selected_fields';

-- AlterTable
ALTER TABLE "economic_allocations" ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "sourceRecordVersion" INTEGER,
ADD COLUMN     "submissionHash" TEXT;

-- CreateIndex
CREATE INDEX "economic_allocations_farmId_idempotencyKey_idx" ON "economic_allocations"("farmId", "idempotencyKey");
