import { PrismaClient } from '@prisma/client';

function getE2ePrisma(): PrismaClient {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e|test/i.test(url)) {
    throw new Error('adjust-farm.ts refuses to run without a valid E2E_DATABASE_URL (must contain "e2e" or "test").');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Test-only direct-DB coordinate override. Used to force a REAL Open-Meteo
 * API failure (an out-of-range latitude/longitude gets a genuine 400 from
 * the real API) rather than mocking network calls the Next.js SERVER makes
 * — those are not interceptable via Playwright's browser-side page.route().
 */
export async function setFarmCoordinates(farmId: string, latitude: number, longitude: number): Promise<void> {
  const prisma = getE2ePrisma();
  try {
    await prisma.farm.update({ where: { id: farmId }, data: { latitude, longitude } });
  } finally {
    await prisma.$disconnect();
  }
}
