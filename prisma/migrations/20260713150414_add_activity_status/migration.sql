-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('planned', 'completed');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "status" "ActivityStatus" NOT NULL DEFAULT 'completed';
