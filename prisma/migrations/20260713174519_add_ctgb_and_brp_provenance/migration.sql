-- CreateEnum
CREATE TYPE "CtgbAuthorisationStatus" AS ENUM ('authorised', 'expired', 'withdrawn', 'suspended', 'unknown');

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "ctgbProductReferenceId" TEXT,
ADD COLUMN     "isManualEntry" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "field_external_provenance" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PDOK_BRPGewaspercelen',
    "externalParcelId" TEXT,
    "datasetYear" INTEGER NOT NULL,
    "importedGeometry" JSONB NOT NULL,
    "importedAreaHa" DECIMAL(7,2) NOT NULL,
    "importedCropValue" TEXT,
    "importedCropCode" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userConfirmedAt" TIMESTAMP(3),
    "geometryChecksum" TEXT NOT NULL,

    CONSTRAINT "field_external_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctgb_product_references" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "authorisationNumber" TEXT NOT NULL,
    "officialName" TEXT NOT NULL,
    "authorisationStatus" "CtgbAuthorisationStatus" NOT NULL DEFAULT 'unknown',
    "authorisationStart" DATE,
    "authorisationEnd" DATE,
    "holder" TEXT,
    "activeSubstances" JSONB,
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT,
    "rawChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctgb_product_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctgb_use_authorisations" (
    "id" TEXT NOT NULL,
    "productReferenceId" TEXT NOT NULL,
    "cropOrUseTarget" TEXT NOT NULL,
    "purpose" TEXT,
    "dosePerHaMin" DECIMAL(7,3),
    "dosePerHaMax" DECIMAL(7,3),
    "doseUnit" VARCHAR(10),
    "maxApplicationsPerSeason" SMALLINT,
    "applicationIntervalDays" SMALLINT,
    "bbchMin" SMALLINT,
    "bbchMax" SMALLINT,
    "phiDays" SMALLINT,
    "bufferZoneMetres" DECIMAL(5,1),
    "otherRestrictions" TEXT,
    "sourceDocumentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctgb_use_authorisations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_external_provenance_fieldId_key" ON "field_external_provenance"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ctgb_product_references_sourceProductId_key" ON "ctgb_product_references"("sourceProductId");

-- CreateIndex
CREATE INDEX "ctgb_product_references_authorisationNumber_idx" ON "ctgb_product_references"("authorisationNumber");

-- CreateIndex
CREATE INDEX "ctgb_use_authorisations_productReferenceId_idx" ON "ctgb_use_authorisations"("productReferenceId");

-- CreateIndex
CREATE INDEX "inventory_items_ctgbProductReferenceId_idx" ON "inventory_items"("ctgbProductReferenceId");

-- AddForeignKey
ALTER TABLE "field_external_provenance" ADD CONSTRAINT "field_external_provenance_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_ctgbProductReferenceId_fkey" FOREIGN KEY ("ctgbProductReferenceId") REFERENCES "ctgb_product_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctgb_use_authorisations" ADD CONSTRAINT "ctgb_use_authorisations_productReferenceId_fkey" FOREIGN KEY ("productReferenceId") REFERENCES "ctgb_product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;
