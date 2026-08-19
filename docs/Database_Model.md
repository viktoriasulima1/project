# FarmOS Database Model

> Sprint 1 uses in-memory mock data. This document describes the target relational schema for Sprint 2 (PostgreSQL via Prisma or Drizzle).

## Entity Relationship Summary

```
Farm
 ├─ Fields (1:N)
 │   └─ Crops (1:N per Field per Season)
 ├─ Seasons (1:N)
 ├─ Activities (1:N, linked to Field + Season)
 │   └─ StockMovements (1:N, deduct from InventoryItem)
 ├─ InventoryItems (1:N)
 │   └─ StockMovements (1:N)
 ├─ Tasks (1:N)
 ├─ ComplianceItems (1:N)
 └─ FinancialSnapshots (1:N per Season)
     └─ CropFinancials (1:N)
```

## Core Tables

### `farms`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | "Maatschap De Ridder" |
| location | text | City, province |
| country | char(2) | ISO 3166-1 alpha-2 |
| total_hectares | numeric(8,2) | |
| brp_number | text | Dutch BRP/RVO farm registration |
| vat_number | text | BTW-nummer |
| created_at | timestamptz | |

### `fields`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| farm_id | uuid FK → farms | |
| name | text | "Voorste Kamp" |
| hectares | numeric(7,2) | |
| soil_type | enum | clay, sandy, loam, peat, silt |
| status | enum | healthy, attention, critical, fallow |
| ndvi_score | smallint | 0–100, nullable |
| coordinates | jsonb | GeoJSON polygon |
| created_at | timestamptz | |

### `seasons`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| farm_id | uuid FK → farms | |
| year | smallint | |
| is_active | boolean | |
| start_date | date | |
| end_date | date | |

### `crops`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| field_id | uuid FK → fields | |
| season_id | uuid FK → seasons | |
| name | enum | wheat, potato, onion, sugar_beet, … |
| variety | text | nullable |
| sowing_date | date | nullable |
| harvest_date | date | nullable |
| target_yield_t_ha | numeric(5,2) | |
| actual_yield_t_ha | numeric(5,2) | nullable |

### `activities`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| field_id | uuid FK → fields | |
| season_id | uuid FK → seasons | |
| type | enum | spray, fertilize, harvest, tillage, sow, irrigate, scout, soil_sample, other |
| date | timestamptz | |
| operator_name | text | |
| product_id | uuid FK → inventory_items | nullable |
| dose_l_ha | numeric(7,3) | nullable |
| dose_kg_ha | numeric(7,3) | nullable |
| area_ha | numeric(7,2) | |
| weather_temp_c | numeric(4,1) | nullable |
| weather_wind_kmh | smallint | nullable |
| weather_wind_dir | char(3) | nullable |
| weather_humidity | smallint | nullable |
| weather_rain_mm | numeric(5,1) | nullable |
| notes | text | nullable |
| created_at | timestamptz | |

> **Compliance note:** The activity record is the primary source for the EU spray diary. All spray activities must include: product, active ingredient, dose, area, date, operator, and weather conditions at time of application (Directive 2009/128/EC, Art. 67).

### `inventory_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| farm_id | uuid FK → farms | |
| name | text | |
| category | enum | herbicide, fungicide, insecticide, fertilizer, seed, fuel, other |
| active_ingredient | text | nullable |
| unit | enum | L, kg, T, bag, box |
| current_stock | numeric(10,3) | |
| minimum_stock | numeric(10,3) | |
| purchase_price_per_unit | numeric(8,2) | EUR |
| expiry_date | date | nullable |
| supplier_name | text | nullable |
| registration_number | text | EU toelatingsnummer |
| updated_at | timestamptz | |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| farm_id | uuid FK → farms | |
| field_id | uuid FK → fields | nullable |
| title | text | |
| description | text | nullable |
| type | enum | spray, fertilize, harvest, tillage, sow, check, order, report, other |
| priority | enum | high, medium, low |
| status | enum | pending, in_progress, done, overdue |
| due_date | date | |
| assigned_to | text | nullable |
| related_module | enum | dashboard, fields, activities, inventory, finance, weather, compliance, ai |
| created_at | timestamptz | |

### `compliance_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| farm_id | uuid FK → farms | |
| title | text | |
| description | text | |
| status | enum | complete, missing, expiring, expired |
| due_date | date | nullable |
| module | enum | spray_diary, cap, certificate, report |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `financial_snapshots`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| season_id | uuid FK → seasons | |
| cost_per_hectare_eur | numeric(10,2) | |
| total_expenses_eur | numeric(12,2) | |
| total_revenue_eur | numeric(12,2) | |
| estimated_margin_eur | numeric(12,2) | |
| estimated_margin_per_ha_eur | numeric(10,2) | |
| budget_variance_eur | numeric(12,2) | positive = under budget |
| created_at | timestamptz | |

### `crop_financials`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| snapshot_id | uuid FK → financial_snapshots | |
| crop | enum | |
| hectares | numeric(7,2) | |
| revenue_eur | numeric(12,2) | |
| cost_eur | numeric(12,2) | |
| margin_eur | numeric(12,2) | |
| margin_per_ha_eur | numeric(10,2) | |

## Indexes (Sprint 2 planning)

```sql
-- Most common query patterns
CREATE INDEX idx_activities_field_date ON activities(field_id, date DESC);
CREATE INDEX idx_activities_season ON activities(season_id);
CREATE INDEX idx_inventory_farm_category ON inventory_items(farm_id, category);
CREATE INDEX idx_tasks_farm_status ON tasks(farm_id, status, due_date);
CREATE INDEX idx_compliance_farm_status ON compliance_items(farm_id, status);
```

## Soft delete strategy
Use `deleted_at timestamptz` on `activities` and `inventory_items` for audit trail compliance. Never hard-delete regulated records (Databankenwet).
