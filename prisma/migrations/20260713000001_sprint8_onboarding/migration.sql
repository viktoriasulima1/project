-- FarmOS Sprint 8 — Onboarding wizard schema additions

CREATE TYPE "FarmType" AS ENUM ('arable', 'dairy', 'livestock', 'horticulture', 'mixed');

ALTER TABLE "farms"
  ADD COLUMN IF NOT EXISTS "legalName"  TEXT,
  ADD COLUMN IF NOT EXISTS "city"       TEXT,
  ADD COLUMN IF NOT EXISTS "province"   TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "farmType"   "FarmType" NOT NULL DEFAULT 'arable',
  ADD COLUMN IF NOT EXISTS "timezone"   TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  ADD COLUMN IF NOT EXISTS "currency"   CHAR(3) NOT NULL DEFAULT 'EUR';

ALTER TABLE "farms"
  ALTER COLUMN "totalHectares" DROP NOT NULL;

ALTER TABLE "seasons"
  ADD COLUMN IF NOT EXISTS "name" TEXT;
