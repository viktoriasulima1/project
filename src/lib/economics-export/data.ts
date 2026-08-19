import type { Farm } from '@prisma/client';
import { db } from '@/lib/db';
import { getFinanceData } from '@/lib/finance-data';
import { getAllocatableRecords } from '@/lib/reallocation-data';

export async function getEconomicsExportData(farm:Farm,seasonId:string){
  const season=await db.season.findFirst({where:{id:seasonId,farmId:farm.id}});if(!season)throw new Error('Season does not belong to this farm.');
  const[finance,purchases,expenses,harvest,revenue,allocatable]=await Promise.all([
    getFinanceData(farm,season.id),
    db.inventoryPurchase.findMany({where:{farmId:farm.id,seasonId:season.id},include:{inventoryItem:{select:{name:true}}},orderBy:{purchaseDate:'asc'}}),
    db.financialExpense.findMany({where:{farmId:farm.id,seasonId:season.id},include:{fieldSeason:{include:{field:true}}},orderBy:{expenseDate:'asc'}}),
    db.harvestResult.findMany({where:{farmId:farm.id,seasonId:season.id},include:{fieldSeason:{include:{field:true}}},orderBy:{harvestDate:'asc'}}),
    db.revenueEntry.findMany({where:{farmId:farm.id,seasonId:season.id},include:{fieldSeason:{include:{field:true}}},orderBy:{revenueDate:'asc'}}),
    // Sprint 25 Part 14 — allocatable records for the unallocated-records report
    // (activity-derived direct costs are already excluded by this loader).
    getAllocatableRecords(farm,season.id),
  ]);
  return{farm,season,finance,purchases,expenses,harvest,revenue,allocatable:allocatable.records};
}
export type EconomicsExportData=Awaited<ReturnType<typeof getEconomicsExportData>>;
