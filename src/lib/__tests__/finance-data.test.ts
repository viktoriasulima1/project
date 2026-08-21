import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockDb }=vi.hoisted(()=>({mockDb:{season:{findFirst:vi.fn()},fieldSeason:{findMany:vi.fn()},economicEntry:{findMany:vi.fn()},inventoryPurchase:{findMany:vi.fn()},financialExpense:{findMany:vi.fn()},revenueEntry:{findMany:vi.fn()}}}));
vi.mock('@/lib/db',()=>({db:mockDb}));vi.mock('../db',()=>({db:mockDb}));
import { getFinanceData } from '../finance-data';
const FARM={id:'farm-1',currency:'EUR',overheadChoiceRecorded:true} as never;
const fs=()=>({id:'fs-1',fieldId:'field-1',crop:'wheat',field:{id:'field-1',name:'North',hectares:'10'},activities:[{actualHours:null,machineHours:null,costSnapshots:[{itemName:'Input',unitCost:'5'}]}],harvestResults:[{id:'h1',harvestDate:new Date('2026-08-01'),unit:'tonnes',saleableQuantity:'20',grossQuantity:'20',status:'active',version:1}],seasonPlanItems:[]});
const cost=()=>({id:'e1',fieldSeasonId:'fs-1',fieldId:'field-1',kind:'cost',sourceType:'inventory_input',amount:'500',quantity:'100',unit:'kg',unitCost:'5',allocationMethod:'direct_field',confidence:'recorded',costDate:new Date('2026-06-01')});
const revenue=()=>({id:'e2',fieldSeasonId:'fs-1',fieldId:'field-1',kind:'revenue',sourceType:'crop_sale',amount:'1000',quantity:'20',unit:'tonnes',unitCost:'50',allocationMethod:'direct_field',confidence:'recorded',costDate:new Date('2026-07-01')});
describe('getFinanceData Sprint 24',()=>{beforeEach(()=>{vi.clearAllMocks();mockDb.season.findFirst.mockResolvedValue({id:'s1',year:2026});mockDb.fieldSeason.findMany.mockResolvedValue([fs()]);mockDb.economicEntry.findMany.mockResolvedValue([cost(),revenue()]);mockDb.inventoryPurchase.findMany.mockResolvedValue([]);mockDb.financialExpense.findMany.mockResolvedValue([]);mockDb.revenueEntry.findMany.mockResolvedValue([]);});
it('uses normalized historical economic entries',async()=>{const r=await getFinanceData(FARM);expect(r.totalRecordedCostEur).toBe(500);expect(r.fields[0].costPerHaEur).toBe(50)});
it('calculates recorded gross margin, never net profit',async()=>{const r=await getFinanceData(FARM);expect(r.grossMarginEur).toBe(500);expect(JSON.stringify(r).toLowerCase()).not.toContain('netprofit')});
it('calculates cost per harvested unit',async()=>expect((await getFinanceData(FARM)).fields[0].costPerYieldUnit).toBe(25));
it('does not treat a missing activity price as zero',async()=>{mockDb.fieldSeason.findMany.mockResolvedValue([{...fs(),activities:[{actualHours:null,machineHours:null,costSnapshots:[{itemName:'Unknown',unitCost:null}]}]}]);mockDb.economicEntry.findMany.mockResolvedValue([revenue()]);const r=await getFinanceData(FARM);expect(r.totalRecordedCostEur).toBeNull();expect(r.missingPriceProducts).toContain('Unknown')});
it('keeps revenue not recorded when no received entry exists',async()=>{mockDb.economicEntry.findMany.mockResolvedValue([cost()]);const r=await getFinanceData(FARM);expect(r.totalRecordedRevenueEur).toBeNull();expect(r.grossMarginEur).toBeNull()});
it('scopes every query to the active farm season',async()=>{await getFinanceData(FARM);expect(mockDb.season.findFirst.mock.calls[0][0].where.farmId).toBe('farm-1');expect(mockDb.economicEntry.findMany.mock.calls[0][0].where.farmId).toBe('farm-1')});
// Harvest results have no correction/reversal UI unless they appear here —
// FinancialRecordActions on the Finance page reads recentEntries directly,
// and a harvest result was never included in it before this.
it('includes harvest results in recentEntries so they can be corrected/reversed like any other record',async()=>{const r=await getFinanceData(FARM);const harvestEntry=r.recentEntries.find(e=>e.recordType==='harvest');expect(harvestEntry).toMatchObject({id:'h1',recordType:'harvest',kind:'harvest',grossQuantity:20,saleableQuantity:20,unit:'tonnes',status:'active',version:1})});
});
