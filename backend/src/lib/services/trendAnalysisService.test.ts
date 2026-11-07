/*
 * Tests for the observed price-trend module.
 *
 * The module is pure, so these tests use hand-built observations. They cover
 * the four directions, duplicate dates, missing values, and the rule that
 * two crops, two markets, or two units are never mixed into one line.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyseTrend,
  buildDailySeries,
  type TrendObservation,
} from './trendAnalysisService.ts';

const SCOPE = {
  cropSlug: 'wheat',
  marketSlug: 'nashik-apmc-maharashtra',
  unit: 'RUPEES_PER_QUINTAL',
} as const;

function observation(overrides: Partial<TrendObservation> = {}): TrendObservation {
  return {
    cropSlug: 'wheat',
    marketSlug: 'nashik-apmc-maharashtra',
    observedAt: new Date('2026-01-05T00:00:00.000Z'),
    modalPrice: 2000,
    unit: 'RUPEES_PER_QUINTAL',
    dataStatus: 'DEMO',
    source: 'demo-seed',
    ...overrides,
  };
}

/** A series of one observation per day, oldest first. */
function series(prices: number[], startDay = 5): TrendObservation[] {
  return prices.map((price, index) =>
    observation({
      observedAt: new Date(
        Date.UTC(2026, 0, startDay + index, 0, 0, 0, 0),
      ),
      modalPrice: price,
    }),
  );
}

test('a series that goes up is reported as rising', () => {
  const result = analyseTrend(series([2000, 2100, 2200, 2300]), SCOPE, 'Nashik APMC');

  assert.equal(result.direction, 'rising');
  assert.equal(result.observationCount, 4);
  assert.equal(result.firstPrice, 2000);
  assert.equal(result.lastPrice, 2300);
  assert.match(result.summary, /went up/);
});

test('a series that goes down is reported as falling', () => {
  const result = analyseTrend(series([2300, 2200, 2100, 2000]), SCOPE, 'Nashik APMC');

  assert.equal(result.direction, 'falling');
  assert.match(result.summary, /went down/);
});

test('a series that barely moves is reported as stable', () => {
  const result = analyseTrend(series([2000, 2005, 1998, 2002]), SCOPE, 'Nashik APMC');

  assert.equal(result.direction, 'stable');
  assert.match(result.summary, /stayed roughly the same/);
});

test('fewer than three observations are reported as insufficient data', () => {
  const result = analyseTrend(series([2000, 2100]), SCOPE, 'Nashik APMC');

  assert.equal(result.direction, 'insufficient_data');
  assert.equal(result.observationCount, 2);
  assert.match(result.reason ?? '', /at least 3 observations/i);
  assert.equal(result.period, null);
});

test('observations on the same date are averaged into one point', () => {
  const daily = buildDailySeries(
    [
      observation({ modalPrice: 2000 }),
      observation({ modalPrice: 2200 }),
      observation({ observedAt: new Date('2026-01-06T00:00:00.000Z'), modalPrice: 2100 }),
      observation({ observedAt: new Date('2026-01-07T00:00:00.000Z'), modalPrice: 2150 }),
    ],
    SCOPE,
  );

  assert.equal(daily.length, 3);
  assert.equal(daily[0].price, 2100);
  assert.equal(daily[0].date, '2026-01-05');
});

test('a duplicate date does not make a short series look long enough', () => {
  const result = analyseTrend(
    [
      observation({ modalPrice: 2000 }),
      observation({ modalPrice: 2100 }),
      observation({
        observedAt: new Date('2026-01-06T00:00:00.000Z'),
        modalPrice: 2200,
      }),
    ],
    SCOPE,
  );

  assert.equal(result.direction, 'insufficient_data');
  assert.equal(result.observationCount, 2);
});

test('another crop, another market, or another unit is never mixed in', () => {
  const result = analyseTrend(
    [
      ...series([2000, 2100, 2200]),
      observation({ cropSlug: 'rice', modalPrice: 9000 }),
      observation({ marketSlug: 'kolhapur-apmc-maharashtra', modalPrice: 9000 }),
      observation({ unit: 'RUPEES_PER_TONNE', modalPrice: 20000 }),
    ],
    SCOPE,
  );

  assert.equal(result.observationCount, 3);
  assert.equal(result.meanPrice, 2100);
});

test('an impossible or missing price is dropped rather than used', () => {
  const result = analyseTrend(
    [
      ...series([2000, 2100, 2200]),
      observation({ modalPrice: 0 }),
      observation({ modalPrice: Number.NaN }),
    ],
    SCOPE,
  );

  assert.equal(result.observationCount, 3);
});

test('the demo status is kept so seeded rows are never shown as live', () => {
  const demo = analyseTrend(series([2000, 2100, 2200]), SCOPE);
  assert.equal(demo.dataStatus, 'DEMO');
  assert.equal(demo.isDemoData, true);

  const live = analyseTrend(
    series([2000, 2100, 2200]).map((item) => ({
      ...item,
      dataStatus: 'LIVE' as const,
      source: 'data-gov-in',
    })),
    SCOPE,
  );
  assert.equal(live.dataStatus, 'LIVE');
  assert.equal(live.isDemoData, false);
  assert.equal(live.source, 'data-gov-in');
});

test('a part of the series that came from the cache is not called live', () => {
  const mixed = series([2000, 2100, 2200]).map((item, index) =>
    (index === 0
      ? { ...item, dataStatus: 'RECENT' as const, source: 'data-gov-in' }
      : { ...item, dataStatus: 'LIVE' as const, source: 'data-gov-in' }),
  );

  const result = analyseTrend(mixed, SCOPE);

  assert.equal(result.dataStatus, 'RECENT');
  assert.equal(result.isDemoData, false);
});

test('a seeded row is never labelled live, whatever else is in the series', () => {
  const mixed = series([2000, 2100, 2200]).map((item, index) =>
    (index === 0
      ? { ...item, dataStatus: 'LIVE' as const, source: 'data-gov-in' }
      : item),
  );

  const result = analyseTrend(mixed, SCOPE);

  assert.equal(result.dataStatus, 'DEMO');
  assert.equal(result.isDemoData, true);
});

test('the observed period and the number of observations are reported', () => {
  const result = analyseTrend(series([2000, 2100, 2200, 2300]), SCOPE);

  assert.deepEqual(result.period, { from: '2026-01-05', to: '2026-01-08', days: 4 });
  assert.equal(result.observationCount, 4);
  assert.equal(result.distinctDates, 4);
});

test('the method is reported so the result can be checked', () => {
  const result = analyseTrend(series([2000, 2100, 2200]), SCOPE);

  assert.match(result.method, /least squares/i);
  assert.match(result.method, /insufficient data/i);
});
