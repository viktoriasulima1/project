-- CreateTable
CREATE TABLE "field_ndvi_readings" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "meanNdvi" DECIMAL(5,3),
    "sampleCount" INTEGER NOT NULL,
    "cloudCoveragePct" DECIMAL(4,1),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_ndvi_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_ndvi_readings_fieldId_periodFrom_idx" ON "field_ndvi_readings"("fieldId", "periodFrom");

-- CreateIndex
CREATE UNIQUE INDEX "field_ndvi_readings_fieldId_periodFrom_key" ON "field_ndvi_readings"("fieldId", "periodFrom");

-- AddForeignKey
ALTER TABLE "field_ndvi_readings" ADD CONSTRAINT "field_ndvi_readings_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
