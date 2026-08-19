-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "overheadChoiceRecorded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overheadPolicyNote" TEXT;
