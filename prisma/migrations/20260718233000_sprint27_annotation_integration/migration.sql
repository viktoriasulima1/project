ALTER TABLE "photo_annotation_versions"
ADD COLUMN "previousVersionId" TEXT;

ALTER TABLE "photo_annotation_versions"
ADD CONSTRAINT "photo_annotation_versions_previousVersionId_fkey"
FOREIGN KEY ("previousVersionId") REFERENCES "photo_annotation_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "photo_annotation_versions_previousVersionId_idx"
ON "photo_annotation_versions"("previousVersionId");

CREATE UNIQUE INDEX "photo_annotation_versions_one_effective_per_photo"
ON "photo_annotation_versions"("photoId") WHERE "isEffective" = true;

ALTER TABLE "photo_suggestions"
ADD COLUMN "contextChecksum" TEXT,
ADD COLUMN "derivedChecksum" TEXT,
ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT 'photo-suggestion-v1',
ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "cannotDetermine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "farmerAction" TEXT,
ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
