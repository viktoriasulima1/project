import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { EconomicsExportData } from './data';
import type { Locale } from '@/i18n/locales';
import type { Translate } from '@/i18n/translator';
import { buildBudgetVarianceDisplayModel } from '@/i18n/adapters/budget-variance';

export type EconomicsPdfType='field_cost'|'crop_comparison'|'season_gross_margin'|'budget_vs_actual'|'purchase_history'|'cost_source_breakdown';
const W=595.28,H=841.89,M=40;
const text=(value:number|null)=>value==null?'Not recorded':`EUR ${value.toFixed(2)}`;
function safe(value:string){return value.replace(/[—–]/g,'-').replace(/€/g,'EUR').replace(/[łŁ]/g,(c)=>c==='ł'?'l':'L').normalize('NFD').replace(/\p{M}/gu,'');}
export async function buildEconomicsPdf(type:EconomicsPdfType,data:EconomicsExportData,exportId:string,localization?:{locale:Locale;t:Translate}){const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page=pdf.addPage([W,H]),y=H-M;const rows:Array<[string,string]>=[];
  if(type==='field_cost')for(const row of data.finance.fields)rows.push([`${row.field} / ${row.crop}`,`Cost ${text(row.recordedCostEur)} | Cost/ha ${text(row.costPerHaEur)} | Complete ${row.completenessPercent}%`]);
  else if(type==='crop_comparison')for(const row of data.finance.crops)rows.push([row.crop,`Fields ${row.fields} | ${row.hectares.toFixed(2)} ha | Margin ${text(row.grossMarginEur)} | Complete ${row.completenessPercent}%`]);
  else if(type==='purchase_history')for(const row of data.purchases.filter(x=>x.status==='active'))rows.push([`${row.purchaseDate.toISOString().slice(0,10)} / ${row.inventoryItem.name}`,`${Number(row.quantity)} ${row.unit} | ${text(Number(row.totalAmount))} | ${row.invoiceReference??'No reference'}`]);
  else if(type==='budget_vs_actual')for(const row of data.finance.fields){if(localization){const m=buildBudgetVarianceDisplayModel(localization.t,localization.locale,row.costVariance);rows.push([row.field,`${m.budgetLabel} ${m.budgetText} | ${m.actualLabel} ${m.actualText} | ${m.varianceLabel} ${m.varianceText} | ${m.statusLabel} — ${m.explanation}`]);}else rows.push([row.field,`Budget ${text(row.budgetCostEur)} | Actual ${text(row.recordedCostEur)} | Variance ${text(row.costVariance.metadata.varianceCents==null?null:row.costVariance.metadata.varianceCents/100)}`]);}
  else if(type==='cost_source_breakdown'){const totals=new Map<string,number>();for(const row of data.expenses.filter(x=>x.status==='active'))totals.set(row.sourceType,(totals.get(row.sourceType)??0)+Number(row.amount));for(const[key,value]of totals)rows.push([key,text(value)]);}
  else rows.push(['Recorded costs',text(data.finance.totalRecordedCostEur)],['Recorded revenue',text(data.finance.totalRecordedRevenueEur)],['Gross margin (not net profit)',text(data.finance.grossMarginEur)],['Completeness',`${data.finance.completenessPercent}%`],['Unallocated costs',text(data.finance.unallocatedCostEur)],['Unallocated revenue',text(data.finance.unallocatedRevenueEur)]);
  const header=(p:PDFPage)=>{let top=H-M;p.drawText(safe(data.farm.name),{x:M,y:top,size:16,font:bold});top-=20;p.drawText(`Economics report: ${type.replaceAll('_',' ')}`,{x:M,y:top,size:12,font:bold});top-=16;p.drawText(`Season ${data.season.year} | Generated ${new Date().toISOString()} | Export ${exportId}`,{x:M,y:top,size:8,font:regular});return top-20};y=header(page);
  for(const[label,value]of rows){if(y<90){page=pdf.addPage([W,H]);y=header(page)}page.drawText(safe(label).slice(0,70),{x:M,y,size:9,font:bold});y-=13;page.drawText(safe(value).slice(0,100),{x:M+10,y,size:8,font:regular,color:rgb(.25,.25,.25)});y-=18}
  const pages=pdf.getPages();pages.forEach((p,index)=>{p.drawText('Operational economics, not statutory accounting',{x:M,y:42,size:7,font:regular,color:rgb(.4,.4,.4)});p.drawText(`Page ${index+1} of ${pages.length}`,{x:W-M-70,y:42,size:7,font:regular})});return pdf.save();}
