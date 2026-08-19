-- CreateTable
CREATE TABLE "photo_annotation_versions" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "annotationsJson" JSONB NOT NULL,
    "correctionReason" TEXT,
    "actorUserId" TEXT,
    "isEffective" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_annotation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_annotation_versions_farmId_createdAt_idx" ON "photo_annotation_versions"("farmId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "photo_annotation_versions_photoId_version_key" ON "photo_annotation_versions"("photoId", "version");

-- AddForeignKey
ALTER TABLE "photo_annotation_versions" ADD CONSTRAINT "photo_annotation_versions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_annotation_versions" ADD CONSTRAINT "photo_annotation_versions_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "scouting_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
