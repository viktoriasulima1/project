// ─── Identifiers ──────────────────────────────────────────────────────────────
export type FarmId = string;
export type FieldId = string;
export type SeasonId = string;
export type ActivityId = string;
export type InventoryItemId = string;
export type TaskId = string;

// ─── Farm ─────────────────────────────────────────────────────────────────────
export interface Farm {
  id: FarmId;
  name: string;
  location: string;
  country: 'NL' | 'DE' | 'BE' | 'FR' | 'UK';
  totalHectares: number;
  vatNumber?: string;
  brpNumber?: string; // Dutch BRP / RVO farm registration number
}

// ─── Field ────────────────────────────────────────────────────────────────────
export type SoilType = 'clay' | 'sandy' | 'loam' | 'peat' | 'silt';
export type FieldStatus = 'healthy' | 'attention' | 'critical' | 'fallow';
export type CropName =
  | 'wheat'
  | 'potato'
  | 'onion'
  | 'sugar_beet'
  | 'barley'
  | 'corn'
  | 'rapeseed'
  | 'rye'
  | 'oat';

export interface GeoPolygon {
  coordinates: Array<[number, number]>;
}

export interface Field {
  id: FieldId;
  farmId: FarmId;
  name: string;
  hectares: number;
  soilType: SoilType;
  currentCrop?: CropName;
  previousCrop?: CropName;
  coordinates?: GeoPolygon;
  status: FieldStatus;
  ndviScore?: number; // 0–100, higher = healthier canopy
}

// ─── Season ───────────────────────────────────────────────────────────────────
export interface Season {
  id: SeasonId;
  farmId: FarmId;
  year: number;
  isActive: boolean;
  startDate: string; // ISO 8601
  endDate: string;
}

export interface Crop {
  id: string;
  fieldId: FieldId;
  seasonId: SeasonId;
  name: CropName;
  variety?: string;
  sowingDate?: string;
  harvestDate?: string;
  targetYieldTonnesPerHa: number;
  actualYieldTonnesPerHa?: number;
}

// ─── Activity ─────────────────────────────────────────────────────────────────
export type ActivityType =
  | 'spray'
  | 'fertilize'
  | 'harvest'
  | 'tillage'
  | 'sow'
  | 'irrigate'
  | 'scout'
  | 'soil_sample'
  | 'other';

export interface WeatherSnapshot {
  tempCelsius: number;
  windSpeedKmh: number;
  windDirection: string;
  humidity: number; // percent
  rainMm: number;
}

export interface Activity {
  id: ActivityId;
  fieldId: FieldId;
  seasonId: SeasonId;
  type: ActivityType;
  date: string; // ISO 8601
  operatorName: string;
  notes?: string;
  // Spray / fertilizer specific
  productId?: string;
  productName?: string;
  activeIngredient?: string;
  doseLitersPerHa?: number;
  doseKgPerHa?: number;
  areaHa?: number;
  weatherAtTime?: WeatherSnapshot;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export type InventoryCategory =
  | 'herbicide'
  | 'fungicide'
  | 'insecticide'
  | 'fertilizer'
  | 'seed'
  | 'fuel'
  | 'other';

export interface InventoryItem {
  id: InventoryItemId;
  farmId: FarmId;
  name: string;
  category: InventoryCategory;
  activeIngredient?: string;
  unit: 'L' | 'kg' | 'T' | 'bag' | 'box';
  currentStock: number;
  minimumStock: number;
  purchasePricePerUnit: number; // EUR
  expiryDate?: string; // ISO 8601
  supplierName?: string;
  registrationNumber?: string; // EU product registration (toelatingsnummer)
}

export interface StockMovement {
  id: string;
  inventoryItemId: InventoryItemId;
  activityId?: ActivityId;
  date: string;
  type: 'purchase' | 'usage' | 'adjustment' | 'disposal';
  quantity: number; // negative for usage
  pricePerUnit?: number;
}

// ─── Weather ──────────────────────────────────────────────────────────────────
export type WeatherCondition =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'frost'
  | 'fog';

// Spray window: open = conditions met, marginal = check again, closed = do not spray
export type SprayWindowStatus = 'open' | 'marginal' | 'closed';

export interface WeatherDay {
  date: string;
  tempMaxCelsius: number;
  tempMinCelsius: number;
  rainMm: number;
  windSpeedKmh: number;
  windDirection: string;
  condition: WeatherCondition;
  sprayWindow: SprayWindowStatus;
}

export interface WeatherForecast {
  location: string;
  currentTempCelsius: number;
  currentCondition: WeatherCondition;
  days: WeatherDay[]; // index 0 = today
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type NavModule =
  | 'dashboard'
  | 'fields'
  | 'activities'
  | 'inventory'
  | 'finance'
  | 'weather'
  | 'compliance'
  | 'ai';

export interface Task {
  id: TaskId;
  farmId: FarmId;
  fieldId?: FieldId;
  title: string;
  description?: string;
  type: ActivityType | 'check' | 'order' | 'report';
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string; // ISO 8601
  assignedTo?: string;
  relatedModule: NavModule;
}

// ─── Finance ──────────────────────────────────────────────────────────────────
export interface CropFinancial {
  crop: CropName;
  hectares: number;
  revenueEur: number;
  costEur: number;
  marginEur: number;
  marginPerHaEur: number;
}

export interface FinancialSnapshot {
  seasonId: SeasonId;
  costPerHectareEur: number;
  totalExpensesEur: number;
  totalRevenueEur: number;
  estimatedMarginEur: number;
  estimatedMarginPerHaEur: number;
  // Positive = under budget (good), negative = over budget
  budgetVarianceEur: number;
  cropBreakdown: CropFinancial[];
}

// ─── Compliance ───────────────────────────────────────────────────────────────
export type ComplianceStatus = 'complete' | 'missing' | 'expiring' | 'expired';
export type ComplianceModule = 'spray_diary' | 'cap' | 'certificate' | 'report';

export interface ComplianceItem {
  id: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  dueDate?: string;
  module: ComplianceModule;
}

// ─── AI Briefing ──────────────────────────────────────────────────────────────
export interface AIBriefingItem {
  id: string;
  priority: TaskPriority;
  title: string;
  explanation: string;
  relatedModule: NavModule;
  actionLabel?: string;
}

// ─── Dashboard aggregate ──────────────────────────────────────────────────────
export interface DashboardData {
  farm: Farm;
  briefing: AIBriefingItem[];
  weather: WeatherForecast;
  tasks: Task[];
  fields: Field[];
  inventoryAlerts: InventoryItem[]; // items below minimum or expiring
  finance: FinancialSnapshot;
  compliance: ComplianceItem[];
}
