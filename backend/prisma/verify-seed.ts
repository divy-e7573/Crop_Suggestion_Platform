/*
 * Runtime verification for the seeded database.
 *
 * Run with `npm run db:verify` after `npm run db:seed`. Unlike
 * `seed-data.test.ts`, which is pure and runs anywhere, this script needs a
 * real database, so it is kept separate from `npm test`.
 *
 * It proves the Prisma client, the driver adapter, and the repository helpers
 * all work against a live PostgreSQL instance, and that every seeded row is
 * correctly labelled as demo data.
 */
export {};

for (const file of ['.env.local', '.env']) {
  try { process.loadEnvFile(file); } catch { /* absent */ }
}

// Imported dynamically because ESM hoists static imports, which would build
// the Prisma client before the environment file above is loaded.
const { prisma } = await import('../src/lib/db/client.ts');
const {
  getPriceHistory,
  listCrops,
  listMarkets,
  listPriceObservations,
} = await import('../src/lib/db/repositories.ts');

let failures = 0;
const check = (ok: boolean, label: string, extra = '') => {
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + label + (extra ? ' | ' + extra : ''));
};

async function main() {
  console.log('--- raw client ---');
  const one = await prisma.crop.findFirst({ where: { slug: 'wheat' } });
  check(one?.name === 'Wheat', 'crop lookup by slug', String(one?.name));
  check(one?.dataStatus === 'DEMO', 'crop carries DEMO status', String(one?.dataStatus));
  check(Array.isArray(one?.aliases) && one.aliases.length > 0, 'aliases round-trip', JSON.stringify(one?.aliases));

  const total = await prisma.mandiPriceObservation.count();
  check(total === 252, 'observation count is 252', String(total));

  const foreignKey = await prisma.mandiPriceObservation.findFirst({
    where: { crop: { slug: 'onion' } },
    include: { crop: true, market: true },
  });
  check(foreignKey?.crop.slug === 'onion', 'relation include works (crop)', foreignKey?.crop.slug);
  check(!!foreignKey?.market.state, 'relation include works (market)', foreignKey?.market.state);

  console.log('\n--- repositories ---');
  const prices = await listPriceObservations({ cropSlug: 'wheat', take: 5 });
  check(prices.length === 5, 'listPriceObservations respects take', String(prices.length));
  check(prices.every((p) => p.dataStatus === 'DEMO'), 'repository rows expose dataStatus');
  check(prices.every((p) => p.crop.slug === 'wheat'), 'repository crop filter applied');

  const byState = await listPriceObservations({ state: 'Punjab', take: 50 });
  check(byState.length > 0, 'state filter returns rows', String(byState.length));
  check(byState.every((p) => p.market.state === 'Punjab'), 'state filter is correct');

  const markets = await listMarkets({ state: 'Maharashtra', take: 10 });
  check(markets.length === 3, 'three Maharashtra markets', String(markets.length));
  check(markets.every((m) => m.latitude === null), 'no demo market has coordinates');

  const crops = await listCrops({ take: 50 });
  check(crops.length === 6, 'six crops listed', String(crops.length));

  const history = await getPriceHistory({
    cropSlug: 'wheat', marketSlug: 'nashik-apmc-maharashtra', take: 50,
  });
  check(history.length === 7, 'history returns 7 days', String(history.length));
  const ascending = history.every(
    (h, i) => i === 0 || h.observedAt >= history[i - 1]!.observedAt,
  );
  check(ascending, 'history is oldest-first');
  check(history.every((h) => h.unit === 'RUPEES_PER_QUINTAL'), 'history rows carry the unit');

  console.log('\n--- determinism across two identical queries ---');
  const a = await listPriceObservations({ cropSlug: 'rice', take: 10 });
  const b = await listPriceObservations({ cropSlug: 'rice', take: 10 });
  check(
    JSON.stringify(a) === JSON.stringify(b),
    'repeat query returns identical rows',
  );

  console.log('\nFAILURES: ' + failures);
}

main()
  .catch((e: unknown) => {
    console.error('verification failed:', e);
    failures++;
  })
  .finally(() => { void prisma.$disconnect(); });
