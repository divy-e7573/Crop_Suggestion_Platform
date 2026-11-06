/*
 * The price-series contract used by the trend chart.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../api/errors.ts';
import { parseValue } from '../api/validation.ts';
import type { MandiPriceProvider, ProviderObservation } from '../providers/types.ts';
import {
  getPriceHistorySeries,
  priceHistoryQuerySchema,
} from './mandiService.ts';

function observation(
  overrides: Partial<ProviderObservation> = {},
): ProviderObservation {
  return {
    cropSlug: 'wheat',
    cropName: 'Wheat',
    cropVariety: null,
    cropGrade: null,
    marketSlug: 'nashik-apmc-maharashtra',
    marketName: 'Nashik APMC',
    state: 'Maharashtra',
    district: 'Nashik',
    locality: null,
    observedAt: new Date('2026-01-05T00:00:00.000Z'),
    minPrice: 2000,
    maxPrice: 2400,
    modalPrice: 2200,
    unit: 'RUPEES_PER_QUINTAL',
    currency: 'INR',
    source: 'demo-seed',
    dataStatus: 'DEMO',
    fetchedAt: null,
    ...overrides,
  };
}

function fakeProvider(
  items: ProviderObservation[],
  overrides: Partial<MandiPriceProvider> = {},
): MandiPriceProvider {
  return {
    id: 'demo-seed',
    displayName: 'Seeded demonstration data',
    mode: 'demo',
    dataStatus: 'DEMO',
    isDemo: true,
    verifiedLive: false,
    configured: true,
    configurationIssue: null,
    sourceUrl: null,
    attribution: 'Demonstration records.',
    async listObservations() {
      return { items, total: items.length, truncated: false };
    },
    async listMarkets() {
      return { items: [], total: 0, truncated: false };
    },
    ...overrides,
  };
}

const query = parseValue(
  priceHistoryQuerySchema,
  { crop: 'wheat', market: 'nashik-apmc-maharashtra' },
  'query',
);

test('the crop and the market are both required', () => {
  for (const missing of ['crop', 'market']) {
    const payload: Record<string, unknown> = {
      crop: 'wheat',
      market: 'nashik-apmc-maharashtra',
    };
    delete payload[missing];

    assert.throws(
      () => parseValue(priceHistoryQuerySchema, payload, 'query'),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.deepEqual(
          (error.details ?? []).map((detail) => detail.field),
          [missing],
        );
        return true;
      },
    );
  }
});

test('the from date must not be after the to date', () => {
  assert.throws(
    () =>
      parseValue(
        priceHistoryQuerySchema,
        { crop: 'wheat', market: 'nashik', from: '2026-01-10', to: '2026-01-05' },
        'query',
      ),
    ValidationError,
  );
});

test('the series is ordered oldest first and states its metric and unit', async () => {
  const series = await getPriceHistorySeries(
    fakeProvider([
      observation({ observedAt: new Date('2026-01-07T00:00:00.000Z'), modalPrice: 2300 }),
      observation({ observedAt: new Date('2026-01-05T00:00:00.000Z'), modalPrice: 2200 }),
      observation({ observedAt: new Date('2026-01-06T00:00:00.000Z'), modalPrice: 2250 }),
    ]),
    query,
  );

  assert.equal(series.series.metric, 'MODAL_PRICE');
  assert.equal(series.series.unit, 'RUPEES_PER_QUINTAL');
  assert.equal(series.series.unitLabel, 'INR per quintal');
  assert.equal(series.series.currency, 'INR');
  assert.deepEqual(
    series.series.points.map((point) => point.observedAt),
    ['2026-01-05', '2026-01-06', '2026-01-07'],
  );
  assert.deepEqual(
    series.series.points.map((point) => point.modalPrice),
    [2200, 2250, 2300],
  );
  assert.equal(series.series.isComplete, true);
});

test('a different crop or market is dropped instead of joining the series', async () => {
  const series = await getPriceHistorySeries(
    fakeProvider([
      observation({ observedAt: new Date('2026-01-05T00:00:00.000Z') }),
      observation({
        observedAt: new Date('2026-01-06T00:00:00.000Z'),
        cropSlug: 'onion',
        cropName: 'Onion',
      }),
      observation({
        observedAt: new Date('2026-01-07T00:00:00.000Z'),
        marketSlug: 'kolhapur-apmc-maharashtra',
        marketName: 'Kolhapur APMC',
      }),
      observation({
        observedAt: new Date('2026-01-08T00:00:00.000Z'),
        unit: 'RUPEES_PER_KILOGRAM',
      }),
    ]),
    query,
  );

  assert.deepEqual(
    series.series.points.map((point) => point.observedAt),
    ['2026-01-05'],
  );
  assert.equal(series.series.crop.slug, 'wheat');
  assert.equal(series.series.market.slug, 'nashik-apmc-maharashtra');
});

test('an empty result is an empty series, not an error', async () => {
  const series = await getPriceHistorySeries(fakeProvider([]), query);

  assert.deepEqual(series.series.points, []);
  assert.equal(series.series.isComplete, true);
  assert.equal(series.series.crop.slug, 'wheat');
});

test('the series carries the data source block and the demo label', async () => {
  const series = await getPriceHistorySeries(
    fakeProvider([observation()]),
    query,
  );

  assert.equal(series.dataSource.isDemoData, true);
  assert.equal(series.dataSource.isLiveData, false);
  assert.equal(series.dataSource.dataStatus, 'DEMO');
  assert.ok(series.dataSource.notice.toLowerCase().includes('demonstration'));
  assert.equal(series.series.points[0]?.dataStatus, 'DEMO');
});

test('a provider that cannot run is never described as live', async () => {
  const series = await getPriceHistorySeries(
    fakeProvider([], {
      mode: 'live',
      isDemo: false,
      configured: false,
      dataStatus: 'LIVE',
    }),
    query,
  );

  assert.equal(series.dataSource.dataStatus, 'UNAVAILABLE');
  assert.equal(series.dataSource.isLiveData, false);
});

