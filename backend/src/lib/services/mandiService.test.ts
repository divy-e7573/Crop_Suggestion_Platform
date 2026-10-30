import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../api/errors.ts';
import { parseValue } from '../api/validation.ts';
import { ProviderNotConfiguredError, ProviderUnavailableError } from '../providers/errors.ts';
import type { MandiPriceProvider, ProviderObservation } from '../providers/types.ts';
import {
  buildDataSource,
  listMandiPrices,
  marketQuerySchema,
  priceQuerySchema,
} from './mandiService.ts';

function observation(overrides: Partial<ProviderObservation> = {}): ProviderObservation {
  return {
    cropSlug: 'wheat',
    cropName: 'Wheat',
    cropVariety: null,
    cropGrade: null,
    marketSlug: 'nashik-apmc-maharashtra',
    marketName: 'Nashik APMC',
    state: 'Maharashtra',
    district: 'Nashik',
    locality: 'Pimpalgaon',
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

function fakeProvider(overrides: Partial<MandiPriceProvider> = {}): MandiPriceProvider {
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
      return { items: [observation()], total: 1, truncated: false };
    },
    async listMarkets() {
      return { items: [], total: 0, truncated: false };
    },
    ...overrides,
  };
}

test('the price query accepts the documented filters and bounds the page', () => {
  const parsed = parseValue(priceQuerySchema, {
    crop: 'wheat',
    state: 'Maharashtra',
    from: '2026-01-05',
    to: '2026-01-11',
    limit: '10',
    offset: '5',
  });

  assert.equal(parsed.crop, 'wheat');
  assert.equal(parsed.state, 'Maharashtra');
  assert.equal(parsed.from?.toISOString(), '2026-01-05T00:00:00.000Z');
  assert.equal(parsed.to?.toISOString(), '2026-01-11T00:00:00.000Z');
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.offset, 5);
});

test('the price query applies its default page size', () => {
  const parsed = parseValue(priceQuerySchema, {});
  assert.equal(parsed.limit, 25);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.crop, undefined);
});

test('the price query rejects bad dates, reversed ranges and oversized pages', () => {
  const reject = (value: Record<string, string>) => {
    assert.throws(() => parseValue(priceQuerySchema, value), ValidationError);
  };

  reject({ from: '05-01-2026' });
  reject({ from: '2026-02-30' });
  reject({ from: '2026-01-11', to: '2026-01-05' });
  reject({ limit: '5000' });
  reject({ limit: 'abc' });
  reject({ offset: '-1' });
});

test('the market query accepts a state and district filter', () => {
  const parsed = parseValue(marketQuerySchema, { state: 'Punjab', district: 'Ludhiana' });
  assert.equal(parsed.state, 'Punjab');
  assert.equal(parsed.district, 'Ludhiana');
  assert.equal(parsed.limit, 25);
});

test('the price list marks demo data as demo data', async () => {
  const result = await listMandiPrices(fakeProvider(), parseValue(priceQuerySchema, {}));

  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]!.dataStatus, 'DEMO');
  assert.equal(result.observations[0]!.isLive, false);
  assert.equal(result.observations[0]!.source, 'demo-seed');
  assert.equal(result.observations[0]!.unitLabel, 'INR per quintal');
  assert.equal(result.observations[0]!.currency, 'INR');
  assert.equal(result.observations[0]!.observedAt, '2026-01-05');

  assert.equal(result.dataSource.isDemoData, true);
  assert.equal(result.dataSource.isLiveData, false);
  assert.equal(result.dataSource.label, 'Demo data');
  assert.equal(result.pagination.returned, 1);
  assert.equal(result.pagination.total, 1);
});

test('a live record is marked live and the data source says so', async () => {
  const provider = fakeProvider({
    id: 'data-gov-in',
    mode: 'live',
    isDemo: false,
    verifiedLive: true,
    dataStatus: 'LIVE',
    async listObservations() {
      return {
        items: [observation({ source: 'data-gov-in', dataStatus: 'LIVE', fetchedAt: new Date() })],
        total: 1,
        truncated: false,
      };
    },
  });

  const result = await listMandiPrices(provider, parseValue(priceQuerySchema, {}));
  assert.equal(result.observations[0]!.isLive, true);
  assert.equal(result.dataSource.isLiveData, true);
  assert.equal(result.dataSource.isDemoData, false);
  assert.equal(result.dataSource.label, 'Live (verified source)');
});

test('a provider failure becomes a safe API error and never demo rows', async () => {
  const provider = fakeProvider({
    async listObservations() {
      throw new ProviderUnavailableError('The mandi data provider could not be reached: timeout');
    },
  });

  await assert.rejects(
    () => listMandiPrices(provider, parseValue(priceQuerySchema, {})),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as { status?: number }).status, 503);
      assert.equal((error as { code?: string }).code, 'PROVIDER_UNAVAILABLE');
      assert.ok(!(error as Error).message.includes('timeout'));
      return true;
    },
  );
});

test('the data source block never calls demo data live', () => {
  const block = buildDataSource(fakeProvider());
  assert.equal(block.isLiveData, false);
  assert.equal(block.dataStatus, 'DEMO');
  assert.ok(block.notice.toLowerCase().includes('demonstration'));
});

test('a provider that cannot run is reported as unavailable, not live', () => {
  const provider = fakeProvider({
    id: 'data-gov-in',
    mode: 'live',
    isDemo: false,
    configured: false,
    configurationIssue: 'MANDI_PROVIDER_API_KEY is not set.',
  });

  const block = buildDataSource(provider);
  assert.equal(block.dataStatus, 'UNAVAILABLE');
  assert.equal(block.isLiveData, false);
  assert.equal(block.label, 'Unavailable');
  assert.ok(block.notice.includes('MANDI_PROVIDER_API_KEY'));
});

test('an unconfigured provider produces a 503 that never falls back to demo rows', async () => {
  const provider = fakeProvider({
    async listObservations() {
      throw new ProviderNotConfiguredError('MANDI_PROVIDER_API_KEY is not set.');
    },
  });

  await assert.rejects(
    () => listMandiPrices(provider, parseValue(priceQuerySchema, {})),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as { status?: number }).status, 503);
      assert.equal((error as { code?: string }).code, 'PROVIDER_NOT_CONFIGURED');
      return true;
    },
  );
});
