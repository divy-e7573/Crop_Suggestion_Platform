/*
 * Tests for the dashboard calculations.
 *
 * These run on the plain Node test runner, the same way the backend tests
 * do, so the rules that keep demo data and real data apart are checked
 * without a browser.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type { CropDto, MarketDto, PriceObservationDto, PriceSeriesDto } from './mandiApi.ts';
import {
  compareMarkets,
  districtOptions,
  distinctCrops,
  formatDateRange,
  formatInr,
  formatObservationDate,
  resolveCropSlug,
  resolveMarketSlug,
  relevantMarkets,
  stateOptions,
  summariseObservations,
  toChartPoints,
} from './priceAnalytics.ts';

function observation(overrides: Partial<PriceObservationDto> = {}): PriceObservationDto {
  return {
    crop: { slug: 'wheat', name: 'Wheat', variety: null, grade: null },
    market: {
      slug: 'nashik-apmc-maharashtra',
      name: 'Nashik APMC',
      state: 'Maharashtra',
      district: 'Nashik',
      locality: null,
    },
    observedAt: '2026-01-10',
    minPrice: 2000,
    maxPrice: 2500,
    modalPrice: 2275,
    unit: 'RUPEES_PER_QUINTAL',
    unitLabel: 'INR per quintal',
    currency: 'INR',
    source: 'demo-seed',
    dataStatus: 'DEMO',
    isLive: false,
    fetchedAt: null,
    ...overrides,
  };
}

function series(overrides: Partial<PriceSeriesDto['series']> = {}): PriceSeriesDto {
  return {
    series: {
      crop: { slug: 'wheat', name: 'Wheat' },
      market: {
        slug: 'nashik-apmc-maharashtra',
        name: 'Nashik APMC',
        state: 'Maharashtra',
        district: 'Nashik',
      },
      metric: 'MODAL_PRICE',
      unit: 'RUPEES_PER_QUINTAL',
      unitLabel: 'INR per quintal',
      currency: 'INR',
      points: [
        {
          observedAt: '2026-01-05',
          minPrice: 2000,
          maxPrice: 2500,
          modalPrice: 2275,
          dataStatus: 'DEMO',
          source: 'demo-seed',
        },
        {
          observedAt: '2026-01-06',
          minPrice: 2100,
          maxPrice: 2600,
          modalPrice: 2350,
          dataStatus: 'DEMO',
          source: 'demo-seed',
        },
      ],
      isComplete: true,
      ...overrides,
    },
    dataSource: {
      providerId: 'demo-seed',
      providerName: 'Seeded demonstration data',
      mode: 'demo',
      dataStatus: 'DEMO',
      isDemoData: true,
      isLiveData: false,
      label: 'Demo data',
      notice: 'These are seeded demonstration records.',
      source: { id: 'demo-seed', url: null, attribution: 'Seeded records.' },
    },
  };
}

test('a summary needs at least one observation', () => {
  assert.equal(summariseObservations([]), null);
});

test('the summary reports the minimum, maximum, and average modal price', () => {
  const summary = summariseObservations([
    observation({ minPrice: 1900, maxPrice: 2400, modalPrice: 2200 }),
    observation({ minPrice: 2100, maxPrice: 2600, modalPrice: 2400 }),
  ]);

  assert.ok(summary);
  assert.equal(summary.count, 2);
  assert.equal(summary.minPrice, 1900);
  assert.equal(summary.maxPrice, 2600);
  assert.equal(summary.averageModalPrice, 2300);
  assert.equal(summary.unitLabel, 'INR per quintal');
  assert.equal(summary.mixedUnits, false);
});

test('observations in another unit are not averaged together', () => {
  const summary = summariseObservations([
    observation({ modalPrice: 2000 }),
    observation({
      modalPrice: 200000,
      unit: 'RUPEES_PER_TONNE',
      unitLabel: 'INR per tonne',
    }),
  ]);

  assert.ok(summary);
  assert.equal(summary.count, 1);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.averageModalPrice, 2000);
  assert.equal(summary.mixedUnits, true);
});

test('a comparison needs a crop', () => {
  assert.equal(compareMarkets([observation()], '  '), null);
});

test('the comparison keeps the newest price of every market', () => {
  const comparison = compareMarkets(
    [
      observation({ observedAt: '2026-01-05', modalPrice: 2000 }),
      observation({ observedAt: '2026-01-09', modalPrice: 2400 }),
      observation({
        market: {
          slug: 'kolhapur-apmc-maharashtra',
          name: 'Kolhapur APMC',
          state: 'Maharashtra',
          district: 'Kolhapur',
          locality: null,
        },
        observedAt: '2026-01-09',
        modalPrice: 2600,
      }),
    ],
    'wheat',
  );

  assert.ok(comparison);
  assert.equal(comparison.rows.length, 2);
  assert.equal(comparison.rows[0].marketName, 'Kolhapur APMC');
  assert.equal(comparison.rows[0].modalPrice, 2600);
  assert.equal(comparison.rows[1].modalPrice, 2400);
});

test('the comparison ignores observations of another crop', () => {
  const comparison = compareMarkets(
    [
      observation(),
      observation({
        crop: { slug: 'onion', name: 'Onion', variety: null, grade: null },
      }),
    ],
    'wheat',
  );

  assert.ok(comparison);
  assert.equal(comparison.rows.length, 1);
  assert.equal(comparison.cropSlug, 'wheat');
});

test('chart points are produced for the crop and market that were asked for', () => {
  const points = toChartPoints(series(), {
    crop: 'wheat',
    market: 'nashik-apmc-maharashtra',
  });

  assert.equal(points.length, 2);
  assert.equal(points[0].observedAt, '2026-01-05');
  assert.equal(points[0].y, 2275);
  assert.ok(points[0].x < points[1].x);
});

test('a series for another crop is never drawn', () => {
  const points = toChartPoints(series(), {
    crop: 'onion',
    market: 'nashik-apmc-maharashtra',
  });

  assert.deepEqual(points, []);
});

test('a series for another market is never drawn', () => {
  const points = toChartPoints(series(), {
    crop: 'wheat',
    market: 'kolhapur-apmc-maharashtra',
  });

  assert.deepEqual(points, []);
});

test('a point with an unreadable date is skipped instead of guessed', () => {
  const broken = series({
    points: [
      {
        observedAt: 'not-a-date',
        minPrice: 1,
        maxPrice: 2,
        modalPrice: 3,
        dataStatus: 'DEMO',
        source: 'demo-seed',
      },
    ],
  });

  const points = toChartPoints(broken, {
    crop: 'wheat',
    market: 'nashik-apmc-maharashtra',
  });

  assert.deepEqual(points, []);
});

test('a typed crop name resolves to its catalogue slug', () => {
  const catalogue: CropDto[] = [
    { slug: 'wheat', name: 'Wheat', aliases: ['Gehun'], category: 'CEREAL', dataStatus: 'DEMO' },
  ];

  assert.equal(resolveCropSlug(catalogue, 'Wheat'), 'wheat');
  assert.equal(resolveCropSlug(catalogue, 'wheat'), 'wheat');
  assert.equal(resolveCropSlug(catalogue, 'Gehun'), 'wheat');
});

test('a crop that is not in the catalogue is passed through unchanged', () => {
  const catalogue: CropDto[] = [
    { slug: 'wheat', name: 'Wheat', aliases: [], category: 'CEREAL', dataStatus: 'DEMO' },
  ];

  assert.equal(resolveCropSlug(catalogue, 'Bajra'), 'Bajra');
  assert.equal(resolveCropSlug(catalogue, '  '), '');
});

test('a typed market name resolves to its market slug', () => {
  const markets: MarketDto[] = [
    {
      slug: 'nashik-apmc-maharashtra',
      name: 'Nashik APMC',
      state: 'Maharashtra',
      district: 'Nashik',
      locality: null,
      source: 'demo-seed',
      dataStatus: 'DEMO',
      isLive: false,
      hasVerifiedCoordinates: false,
      latestPrice: null,
    },
  ];

  assert.equal(resolveMarketSlug(markets, 'Nashik APMC'), 'nashik-apmc-maharashtra');
  assert.equal(resolveMarketSlug(markets, 'Unknown Market'), 'Unknown Market');
});

function market(slug: string, name: string, state: string, district: string): MarketDto {
  return {
    slug,
    name,
    state,
    district,
    locality: null,
    source: 'demo-seed',
    dataStatus: 'DEMO',
    isLive: false,
    hasVerifiedCoordinates: false,
    latestPrice: null,
  };
}

const ALL_MARKETS: MarketDto[] = [
  market('nashik-apmc-maharashtra', 'Nashik APMC', 'Maharashtra', 'Nashik'),
  market('kolhapur-apmc-maharashtra', 'Kolhapur APMC', 'Maharashtra', 'Kolhapur'),
  market('ludhiana-mandi-punjab', 'Ludhiana Mandi', 'Punjab', 'Ludhiana'),
];

test('the state filter offers every state the markets are in', () => {
  assert.deepEqual(stateOptions(ALL_MARKETS), ['Maharashtra', 'Punjab']);
});

test('choosing a state does not remove the other states from the filter', () => {
  // The options are built from the whole market list, so the farmer can
  // switch to another state without clearing the filter first.
  assert.deepEqual(stateOptions(ALL_MARKETS), ['Maharashtra', 'Punjab']);
});

test('the district filter follows the chosen state', () => {
  assert.deepEqual(districtOptions(ALL_MARKETS, 'Maharashtra'), ['Kolhapur', 'Nashik']);
  assert.deepEqual(districtOptions(ALL_MARKETS, 'Punjab'), ['Ludhiana']);
  assert.deepEqual(districtOptions(ALL_MARKETS, ''), ['Kolhapur', 'Ludhiana', 'Nashik']);
});

test('the relevant markets are the ones in the chosen place', () => {
  assert.equal(relevantMarkets(ALL_MARKETS, { state: '', district: '' }).length, 3);
  assert.equal(
    relevantMarkets(ALL_MARKETS, { state: 'Maharashtra', district: '' }).length,
    2,
  );
  assert.equal(
    relevantMarkets(ALL_MARKETS, { state: 'Maharashtra', district: 'Nashik' }).length,
    1,
  );
  assert.equal(
    relevantMarkets(ALL_MARKETS, { state: 'Maharashtra', district: 'Nashik' })[0].name,
    'Nashik APMC',
  );
});

test('the crops on screen are listed once each', () => {
  const crops = distinctCrops([
    observation(),
    observation(),
    observation({ crop: { slug: 'onion', name: 'Onion', variety: null, grade: null } }),
  ]);

  assert.equal(crops.length, 2);
  assert.equal(crops[0].name, 'Onion');
  assert.equal(crops[1].name, 'Wheat');
});

test('prices and dates are formatted for the farmer', () => {
  assert.equal(formatInr(2275), '₹2,275');
  assert.equal(formatObservationDate('2026-01-11'), '11 Jan 2026');
  assert.equal(formatDateRange('2026-01-05', '2026-01-11'), '5 Jan 2026 to 11 Jan 2026');
  assert.equal(formatDateRange('', ''), 'all recorded dates');
});
