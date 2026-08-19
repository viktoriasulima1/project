import { PrismaClient } from '@prisma/client';

function getE2ePrisma(): PrismaClient {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e|test/i.test(url)) {
    throw new Error('seed-farms.ts refuses to run without a valid E2E_DATABASE_URL (must contain "e2e" or "test").');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export interface SeededFarm {
  farmId: string;
  fieldId: string;
  fieldSeasonId: string;
  productId: string;
  machineId: string;
}

/**
 * Seeds a fully "ready" farm directly via Prisma — bypassing the UI — so
 * feature/failure/mobile/isolation tests don't each have to redo the full
 * onboarding wizard just to get a farm to work with. The golden-path test is
 * the one place onboarding itself is exercised through real browser UI.
 */
export async function seedReadyFarm(clerkUserId: string, farmName: string): Promise<SeededFarm> {
  const prisma = getE2ePrisma();
  try {
    // Idempotent: if this Clerk user already has a farm (from a prior run),
    // reuse it rather than violating the @unique clerkUserId constraint.
    const existing = await prisma.farm.findUnique({
      where: { clerkUserId },
      include: { fields: true, seasons: true, inventoryItems: true, machines: true },
    });

    const farm = existing ?? await prisma.farm.create({
      data: {
        clerkUserId,
        name: farmName,
        location: 'Westervoort, Gelderland',
        country: 'NL',
        totalHectares: 42,
        latitude: 51.9652,
        longitude: 5.9307,
      },
    });

    const season = existing?.seasons[0] ?? await prisma.season.create({
      data: {
        farmId: farm.id,
        year: 2026,
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });

    const field = existing?.fields[0] ?? await prisma.field.create({
      data: {
        farmId: farm.id,
        name: `${farmName} — Noord`,
        hectares: 12.5,
        soilType: 'clay',
      },
    });

    let fieldSeason = existing
      ? await prisma.fieldSeason.findFirst({ where: { fieldId: field.id, seasonId: season.id } })
      : null;
    fieldSeason ??= await prisma.fieldSeason.create({
      data: { fieldId: field.id, seasonId: season.id, crop: 'wheat' },
    });

    const product = existing?.inventoryItems[0] ?? await prisma.inventoryItem.create({
      data: {
        farmId: farm.id,
        name: 'Amistar Opti',
        category: 'fungicide',
        unit: 'L',
        currentStock: 500,
        minimumStock: 50,
        registrationNumber: 'NL-12345',
      },
    });

    const machine = existing?.machines[0] ?? await prisma.machine.create({
      data: { farmId: farm.id, name: 'Sprayer 1', type: 'sprayer' },
    });

    return { farmId: farm.id, fieldId: field.id, fieldSeasonId: fieldSeason.id, productId: product.id, machineId: machine.id };
  } finally {
    await prisma.$disconnect();
  }
}
