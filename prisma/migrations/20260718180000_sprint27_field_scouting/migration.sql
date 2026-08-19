-- CreateTable
CREATE TABLE "scouting_visits" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldSeasonId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "observerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "locationAccuracyM" DECIMAL(8,2),
    "weatherSnapshot" JSONB,
    "overallCondition" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "completedAt" TIMESTAMP(3),
    "localVisitId" TEXT,
    "idempotencyKey" TEXT,
    "submissionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scouting_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scouting_observations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "certainty" TEXT NOT NULL DEFAULT 'symptom_observed',
    "cropZone" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "affectedAreaHa" DECIMAL(8,3),
    "affectedPercent" DECIMAL(5,2),
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "recommendedFollowUp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionReason" TEXT,
    "sourceObservationId" TEXT,
    "followUpWorkOrderId" TEXT,
    "localObservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scouting_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_stage_records" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldSeasonId" TEXT NOT NULL,
    "stageSystem" TEXT NOT NULL DEFAULT 'BBCH',
    "stageCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'farmer_observed',
    "confidence" TEXT NOT NULL DEFAULT 'confirmed',
    "observerId" TEXT,
    "correctsRecordId" TEXT,
    "isEffective" BOOLEAN NOT NULL DEFAULT true,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_stage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scouting_photos" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "annotationJson" JSONB,
    "retentionUntil" TIMESTAMP(3),
    "localPhotoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scouting_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_suggestions" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "candidatesJson" JSONB NOT NULL,
    "visibleFeaturesJson" JSONB NOT NULL,
    "alternativesJson" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_review',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scouting_visits_localVisitId_key" ON "scouting_visits"("localVisitId");

-- CreateIndex
CREATE UNIQUE INDEX "scouting_visits_idempotencyKey_key" ON "scouting_visits"("idempotencyKey");

-- CreateIndex
CREATE INDEX "scouting_visits_farmId_visitDate_idx" ON "scouting_visits"("farmId", "visitDate" DESC);

-- CreateIndex
CREATE INDEX "scouting_visits_fieldSeasonId_visitDate_idx" ON "scouting_visits"("fieldSeasonId", "visitDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "scouting_observations_followUpWorkOrderId_key" ON "scouting_observations"("followUpWorkOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "scouting_observations_localObservationId_key" ON "scouting_observations"("localObservationId");

-- CreateIndex
CREATE INDEX "scouting_observations_farmId_status_severity_idx" ON "scouting_observations"("farmId", "status", "severity");

-- CreateIndex
CREATE INDEX "scouting_observations_visitId_idx" ON "scouting_observations"("visitId");

-- CreateIndex
CREATE INDEX "crop_stage_records_fieldSeasonId_isEffective_observedAt_idx" ON "crop_stage_records"("fieldSeasonId", "isEffective", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "crop_stage_records_farmId_observedAt_idx" ON "crop_stage_records"("farmId", "observedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "scouting_photos_localPhotoId_key" ON "scouting_photos"("localPhotoId");

-- CreateIndex
CREATE INDEX "scouting_photos_observationId_idx" ON "scouting_photos"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "scouting_photos_farmId_checksum_key" ON "scouting_photos"("farmId", "checksum");

-- CreateIndex
CREATE INDEX "photo_suggestions_observationId_status_idx" ON "photo_suggestions"("observationId", "status");

-- AddForeignKey
ALTER TABLE "scouting_visits" ADD CONSTRAINT "scouting_visits_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_visits" ADD CONSTRAINT "scouting_visits_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_visits" ADD CONSTRAINT "scouting_visits_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_observations" ADD CONSTRAINT "scouting_observations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_observations" ADD CONSTRAINT "scouting_observations_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "scouting_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_observations" ADD CONSTRAINT "scouting_observations_sourceObservationId_fkey" FOREIGN KEY ("sourceObservationId") REFERENCES "scouting_observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_observations" ADD CONSTRAINT "scouting_observations_followUpWorkOrderId_fkey" FOREIGN KEY ("followUpWorkOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_stage_records" ADD CONSTRAINT "crop_stage_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_stage_records" ADD CONSTRAINT "crop_stage_records_fieldSeasonId_fkey" FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_stage_records" ADD CONSTRAINT "crop_stage_records_correctsRecordId_fkey" FOREIGN KEY ("correctsRecordId") REFERENCES "crop_stage_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_photos" ADD CONSTRAINT "scouting_photos_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_photos" ADD CONSTRAINT "scouting_photos_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "scouting_observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_suggestions" ADD CONSTRAINT "photo_suggestions_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "scouting_observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_suggestions" ADD CONSTRAINT "photo_suggestions_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "scouting_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
