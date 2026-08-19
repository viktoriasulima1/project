-- CreateTable
CREATE TABLE "nutrient_norm_references" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "crop" "CropName" NOT NULL,
    "nitrogenNormKgPerHa" DECIMAL(6,1),
    "phosphateNormKgPerHa" DECIMAL(6,1),
    "source" TEXT,
    "verifiedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrient_norm_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutrient_norm_references_farmId_crop_key" ON "nutrient_norm_references"("farmId", "crop");

-- AddForeignKey
ALTER TABLE "nutrient_norm_references" ADD CONSTRAINT "nutrient_norm_references_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
