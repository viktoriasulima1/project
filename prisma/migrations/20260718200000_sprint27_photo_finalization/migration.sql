-- AlterTable
ALTER TABLE "scouting_photos" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "originalPhotoId" TEXT,
ADD COLUMN     "uploadStatus" TEXT NOT NULL DEFAULT 'temporary',
ADD COLUMN     "width" INTEGER;

-- AddForeignKey
ALTER TABLE "scouting_photos" ADD CONSTRAINT "scouting_photos_originalPhotoId_fkey" FOREIGN KEY ("originalPhotoId") REFERENCES "scouting_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
