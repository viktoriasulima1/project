ALTER TYPE "AuditSource" ADD VALUE IF NOT EXISTS 'offline_sync';

ALTER TABLE "activities"
  ADD COLUMN "offlineDraftId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "submissionHash" TEXT,
  ADD COLUMN "syncCorrelationId" TEXT;

CREATE UNIQUE INDEX "activities_offlineDraftId_key" ON "activities"("offlineDraftId");
CREATE UNIQUE INDEX "activities_idempotencyKey_key" ON "activities"("idempotencyKey");
