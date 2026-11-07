/*
 * Tests for the forecast eligibility check and the baseline forecast.
 *
 * These tests pin down the rule that matters most: no number is produced
 * unless the observations clear the documented threshold.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORECAST_HORIZON_DAYS,
  FORECAST_MIN_COVERAGE_DAYS,
  FORECAST_MIN_DISTINCT_DATES,
  FORECAST_MIN_OBSERVATIONS,
  buildForecast,
} from './forecastService.ts';
import type { TrendObservation } from './trendAnalysisService.ts';

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

/** One observation per day, oldest first, starting on the given day. */
function series(prices: number[], startDay = 5): TrendObservation[] {
  return prices.map((price, index) =>
    observation({
      observedAt: new Date(Date.UTC(2026, 0, startDay + index, 0, 0, 0, 0)),
      modalPrice: price,
    }),
  );
}

test('the documented threshold is what the code uses', () => {
  assert.equal(FORECAST_MIN_OBSERVATIONS, 7);
  assert.equal(FORECAST_MIN_DISTINCT_DATES, 5);
  assert.equal(FORECAST_MIN_COVERAGE_DAYS, 7);
  assert.equal(FORECAST_HORIZON_DAYS, 7);
});

test('enough observations produce a baseline estimate with a range', () => {
  const result = buildForecast(series([2000, 2020, 2040, 2060, 2080, 2100, 2120]), SCOPE);

  assert.equal(result.status, 'ok');
  assert.equal(result.isObserved, false);
  assert.ok(result.pointEstimate !== null);
  assert.ok(result.lowerBound !== null);
  assert.ok(result.upperBound !== null);
  assert.ok(result.lowerBound! <= result.pointEstimate!);
  assert.ok(result.pointEstimate! <= result.upperBound!);
});

test('the estimate is read at the documented horizon and carries the unit', () => {
  const result = buildForecast(series([2000, 2020, 2040, 2060, 2080, 2100, 2120]), SCOPE);

  assert.equal(result.horizonDays, 7);
  assert.equal(result.unit, 'RUPEES_PER_QUINTAL');
  assert.equal(result.unitLabel, 'INR per quintal');
  assert.equal(result.currency, 'INR');
  assert.equal(result.metric, 'MODAL_PRICE');
});

test('the evidence behind the estimate is reported', () => {
  const result = buildForecast(series([2000, 2020, 2040, 2060, 2080, 2100, 2120]), SCOPE);

  assert.ok(result.evidence);
  assert.equal(result.evidence!.observations, 7);
  assert.equal(result.evidence!.distinctDates, 7);
  assert.equal(result.evidence!.coverageDays, 7);
  assert.equal(result.evidence!.from, '2026-01-05');
  assert.equal(result.evidence!.to, '2026-01-11');
});

test('too few observations produce no estimate and an explanation', () => {
  const result = buildForecast(series([2000, 2020, 2040, 2060, 2080, 2100]), SCOPE);

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.pointEstimate, null);
  assert.equal(result.lowerBound, null);
  assert.equal(result.upperBound, null);
  assert.match(result.reason ?? '', /not enough observed history/i);
  assert.match(result.reason ?? '', /usable observations were found/);
});

test('too few different dates produce no estimate', () => {
  const result = buildForecast(
    [
      observation({ modalPrice: 2000 }),
      observation({ modalPrice: 2010 }),
      observation({ modalPrice: 2020 }),
      observation({
        observedAt: new Date('2026-01-06T00:00:00.000Z'),
        modalPrice: 2030,
      }),
      observation({
        observedAt: new Date('2026-01-07T00:00:00.000Z'),
        modalPrice: 2040,
      }),
    ],
    SCOPE,
  );

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.pointEstimate, null);
  assert.match(result.reason ?? '', /different dates/);
});

test('too short a history produces no estimate', () => {
  const result = buildForecast(
    [
      observation({ modalPrice: 2000 }),
      observation({ modalPrice: 2010 }),
      observation({
        observedAt: new Date('2026-01-06T00:00:00.000Z'),
        modalPrice: 2020,
      }),
      observation({
        observedAt: new Date('2026-01-07T00:00:00.000Z'),
        modalPrice: 2030,
      }),
      observation({
        observedAt: new Date('2026-01-08T00:00:00.000Z'),
        modalPrice: 2040,
      }),
      observation({
        observedAt: new Date('2026-01-09T00:00:00.000Z'),
        modalPrice: 2050,
      }),
      observation({
        observedAt: new Date('2026-01-10T00:00:00.000Z'),
        modalPrice: 2060,
      }),
    ],
    SCOPE,
  );

  assert.equal(result.status, 'insufficient_data');
  assert.match(result.reason ?? '', /covers/);
});

test('a single live observation never produces an estimate', () => {
  const result = buildForecast(
    [
      observation({
        modalPrice: 2100,
        dataStatus: 'LIVE',
        source: 'data-gov-in',
      }),
    ],
    SCOPE,
  );

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.pointEstimate, null);
  assert.equal(result.dataStatus, 'LIVE');
  assert.equal(result.isDemoData, false);
});

test('the data quality label follows the amount of evidence', () => {
  const short = buildForecast(series([2000, 2020, 2040, 2060, 2080, 2100, 2120]), SCOPE);
  assert.equal(short.dataQuality, 'low');

  const medium = buildForecast(series(Array.from({ length: 20 }, (_, i) => 2000 + i * 10)), SCOPE);
  assert.equal(medium.dataQuality, 'medium');

  const high = buildForecast(series(Array.from({ length: 40 }, (_, i) => 2000 + i * 10)), SCOPE);
  assert.equal(high.dataQuality, 'high');
});

test('observations of another crop, market, or unit are dropped and counted', () => {
  const result = buildForecast(
    [
      ...series([2000, 2020, 2040, 2060, 2080, 2100, 2120]),
      observation({ cropSlug: 'rice', modalPrice: 9000 }),
      observation({ marketSlug: 'kolhapur-apmc-maharashtra', modalPrice: 9000 }),
      observation({ unit: 'RUPEES_PER_TONNE', modalPrice: 20000 }),
    ],
    SCOPE,
  );

  assert.equal(result.status, 'ok');
  assert.equal(result.evidence!.observations, 7);
  assert.equal(result.evidence!.droppedObservations, 3);
});

test('the estimate is never presented as an observed price', () => {
  const result = buildForecast(series([2000, 2020, 2040, 2060, 2080, 2100, 2120]), SCOPE);

  assert.equal(result.isObserved, false);
  assert.match(result.method, /straight line/i);
  assert.match(result.method, /not a guarantee/i);
});

test('the demo status is carried through so seeded data is never shown as live', () => {
  const result = buildForecast(series([2000, 2020, 2040, 2060, 2080, 2100, 2120]), SCOPE);

  assert.equal(result.dataStatus, 'DEMO');
  assert.equal(result.isDemoData, true);
  assert.equal(result.source, 'demo-seed');
});
