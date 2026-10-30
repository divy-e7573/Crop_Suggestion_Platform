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
  countFarmProfiles,
  findLatestFarmProfile,
  getPriceHistory,
  listMarketRecords,
  listCrops,
  listMarkets,
  listPriceRecords,
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

  console.log('\n--- provider-facing queries (Phase 5) ---');
  const demo = { source: 'demo-seed', dataStatus: 'DEMO' } as const;

  const records = await listPriceRecords({ ...demo, limit: 10, offset: 0 });
  check(records.items.length === 10, 'listPriceRecords respects the page size', String(records.items.length));
  check(records.total === 252, 'listPriceRecords counts every matching row', String(records.total));
  check(records.items.every((r) => r.dataStatus === 'DEMO'), 'listPriceRecords only returns demo rows');
  check(records.items.every((r) => r.source === 'demo-seed'), 'listPriceRecords only returns demo-seed rows');
  check(records.items.every((r) => typeof r.minPrice === 'number'), 'listPriceRecords converts Decimal prices to numbers');
  check(records.items.every((r) => r.crop.aliases.length > 0), 'listPriceRecords includes the crop aliases');

  const liveScoped = await listPriceRecords({
    ...demo,
    source: 'data-gov-in',
    dataStatus: 'LIVE',
    limit: 10,
    offset: 0,
  });
  check(liveScoped.items.length === 0, 'live-scoped query never returns demo rows', String(liveScoped.items.length));
  check(liveScoped.total === 0, 'live-scoped count is zero', String(liveScoped.total));

  const paged = await listPriceRecords({ ...demo, limit: 5, offset: 10 });
  const firstPage = await listPriceRecords({ ...demo, limit: 5, offset: 0 });
  check(paged.items.length === 5, 'listPriceRecords honours the offset');
  check(
    JSON.stringify(paged.items) !== JSON.stringify(firstPage.items),
    'listPriceRecords returns a different page for a different offset',
  );

  const marketRecords = await listMarketRecords({ ...demo, limit: 10, offset: 0 });
  check(marketRecords.items.length === 6, 'listMarketRecords returns every market', String(marketRecords.items.length));
  check(marketRecords.total === 6, 'listMarketRecords counts every market', String(marketRecords.total));
  check(
    marketRecords.items.every((m) => m.latest !== null),
    'every market has its latest observation attached',
  );
  check(
    marketRecords.items.every((m) => m.latest?.dataStatus === 'DEMO'),
    'every attached observation is labelled DEMO',
  );
  check(
    marketRecords.items.every((m) => m.latitude === null && m.longitude === null),
    'no demo market carries coordinates',
  );

  const puneMarkets = await listMarketRecords({ ...demo, state: 'Maharashtra', limit: 10, offset: 0 });
  check(puneMarkets.items.length === 3, 'listMarketRecords filters by state', String(puneMarkets.items.length));
  check(
    puneMarkets.items.every((m) => m.state === 'Maharashtra'),
    'listMarketRecords state filter is correct',
  );

  console.log('\n--- farmer profiles (Phase 6) ---');
  const profileCount = await countFarmProfiles();
  const profileRows = await prisma.farmProfile.findMany({ orderBy: { createdAt: 'asc' } });
  check(
    profileCount === profileRows.length,
    'countFarmProfiles matches the table',
    String(profileCount),
  );

  check(
    profileRows.every(
      (p) =>
        p.state.trim() !== '' &&
        p.district.trim() !== '' &&
        Number(p.landArea) > 0 &&
        (p.landAreaUnit === 'ACRE' || p.landAreaUnit === 'HECTARE'),
    ),
    'every stored profile has a location and a positive land area with a unit',
  );

  check(
    profileRows.every(
      (p) =>
        p.dataStatus === 'LIVE' ||
        p.dataStatus === 'RECENT' ||
        p.dataStatus === 'DEMO' ||
        p.dataStatus === 'UNAVAILABLE',
    ),
    'every stored profile carries a known data status',
  );

  check(
    profileRows.every((p) => p.dataSourceId.trim() !== ''),
    'every stored profile records which data source answered',
  );

  check(
    profileRows.every((p) => p.matchingObservations >= 0 && p.matchingMarkets >= 0),
    'matching counts are never negative',
  );

  // The privacy promise is checked against the real table, not against a
  // comment: the profile table must not grow a column for a name, a phone
  // number, or a precise coordinate (PRD section 13).
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'FarmProfile'
  `;
  const columnNames = columns.map((row) => row.column_name.toLowerCase());
  const forbidden = ['name', 'fullname', 'phone', 'mobile', 'email', 'latitude', 'longitude'];
  check(
    forbidden.every((column) => !columnNames.includes(column)),
    'the profile table stores no name, contact or coordinate column',
    columnNames.join(','),
  );

  const latest = await findLatestFarmProfile();
  const newest = profileRows[profileRows.length - 1];
  check(
    latest === null || latest.id === newest?.id,
    'findLatestFarmProfile returns the newest profile',
    String(latest?.id),
  );

  console.log('\nFAILURES: ' + failures);
}

main()
  .catch((e: unknown) => {
    console.error('verification failed:', e);
    failures++;
  })
  .finally(() => { void prisma.$disconnect(); });
