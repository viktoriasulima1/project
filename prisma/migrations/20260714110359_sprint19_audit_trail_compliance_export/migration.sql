-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('farmer', 'system', 'api');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('created', 'planned', 'completed', 'corrected', 'reversed', 'archived', 'restored', 'exported', 'verification_status_changed', 'inventory_adjusted', 'compliance_snapshot_created');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('web', 'mobile_web', 'quick_log', 'onboarding', 'import', 'system', 'api', 'e2e_test');

-- CreateEnum
CREATE TYPE "ComplianceExportFormat" AS ENUM ('pdf', 'csv');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "bbchStage" SMALLINT,
ADD COLUMN     "correctionDiff" JSONB,
ADD COLUMN     "correctionOfId" TEXT,
ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "isReversal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rootActivityId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "correlationId" TEXT;

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'farmer',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "AuditSource" NOT NULL,
    "previousVersionId" TEXT,
    "correlationId" TEXT NOT NULL,
    "reason" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_exports" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "format" "ComplianceExportFormat" NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" TEXT NOT NULL,
    "storageReference" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_farmId_idx" ON "audit_events"("farmId");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_correlationId_idx" ON "audit_events"("correlationId");

-- CreateIndex
CREATE INDEX "audit_events_occurredAt_idx" ON "audit_events"("occurredAt");

-- CreateIndex
CREATE INDEX "compliance_exports_farmId_idx" ON "compliance_exports"("farmId");

-- CreateIndex
CREATE INDEX "activities_correctionOfId_idx" ON "activities"("correctionOfId");

-- CreateIndex
CREATE INDEX "activities_rootActivityId_idx" ON "activities"("rootActivityId");

-- CreateIndex
CREATE INDEX "stock_movements_correlationId_idx" ON "stock_movements"("correlationId");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_exports" ADD CONSTRAINT "compliance_exports_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sprint 19 Part 2 — "audit events are append-only" enforced at the database
-- level, not only by application code never calling .update()/.delete().
-- This is defense in depth: even a future bug, a direct psql session, or a
-- new script that forgets this rule cannot silently rewrite or remove audit
-- history. See docs/AUDIT_TRAIL_ARCHITECTURE.md.
--
-- UPDATE is unconditionally blocked — nothing legitimate ever updates an
-- audit event. DELETE has one narrow, explicit escape hatch: whole-farm
-- teardown (Farm has ON DELETE CASCADE onto audit_events) needs to be able
-- to remove a farm's audit history along with everything else — e.g. this
-- project's own E2E database reset helpers, or a future real
-- account-deletion/GDPR flow. That path must SET LOCAL
-- app.allow_audit_hard_delete = 'true' inside the SAME transaction as the
-- delete — normal application code never sets this, so a normal request
-- can never delete an audit event.
CREATE OR REPLACE FUNCTION audit_events_no_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: UPDATE is not permitted';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_events_guarded_delete() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_audit_hard_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_events is append-only: DELETE is not permitted (requires app.allow_audit_hard_delete=true for whole-farm teardown only)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION audit_events_no_update();

CREATE TRIGGER audit_events_guarded_delete
BEFORE DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION audit_events_guarded_delete();
