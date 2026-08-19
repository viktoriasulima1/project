-- FarmOS Sprint 4 — Initial migration
-- Creates all tables, indexes, constraints, and partial unique index
-- for one active season per farm.
--
-- Apply with: npx prisma migrate deploy

-- ─── Enumerations ─────────────────────────────────────────────────────────────

CREATE TYPE "SoilType" AS ENUM ('clay', 'sandy', 'loam', 'peat', 'silt');
CREATE TYPE "FieldStatus" AS ENUM ('healthy', 'attention', 'critical', 'fallow');
CREATE TYPE "CropName" AS ENUM ('wheat', 'potato', 'onion', 'sugar_beet', 'barley', 'oilseed_rape', 'cover_crop', 'grass', 'other');
CREATE TYPE "ActivityType" AS ENUM ('spray', 'fertilise', 'harvest', 'tillage', 'sow', 'irrigate', 'scout', 'soil_sample', 'other');
CREATE TYPE "InventoryCategory" AS ENUM ('herbicide', 'fungicide', 'insecticide', 'fertiliser', 'seed', 'fuel', 'other');
CREATE TYPE "InventoryUnit" AS ENUM ('L', 'kg', 'T', 'bag', 'box');
CREATE TYPE "TaskType" AS ENUM ('spray', 'fertilise', 'harvest', 'tillage', 'sow', 'check', 'order', 'report', 'other');
CREATE TYPE "TaskPriority" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'done', 'overdue');
CREATE TYPE "ComplianceStatus" AS ENUM ('complete', 'missing', 'expiring', 'expired');
CREATE TYPE "ComplianceModule" AS ENUM ('spray_diary', 'cap', 'certificate', 'report');
CREATE TYPE "MachineType" AS ENUM ('tractor', 'sprayer', 'combine', 'drill', 'cultivator', 'loader', 'trailer', 'other');
CREATE TYPE "StockDirection" AS ENUM ('in', 'out', 'correction');

-- ─── farms ────────────────────────────────────────────────────────────────────

CREATE TABLE "farms" (
    "id"            TEXT         NOT NULL,
    "clerkUserId"   TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "location"      TEXT         NOT NULL,
    "country"       CHAR(2)      NOT NULL DEFAULT 'NL',
    "totalHectares" DECIMAL(8,2) NOT NULL,
    "brpNumber"     TEXT,
    "vatNumber"     TEXT,
    "latitude"      DECIMAL(9,6),
    "longitude"     DECIMAL(9,6),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "farms_clerkUserId_key" ON "farms"("clerkUserId");

-- ─── seasons ──────────────────────────────────────────────────────────────────

CREATE TABLE "seasons" (
    "id"        TEXT         NOT NULL,
    "farmId"    TEXT         NOT NULL,
    "year"      INTEGER      NOT NULL,
    "isActive"  BOOLEAN      NOT NULL DEFAULT false,
    "startDate" DATE         NOT NULL,
    "endDate"   DATE         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seasons_farmId_year_key" ON "seasons"("farmId", "year");
-- Enforces at most one active season per farm at the database level
CREATE UNIQUE INDEX "seasons_one_active_per_farm" ON "seasons"("farmId") WHERE "isActive" = true;

-- ─── fields ───────────────────────────────────────────────────────────────────

CREATE TABLE "fields" (
    "id"          TEXT         NOT NULL,
    "farmId"      TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "hectares"    DECIMAL(7,2) NOT NULL,
    "soilType"    "SoilType"   NOT NULL DEFAULT 'loam',
    "status"      "FieldStatus" NOT NULL DEFAULT 'healthy',
    "ndviScore"   SMALLINT,
    "coordinates" JSONB,
    "deletedAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fields_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fields_hectares_positive" CHECK ("hectares" > 0)
);
CREATE INDEX "fields_farmId_idx" ON "fields"("farmId");
CREATE INDEX "fields_deletedAt_idx" ON "fields"("deletedAt");

-- ─── machines (before activities — FK dependency) ─────────────────────────────

CREATE TABLE "machines" (
    "id"                  TEXT          NOT NULL,
    "farmId"              TEXT          NOT NULL,
    "name"                TEXT          NOT NULL,
    "type"                "MachineType" NOT NULL,
    "make"                TEXT,
    "model"               TEXT,
    "year"                SMALLINT,
    "hoursSinceService"   INTEGER,
    "nextServiceDueHours" INTEGER,
    "isCertified"         BOOLEAN       NOT NULL DEFAULT true,
    "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "machines_farmId_idx" ON "machines"("farmId");

-- ─── inventory_items ──────────────────────────────────────────────────────────

CREATE TABLE "inventory_items" (
    "id"                   TEXT                NOT NULL,
    "farmId"               TEXT                NOT NULL,
    "name"                 TEXT                NOT NULL,
    "category"             "InventoryCategory" NOT NULL,
    "activeIngredient"     TEXT,
    "unit"                 "InventoryUnit"     NOT NULL,
    "currentStock"         DECIMAL(10,3)       NOT NULL,
    "minimumStock"         DECIMAL(10,3)       NOT NULL DEFAULT 0,
    "purchasePricePerUnit" DECIMAL(8,2),
    "expiryDate"           DATE,
    "supplierName"         TEXT,
    "registrationNumber"   TEXT,
    "fracCode"             TEXT,
    "hracCode"             TEXT,
    "phiDays"              SMALLINT,
    "createdAt"            TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
    -- Prevents stock going negative at database level
    CONSTRAINT "inventory_items_stock_non_negative" CHECK ("currentStock" >= 0)
);
CREATE INDEX "inventory_items_farmId_idx" ON "inventory_items"("farmId");

-- ─── field_seasons ────────────────────────────────────────────────────────────

CREATE TABLE "field_seasons" (
    "id"              TEXT         NOT NULL,
    "fieldId"         TEXT         NOT NULL,
    "seasonId"        TEXT         NOT NULL,
    "crop"            "CropName"   NOT NULL,
    "variety"         TEXT,
    "sowingDate"      DATE,
    "harvestDate"     DATE,
    "targetYieldTHa"  DECIMAL(5,2),
    "actualYieldTHa"  DECIMAL(5,2),
    "bbchStage"       SMALLINT,
    "diseaseRiskScore" SMALLINT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "field_seasons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "field_seasons_fieldId_seasonId_key" ON "field_seasons"("fieldId", "seasonId");
CREATE INDEX "field_seasons_fieldId_idx" ON "field_seasons"("fieldId");
CREATE INDEX "field_seasons_seasonId_idx" ON "field_seasons"("seasonId");

-- ─── activities ───────────────────────────────────────────────────────────────

CREATE TABLE "activities" (
    "id"                TEXT           NOT NULL,
    "fieldSeasonId"     TEXT           NOT NULL,
    "type"              "ActivityType" NOT NULL,
    "date"              TIMESTAMP(3)   NOT NULL,
    "operatorName"      TEXT           NOT NULL,
    -- Dutch RVO / EU Directive 2009/128/EC compliance fields
    "certificateNumber" VARCHAR(50),
    "waterVolumePerHa"  DECIMAL(7,1),
    "nozzleType"        VARCHAR(50),
    "machineId"         TEXT,
    -- Product application
    "productId"         TEXT,
    "dosePerHa"         DECIMAL(7,3),
    "doseUnit"          VARCHAR(5),
    "areaHa"            DECIMAL(7,2)   NOT NULL,
    -- Weather conditions at spray time
    "weatherTempC"      DECIMAL(4,1),
    "weatherWindKmh"    SMALLINT,
    "weatherWindDir"    VARCHAR(3),
    "weatherHumidity"   SMALLINT,
    "weatherRainMm"     DECIMAL(5,1),
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"         TIMESTAMP(3),
    CONSTRAINT "activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activities_areaHa_positive" CHECK ("areaHa" > 0),
    CONSTRAINT "activities_humidity_range" CHECK ("weatherHumidity" IS NULL OR ("weatherHumidity" >= 0 AND "weatherHumidity" <= 100)),
    CONSTRAINT "activities_wind_non_negative" CHECK ("weatherWindKmh" IS NULL OR "weatherWindKmh" >= 0)
);
CREATE INDEX "activities_fieldSeasonId_idx" ON "activities"("fieldSeasonId");
CREATE INDEX "activities_date_idx" ON "activities"("date" DESC);
CREATE INDEX "activities_deletedAt_idx" ON "activities"("deletedAt");
CREATE INDEX "activities_machineId_idx" ON "activities"("machineId");

-- ─── stock_movements ──────────────────────────────────────────────────────────

CREATE TABLE "stock_movements" (
    "id"              TEXT             NOT NULL,
    "inventoryItemId" TEXT             NOT NULL,
    "activityId"      TEXT,
    "quantity"        DECIMAL(10,3)    NOT NULL,
    "direction"       "StockDirection" NOT NULL,
    "unitCost"        DECIMAL(8,2),
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_movements_quantity_positive" CHECK ("quantity" > 0)
);
CREATE INDEX "stock_movements_inventoryItemId_idx" ON "stock_movements"("inventoryItemId");
CREATE INDEX "stock_movements_activityId_idx" ON "stock_movements"("activityId");

-- ─── tasks ────────────────────────────────────────────────────────────────────

CREATE TABLE "tasks" (
    "id"             TEXT          NOT NULL,
    "fieldSeasonId"  TEXT,
    "farmId"         TEXT,
    "title"          TEXT          NOT NULL,
    "description"    TEXT,
    "type"           "TaskType"    NOT NULL,
    "priority"       "TaskPriority" NOT NULL DEFAULT 'medium',
    "status"         "TaskStatus"  NOT NULL DEFAULT 'pending',
    "dueDate"        DATE          NOT NULL,
    "assignedTo"     TEXT,
    "estimatedHours" DECIMAL(4,1),
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tasks_farmId_idx" ON "tasks"("farmId");
CREATE INDEX "tasks_fieldSeasonId_idx" ON "tasks"("fieldSeasonId");

-- ─── compliance_items ─────────────────────────────────────────────────────────

CREATE TABLE "compliance_items" (
    "id"          TEXT               NOT NULL,
    "farmId"      TEXT               NOT NULL,
    "title"       TEXT               NOT NULL,
    "description" TEXT               NOT NULL,
    "status"      "ComplianceStatus" NOT NULL DEFAULT 'missing',
    "dueDate"     DATE,
    "module"      "ComplianceModule" NOT NULL,
    "createdAt"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)       NOT NULL,
    CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "compliance_items_farmId_idx" ON "compliance_items"("farmId");

-- ─── compliance_records ───────────────────────────────────────────────────────
-- RESTRICT prevents cascade-deleting regulatory records when an activity is deleted.
-- Activities must be soft-deleted (deletedAt) — never hard-deleted.

CREATE TABLE "compliance_records" (
    "id"          TEXT         NOT NULL,
    "activityId"  TEXT         NOT NULL,
    "framework"   TEXT         NOT NULL,
    "data"        JSONB        NOT NULL,
    "confirmed"   BOOLEAN      NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "compliance_records_activityId_idx" ON "compliance_records"("activityId");

-- ─── financial_snapshots + crop_financials ────────────────────────────────────

CREATE TABLE "financial_snapshots" (
    "id"                      TEXT          NOT NULL,
    "seasonId"                TEXT          NOT NULL,
    "costPerHectareEur"       DECIMAL(10,2) NOT NULL,
    "totalExpensesEur"        DECIMAL(12,2) NOT NULL,
    "totalRevenueEur"         DECIMAL(12,2) NOT NULL,
    "estimatedMarginEur"      DECIMAL(12,2) NOT NULL,
    "estimatedMarginPerHaEur" DECIMAL(10,2) NOT NULL,
    "budgetVarianceEur"       DECIMAL(12,2) NOT NULL,
    "createdAt"               TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crop_financials" (
    "id"             TEXT          NOT NULL,
    "snapshotId"     TEXT          NOT NULL,
    "crop"           "CropName"    NOT NULL,
    "hectares"       DECIMAL(7,2)  NOT NULL,
    "revenueEur"     DECIMAL(12,2) NOT NULL,
    "costEur"        DECIMAL(12,2) NOT NULL,
    "marginEur"      DECIMAL(12,2) NOT NULL,
    "marginPerHaEur" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "crop_financials_pkey" PRIMARY KEY ("id")
);

-- ─── employees ────────────────────────────────────────────────────────────────

CREATE TABLE "employees" (
    "id"          TEXT         NOT NULL,
    "farmId"      TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "role"        TEXT,
    "hasSpraying" BOOLEAN      NOT NULL DEFAULT false,
    "isActive"    BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employees_farmId_idx" ON "employees"("farmId");

-- ─── soil_analyses ────────────────────────────────────────────────────────────

CREATE TABLE "soil_analyses" (
    "id"               TEXT         NOT NULL,
    "fieldId"          TEXT         NOT NULL,
    "analysisDate"     DATE         NOT NULL,
    "phLevel"          DECIMAL(3,1),
    "pIndex"           SMALLINT,
    "kIndex"           SMALLINT,
    "mgIndex"          SMALLINT,
    "organicMatterPct" DECIMAL(4,2),
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "soil_analyses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "soil_analyses_fieldId_idx" ON "soil_analyses"("fieldId");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "seasons"
    ADD CONSTRAINT "seasons_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fields"
    ADD CONSTRAINT "fields_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "field_seasons"
    ADD CONSTRAINT "field_seasons_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "field_seasons"
    ADD CONSTRAINT "field_seasons_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "machines"
    ADD CONSTRAINT "machines_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_items"
    ADD CONSTRAINT "inventory_items_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activities"
    ADD CONSTRAINT "activities_fieldSeasonId_fkey"
    FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activities"
    ADD CONSTRAINT "activities_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activities"
    ADD CONSTRAINT "activities_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_fieldSeasonId_fkey"
    FOREIGN KEY ("fieldSeasonId") REFERENCES "field_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compliance_items"
    ADD CONSTRAINT "compliance_items_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT: cannot hard-delete an Activity that has compliance records.
-- Protects EU Directive 2009/128/EC 3-year retention requirement.
ALTER TABLE "compliance_records"
    ADD CONSTRAINT "compliance_records_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_snapshots"
    ADD CONSTRAINT "financial_snapshots_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crop_financials"
    ADD CONSTRAINT "crop_financials_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "financial_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "soil_analyses"
    ADD CONSTRAINT "soil_analyses_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
