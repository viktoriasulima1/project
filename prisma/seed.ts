import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Identity anchor for the dev/demo farm. Deliberately NOT the Clerk user id
// or the row's own primary key — `clerkUserId` is expected to change every
// time DEV_SEED_USER_ID changes (that's the whole point), and a lookup keyed
// on it or on one specific historical `id` value goes stale the moment the
// farm gets relinked to some third id: the next reseed then finds nothing
// under any of its known keys and creates a duplicate. `name` is the one
// value the seed fully owns and never changes, so it's the only safe
// idempotency anchor across repeated relinking.
const DEV_FARM_ID = 'dev-farm-gelderland'; // used only when creating fresh
const DEV_FARM_NAME = 'Dev Farm Gelderland';
const DEFAULT_DEV_USER_ID = 'dev_user_001';

async function main() {
  console.log('Seeding development database...');

  const targetClerkUserId = process.env.DEV_SEED_USER_ID?.trim() || DEFAULT_DEV_USER_ID;
  console.log(`Target Clerk user id: ${targetClerkUserId}${process.env.DEV_SEED_USER_ID ? ' (from DEV_SEED_USER_ID)' : ' (default placeholder — set DEV_SEED_USER_ID to your real Clerk user id to link automatically)'}`);

  const existing = await db.farm.findFirst({ where: { name: DEV_FARM_NAME } });

  const farm = existing
    ? await db.farm.update({
        where: { id: existing.id },
        data: { clerkUserId: targetClerkUserId },
      })
    : await db.farm.create({
        data: {
          id: DEV_FARM_ID,
          clerkUserId: targetClerkUserId,
          name: DEV_FARM_NAME,
          location: 'Westervoort, Gelderland',
          country: 'NL',
          totalHectares: 145.5,
          brpNumber: '12345678',
          latitude: 51.9652,
          longitude: 5.9307,
        },
      });

  console.log(`Farm: ${farm.name} (${farm.id})`);
  if (existing) {
    console.log(
      existing.clerkUserId === targetClerkUserId
        ? 'Farm ownership: reused (already linked to target Clerk user).'
        : `Farm ownership: relinked (was ${existing.clerkUserId} → now ${targetClerkUserId}).`,
    );
  } else {
    console.log(`Farm ownership: created, linked to ${targetClerkUserId}.`);
  }

  // Season
  await db.season.updateMany({
    where: { farmId: farm.id, isActive: true },
    data: { isActive: false },
  });

  const season = await db.season.upsert({
    where: { farmId_year: { farmId: farm.id, year: 2026 } },
    update: { isActive: true },
    create: {
      farmId: farm.id,
      year: 2026,
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  console.log(`Season: ${season.year} (active: ${season.isActive})`);

  // Fields
  const fieldData = [
    { name: 'Rijnkamp Noord', hectares: 24.3, soilType: 'clay' as const, crop: 'wheat' as const },
    { name: 'Rijnkamp Zuid', hectares: 18.7, soilType: 'clay' as const, crop: 'potato' as const },
    { name: 'Dijkpolder', hectares: 31.2, soilType: 'loam' as const, crop: 'sugar_beet' as const },
    { name: 'Achterste Kamp', hectares: 15.0, soilType: 'sandy' as const, crop: 'barley' as const },
    { name: 'Kleikavel West', hectares: 28.8, soilType: 'clay' as const, crop: 'onion' as const },
  ];

  for (const fd of fieldData) {
    const field = await db.field.upsert({
      where: { id: `dev-field-${fd.name.replace(/\s/g, '-').toLowerCase()}` },
      update: {},
      create: {
        id: `dev-field-${fd.name.replace(/\s/g, '-').toLowerCase()}`,
        farmId: farm.id,
        name: fd.name,
        hectares: fd.hectares,
        soilType: fd.soilType,
      },
    });

    await db.fieldSeason.upsert({
      where: { fieldId_seasonId: { fieldId: field.id, seasonId: season.id } },
      update: {},
      create: {
        fieldId: field.id,
        seasonId: season.id,
        crop: fd.crop,
        sowingDate: new Date('2026-03-15'),
        targetYieldTHa: 8.5,
      },
    });
  }

  console.log(`Created ${fieldData.length} fields with field seasons`);

  // Inventory items
  const products = [
    {
      name: 'Amistar Opti',
      category: 'fungicide' as const,
      activeIngredient: 'Azoxystrobin 200 g/L + Chlorothalonil 500 g/L',
      unit: 'L' as const,
      currentStock: 120.0,
      minimumStock: 20.0,
      registrationNumber: 'CTB 13093N',
      fracCode: 'C3 + M5',
      phiDays: 14,
    },
    {
      name: 'Roundup Ready-to-Use',
      category: 'herbicide' as const,
      activeIngredient: 'Glyphosate 41 g/L',
      unit: 'L' as const,
      currentStock: 85.0,
      minimumStock: 10.0,
      registrationNumber: 'CTB 11491N',
      fracCode: 'G',
      phiDays: 7,
    },
    {
      name: 'KAS 27% N',
      category: 'fertiliser' as const,
      activeIngredient: 'Kalkammonsalpeter 27% N',
      unit: 'kg' as const,
      currentStock: 4200.0,
      minimumStock: 500.0,
      phiDays: 0,
    },
    {
      name: 'Karate Zeon 100 CS',
      category: 'insecticide' as const,
      activeIngredient: 'Lambda-cyhalothrin 100 g/L',
      unit: 'L' as const,
      currentStock: 8.0,
      minimumStock: 2.0,
      registrationNumber: 'CTB 10952N',
      fracCode: '3A',
      phiDays: 7,
    },
  ];

  for (const prod of products) {
    await db.inventoryItem.upsert({
      where: { id: `dev-prod-${prod.name.replace(/\s/g, '-').toLowerCase().slice(0, 20)}` },
      update: { currentStock: prod.currentStock },
      create: {
        id: `dev-prod-${prod.name.replace(/\s/g, '-').toLowerCase().slice(0, 20)}`,
        farmId: farm.id,
        ...prod,
      },
    });
  }

  console.log(`Created ${products.length} inventory items`);

  // Sprayer machine
  await db.machine.upsert({
    where: { id: 'dev-machine-sprayer' },
    update: {},
    create: {
      id: 'dev-machine-sprayer',
      farmId: farm.id,
      name: 'Berthoud Futur 3000',
      type: 'sprayer',
      make: 'Berthoud',
      model: 'Futur 3000',
      year: 2019,
      isCertified: true,
    },
  });

  console.log('Created sprayer machine');
  console.log(`Farm linked successfully: clerkUserId=${farm.clerkUserId}`);
  if (!process.env.DEV_SEED_USER_ID) {
    console.log(
      'Note: this placeholder id will not match your real Clerk session. ' +
      'Either set DEV_SEED_USER_ID=<your Clerk user id> and re-run this seed, ' +
      'or use the "Load demo farm" button shown in development when no farm is found.',
    );
  }
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
