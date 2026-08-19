-- FarmOS Sprint 5 — Schema additions
-- Adds: brpParcelNumber to fields, N/P/K% to inventory_items,
--       certNumber + certExpiry to employees

ALTER TABLE "fields"
  ADD COLUMN IF NOT EXISTS "brpParcelNumber" VARCHAR(20);

ALTER TABLE "inventory_items"
  ADD COLUMN IF NOT EXISTS "nitrogenPercent"   DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "phosphorusPercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "potassiumPercent"  DECIMAL(5,2);

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "certNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "certExpiry" DATE;
