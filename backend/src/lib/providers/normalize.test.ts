import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderInvalidResponseError } from './errors.ts';
import {
  buildMarketSlug,
  normalizeDataGovInRecord,
  parseDataGovInEnvelope,
  parsePrice,
  parseProviderDate,
  slugify,
} from './normalize.ts';

const options = {
  source: 'data-gov-in',
  dataStatus: 'LIVE' as const,
  fetchedAt: new Date('2026-10-28T04:00:00.000Z'),
};

test('slugify drops parenthetical qualifiers and keeps a stable key', () => {
  assert.equal(slugify('Wheat'), 'wheat');
  assert.equal(slugify('Bajra(Pearl Millet/Cumbu)'), 'bajra');
  assert.equal(slugify('Bhindi(Ladies Finger)'), 'bhindi');
  assert.equal(slugify('  Lasalgaon  APMC '), 'lasalgaon-apmc');
});

test('buildMarketSlug combines the market name and its state', () => {
  assert.equal(buildMarketSlug('Lashkar APMC', 'Madhya Pradesh'), 'lashkar-apmc-madhya-pradesh');
});

test('parseProviderDate understands the source format and ISO dates', () => {
  assert.equal(parseProviderDate('28/10/2026')?.toISOString(), '2026-10-28T00:00:00.000Z');
  assert.equal(parseProviderDate('2026-01-05')?.toISOString(), '2026-01-05T00:00:00.000Z');
  assert.equal(
    parseProviderDate('2026-10-28T09:15:00Z')?.toISOString(),
    '2026-10-28T00:00:00.000Z',
  );
});

test('parseProviderDate rejects impossible and unreadable dates', () => {
  assert.equal(parseProviderDate('31/02/2026'), null);
  assert.equal(parseProviderDate('28/13/2026'), null);
  assert.equal(parseProviderDate('not-a-date'), null);
  assert.equal(parseProviderDate(''), null);
});

test('parsePrice accepts numbers and numeric strings and rejects the rest', () => {
  assert.equal(parsePrice(2495), 2495);
  assert.equal(parsePrice('2,495.50'), 2495.5);
  assert.equal(parsePrice('-1'), null);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice(null), null);
  assert.equal(parsePrice('abc'), null);
});

test('parseDataGovInEnvelope returns the records and the source total', () => {
  const envelope = parseDataGovInEnvelope({
    status: 'ok',
    total: '42',
    count: 1,
    records: [{ commodity: 'Wheat' }],
  });
  assert.equal(envelope.total, 42);
  assert.equal(envelope.records.length, 1);
});

test('parseDataGovInEnvelope rejects an error status and a broken payload', () => {
  assert.throws(
    () => parseDataGovInEnvelope({ status: 'error', message: 'Invalid Catalog id' }),
    ProviderInvalidResponseError,
  );
  assert.throws(() => parseDataGovInEnvelope({ status: 'ok' }), ProviderInvalidResponseError);
  assert.throws(() => parseDataGovInEnvelope('nonsense'), ProviderInvalidResponseError);
});

test('normalizeDataGovInRecord maps a verified upstream record', () => {
  const observation = normalizeDataGovInRecord(
    {
      state: 'Madhya Pradesh',
      district: 'Gwalior',
      market: 'Lashkar APMC',
      commodity: 'Wheat',
      variety: 'Sharbati',
      grade: 'FAQ',
      arrival_date: '28/10/2026',
      min_price: 2495,
      max_price: 2510,
      modal_price: 2510,
    },
    options,
  );

  assert.ok(observation);
  assert.equal(observation.cropSlug, 'wheat');
  assert.equal(observation.cropName, 'Wheat');
  assert.equal(observation.marketSlug, 'lashkar-apmc-madhya-pradesh');
  assert.equal(observation.state, 'Madhya Pradesh');
  assert.equal(observation.observedAt.toISOString(), '2026-10-28T00:00:00.000Z');
  assert.equal(observation.minPrice, 2495);
  assert.equal(observation.maxPrice, 2510);
  assert.equal(observation.modalPrice, 2510);
  assert.equal(observation.unit, 'RUPEES_PER_QUINTAL');
  assert.equal(observation.currency, 'INR');
  assert.equal(observation.source, 'data-gov-in');
  assert.equal(observation.dataStatus, 'LIVE');
});

test('normalizeDataGovInRecord drops records it cannot trust', () => {
  const base = {
    state: 'Madhya Pradesh',
    district: 'Gwalior',
    market: 'Lashkar APMC',
    commodity: 'Wheat',
    arrival_date: '28/10/2026',
    min_price: 2495,
    max_price: 2510,
    modal_price: 2510,
  };

  const reject = (record: Record<string, unknown>) =>
    assert.equal(normalizeDataGovInRecord(record, options), null);

  reject({ ...base, state: '' });
  reject({ ...base, market: undefined });
  reject({ ...base, arrival_date: '31/02/2026' });
  reject({ ...base, min_price: 'n/a' });
  reject({ ...base, modal_price: undefined });
  // A minimum above the maximum is impossible.
  reject({ ...base, min_price: 3000, max_price: 2510 });
  reject({ ...base, min_price: -5 });
});
