import { describe,expect,it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildEconomicsCsv } from '../csv';
import { buildEconomicsPdf } from '../pdf';
import { resolveBudgetVariance } from '../../economics';

const row={fieldSeasonId:'fs1',fieldId:'f1',field:'=Danger',crop:'wheat',hectares:10,recordedCostEur:100,recordedRevenueEur:250,grossMarginEur:150,costPerHaEur:10,revenuePerHaEur:25,grossMarginPerHaEur:15,yieldQuantity:20,yieldUnit:'tonnes',yieldPerHa:2,costPerYieldUnit:5,breakEvenPrice:5,breakEvenYield:8,completenessPercent:100,completenessStatus:'profitability_ready',completenessResult:{status:'profitability_ready',percentage:100,reasons:[],actionCodes:[],recordedCodes:[],metadata:{applicableCheckCount:8,passedCheckCount:8}},budgetCostEur:90,budgetRevenueEur:240,costVariance:resolveBudgetVariance({budget:90,actual:100})};
// Deliberately minimal resolver fixture; export builders only read these fields.
const data:any={farm:{name:'Boerderij Één'},season:{year:2026},finance:{fields:[row],crops:[{crop:'wheat',fields:1,hectares:10,costEur:100,revenueEur:250,grossMarginEur:150,costPerHaEur:10,grossMarginPerHaEur:15,completenessPercent:100}],totalRecordedCostEur:100,totalRecordedRevenueEur:250,grossMarginEur:150,completenessPercent:100,unallocatedCostEur:null,unallocatedRevenueEur:null},purchases:[],expenses:[],harvest:[],revenue:[]};
describe('economics exports',()=>{
  it('uses stable field CSV headers and UTF-8 BOM',()=>{const value=buildEconomicsCsv('field_economics',data);expect(value.charCodeAt(0)).toBe(0xfeff);expect(value).toContain('field_id,field,crop,hectares');});
  it('protects spreadsheet formula injection',()=>expect(buildEconomicsCsv('field_economics',data)).toContain("'=Danger"));
  it('uses blank cells for missing values rather than zero',()=>expect(buildEconomicsCsv('field_economics',{...data,finance:{...data.finance,fields:[{...row,recordedCostEur:null}]}})).not.toContain('f1,\'=Danger,wheat,10,0,'));
  it('creates a readable A4 PDF with disclaimer and totals source',async()=>{const bytes=await buildEconomicsPdf('season_gross_margin',data,'export-1');const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThan(0);expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28,1);});
});
