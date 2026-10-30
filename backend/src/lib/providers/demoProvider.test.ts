import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoProvider, DEMO_SOURCE_ID, type DemoDataSource } from './demoProvider.ts';
import type { StoredMarketRow, StoredObservationRow } from './types.ts';

function observationRow(overrides: Partial<StoredObservationRow> = {}): StoredObservationRow {
  return {
    observedAt: new Date('2026-01-05T00:00:00.000Z'),
    minPrice: 2000,
    maxPrice: 2400,
    modalPrice: 2200,
    unit: 'RUPEES_PER_QUINTAL',
    source: DEMO_SOURCE_ID,
    dataStatus: 'DEMO',
    fetchedAt: null,
    crop: { slug: 'wheat', name: 'Wheat', aliases: ['Gehun'] },
    market: {
      slug: 'nashik-apmc-maharashtra',
      name: 'Nashik APMC',
      state: 'Maharashtra',
      district: 'Nashik',
      locality: 'Pimpalgaon',
      source: DEMO_SOURCE_ID,
      dataStatus: 'DEMO',
    },
    ...overrides,
  };
}

function marketRow(overrides: Partial<StoredMarketRow> = {}): StoredMarketRow {
  return {
    slug: 'nashik-apmc-maharashtra',
    name: 'Nashik APMC',
    state: 'Maharashtra',
    district: 'Nashik',
    locality: 'Pimpalgaon',
    latitude: null,
    longitude: null,
    source: DEMO_SOURCE_ID,
    dataStatus: 'DEMO',
    latest: observationRow(),
    ...overrides,
  };
}

function fakeSource(
  observations: StoredObservationRow[],
  markets: StoredMarketRow[] = [],
): DemoDataSource {
  return {
    async listObservations() {
      return { items: observations, total: observations.length };
    },
    async listMarkets() {
      return { items: markets, total: markets.length };
    },
  };
}

test('the demo provider labels every record as demo data', async () => {
  const provider = createDemoProvider(fakeSource([observationRow()]));
  const result = await provider.listObservations({ limit: 10, offset: 0 });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.dataStatus, 'DEMO');
  assert.equal(result.items[0]!.source, DEMO_SOURCE_ID);
  assert.equal(result.items[0]!.fetchedAt, null);
  assert.equal(provider.isDemo, true);
  assert.equal(provider.verifiedLive, false);
});

test('the demo provider never serves a stored row that is not labelled demo', async () => {
  const provider = createDemoProvider(
    fakeSource([
      observationRow({ dataStatus: 'LIVE', source: 'data-gov-in' }),
      observationRow(),
    ]),
  );

  const result = await provider.listObservations({ limit: 10, offset: 0 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.dataStatus, 'DEMO');
  assert.equal(result.items[0]!.source, DEMO_SOURCE_ID);
});

test('the demo provider filters by crop, market, state and date', async () => {
  const rows = [
    observationRow(),
    observationRow({
      crop: { slug: 'rice', name: 'Rice', aliases: ['Paddy'] },
      market: {
        slug: 'ludhiana-mandi-punjab',
        name: 'Ludhiana Mandi',
        state: 'Punjab',
        district: 'Ludhiana',
        locality: null,
        source: DEMO_SOURCE_ID,
        dataStatus: 'DEMO',
      },
      observedAt: new Date('2026-01-09T00:00:00.000Z'),
    }),
  ];
  const provider = createDemoProvider(fakeSource(rows));

  const bySlug = await provider.listObservations({ crop: 'wheat', limit: 10, offset: 0 });
  assert.equal(bySlug.items.length, 1);

  const byAlias = await provider.listObservations({ crop: 'Paddy', limit: 10, offset: 0 });
  assert.equal(byAlias.items.length, 1);
  assert.equal(byAlias.items[0]!.cropSlug, 'rice');

  const byMarket = await provider.listObservations({ market: 'Ludhiana Mandi', limit: 10, offset: 0 });
  assert.equal(byMarket.items.length, 1);

  const byState = await provider.listObservations({ state: 'maharashtra', limit: 10, offset: 0 });
  assert.equal(byState.items.length, 1);

  const byDate = await provider.listObservations({
    from: new Date('2026-01-08T00:00:00.000Z'),
    to: new Date('2026-01-10T00:00:00.000Z'),
    limit: 10,
    offset: 0,
  });
  assert.equal(byDate.items.length, 1);
  assert.equal(byDate.items[0]!.cropSlug, 'rice');
});

test('the demo provider returns an empty page when nothing matches', async () => {
  const provider = createDemoProvider(fakeSource([observationRow()]));
  const result = await provider.listObservations({ crop: 'banana', limit: 10, offset: 0 });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 1);
});

test('the demo provider reports markets without coordinates and with a latest price', async () => {
  const provider = createDemoProvider(fakeSource([], [marketRow()]));
  const result = await provider.listMarkets({ limit: 10, offset: 0 });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.hasVerifiedCoordinates, false);
  assert.equal(result.items[0]!.dataStatus, 'DEMO');
  assert.equal(result.items[0]!.latestObservation?.modalPrice, 2200);
});
