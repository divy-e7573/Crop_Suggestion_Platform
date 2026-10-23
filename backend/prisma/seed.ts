import { PrismaClient } from '../generated/prisma/client.ts';

import { createPrismaAdapter } from '../src/lib/db/adapter.ts';

import {
  CROPS,
  DEMO_SOURCE,
  MARKETS,
  SUITABILITY_RULES,
  buildObservations,
} from './seed-data.ts';

/**
 * Loads the same environment files the Prisma CLI uses.
 *
 * Without this the seed would see an empty environment when run directly with
 * `npm run db:seed`.
 */
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Absent file; the URL may still come from the shell environment.
  }
}

async function main(): Promise<void> {
  // Built inside main so a missing DATABASE_URL produces the adapter's clear
  // message instead of an unhandled module-level stack trace.
  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

  console.log('[seed] starting demo seed (all rows are marked DEMO)');

  // Upserts keep re-running safe: every write targets a natural unique key
  // rather than a generated id, so a second run updates instead of duplicating.
  const cropIds = new Map<string, string>();
  for (const crop of CROPS) {
    const row = await prisma.crop.upsert({
      where: { slug: crop.slug },
      update: {
        name: crop.name,
        aliases: crop.aliases,
        category: crop.category,
        dataStatus: 'DEMO',
        source: DEMO_SOURCE,
      },
      create: {
        slug: crop.slug,
        name: crop.name,
        aliases: crop.aliases,
        category: crop.category,
        dataStatus: 'DEMO',
        source: DEMO_SOURCE,
      },
    });
    cropIds.set(crop.slug, row.id);
  }
  console.log('[seed] crops: ' + cropIds.size);

  const marketIds = new Map<string, string>();
  for (const market of MARKETS) {
    const row = await prisma.market.upsert({
      where: { slug: market.slug },
      update: {
        name: market.name,
        state: market.state,
        district: market.district,
        locality: market.locality,
        source: DEMO_SOURCE,
        dataStatus: 'DEMO',
      },
      create: {
        slug: market.slug,
        name: market.name,
        state: market.state,
        district: market.district,
        locality: market.locality,
        source: DEMO_SOURCE,
        dataStatus: 'DEMO',
      },
    });
    marketIds.set(market.slug, row.id);
  }
  console.log('[seed] markets: ' + marketIds.size);

  let observationCount = 0;
  for (const row of buildObservations()) {
    const cropId = cropIds.get(row.cropSlug);
    const marketId = marketIds.get(row.marketSlug);
    if (cropId === undefined || marketId === undefined) {
      throw new Error('Seed references an unknown crop or market: ' + JSON.stringify(row));
    }

    const observedAt = new Date(row.observedAt + 'T00:00:00.000Z');
    const values = {
      minPrice: row.minPrice.toFixed(2),
      maxPrice: row.maxPrice.toFixed(2),
      modalPrice: row.modalPrice.toFixed(2),
      unit: row.unit,
      source: row.source,
      dataStatus: row.dataStatus,
      fetchedAt: row.fetchedAt,
    };

    await prisma.mandiPriceObservation.upsert({
      where: { cropId_marketId_observedAt: { cropId, marketId, observedAt } },
      update: values,
      create: { cropId, marketId, observedAt, ...values },
    });
    observationCount++;
  }
  console.log('[seed] price observations: ' + observationCount);

  let ruleCount = 0;
  for (const rule of SUITABILITY_RULES) {
    const cropId = cropIds.get(rule.cropSlug);
    if (cropId === undefined) {
      throw new Error('Rule references an unknown crop: ' + rule.cropSlug);
    }

    const values = {
      soilTypes: rule.soilTypes,
      seasons: rule.seasons,
      irrigationTypes: rule.irrigationTypes,
      applicableStates: rule.applicableStates,
      minLandAreaAcre: rule.minLandAreaAcre,
      maxLandAreaAcre: rule.maxLandAreaAcre,
      explanation: rule.explanation,
      isActive: rule.isActive,
      dataStatus: rule.dataStatus,
      source: rule.source,
    };

    await prisma.cropSuitabilityRule.upsert({
      where: { cropId_ruleVersion: { cropId, ruleVersion: rule.ruleVersion } },
      update: values,
      create: { cropId, ruleVersion: rule.ruleVersion, ...values },
    });
    ruleCount++;
  }
  console.log('[seed] suitability rules: ' + ruleCount);
  console.log('[seed] done. These are DEMO records, not real mandi prices.');
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
