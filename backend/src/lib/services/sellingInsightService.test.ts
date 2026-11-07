/*
 * Tests for the selling-period insight module.
 *
 * The wording is the product here, so these tests check that the result is
 * careful: it explains what was observed, it separates the estimate from the
 * observation, and it never promises a price, a profit, or a selling date.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ForecastDto } from './forecastService.ts';
import type { TrendAnalysisDto } from './trendAnalysisService.ts';
import {
  buildSellingInsights,
  type SellingInsightsDto,
} from './sellingInsightService.ts';

const SUBJECT = {
  crop: { slug: 'wheat', name: 'Wheat' },
  market: {
    slug: 'nashik-apmc-maharashtra',
    name: 'Nashik APMC',
    state: 'Maharashtra',
    district: 'Nashik',
  },
};

function trend(overrides: Partial<TrendAnalysisDto> = {}): TrendAnalysisDto {
  return {
    direction: 'rising',
    metric: 'MODAL_PRICE',
    summary: 'The observed modal price at Nashik APMC went up, from 2000 to 2300.',
    reason: null,
    observationCount: 7,
    distinctDates: 7,
    period: { from: '2026-01-05', to: '2026-01-11', days: 7 },
    unit: 'RUPEES_PER_QUINTAL',
    unitLabel: 'INR per quintal',
    currency: 'INR',
    firstPrice: 2000,
    lastPrice: 2300,
    meanPrice: 2150,
    changePercent: 15,
    dataStatus: 'DEMO',
    isDemoData: true,
    source: 'demo-seed',
    method: 'A straight line is fitted.',
    ...overrides,
  };
}

function forecast(overrides: Partial<ForecastDto> = {}): ForecastDto {
  return {
    status: 'ok',
    metric: 'MODAL_PRICE',
    isObserved: false,
    pointEstimate: 2400,
    lowerBound: 2300,
    upperBound: 2500,
    unit: 'RUPEES_PER_QUINTAL',
    unitLabel: 'INR per quintal',
    currency: 'INR',
    horizonDays: 7,
    horizonLabel: '7 days ahead',
    evidence: {
      from: '2026-01-05',
      to: '2026-01-11',
      observations: 7,
      distinctDates: 7,
      coverageDays: 7,
      droppedObservations: 0,
    },
    dataQuality: 'low',
    dataStatus: 'DEMO',
    isDemoData: true,
    source: 'demo-seed',
    method: 'A straight line is fitted.',
    reason: null,
    ...overrides,
  };
}

/** Every sentence the result shows, joined for the wording checks. */
function allText(result: SellingInsightsDto): string {
  return [
    result.summary,
    ...result.points,
    ...result.caveats,
    result.narrative ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

test('a rising trend is summarised in plain language', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend(),
    forecast: forecast(),
    dataStatus: 'DEMO',
    isDemoData: true,
  });

  assert.equal(result.status, 'available');
  assert.match(result.summary, /were rising/);
  assert.match(result.summary, /not a promise/i);
});

test('the estimate is shown separately from the observed prices', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend(),
    forecast: forecast(),
    dataStatus: 'DEMO',
    isDemoData: true,
  });

  assert.ok(result.observedTrend);
  assert.ok(result.forecast);
  assert.ok(result.points.some((point) => point.includes('2400')));
  assert.ok(result.points.some((point) => point.includes('estimate')));
  assert.ok(result.caveats.some((caveat) => caveat.includes('not a market prediction')));
});

test('no estimate is claimed when the forecast is insufficient', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend(),
    forecast: forecast({
      status: 'insufficient_data',
      pointEstimate: null,
      lowerBound: null,
      upperBound: null,
      reason: 'There is not enough observed history to estimate a future price.',
    }),
    dataStatus: 'DEMO',
    isDemoData: true,
  });

  assert.ok(result.points.some((point) => point.includes('not enough observed history')));
  assert.ok(!allText(result).includes('2400'));
});

test('a trend that could not be calculated is reported as insufficient data', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend({
      direction: 'insufficient_data',
      summary: 'Not enough observations to say which way the prices moved.',
      reason: 'Only 1 daily observation was available.',
      observationCount: 1,
      period: null,
    }),
    forecast: forecast({ status: 'insufficient_data' }),
    dataStatus: 'DEMO',
    isDemoData: true,
  });

  assert.equal(result.status, 'insufficient_data');
  assert.ok(result.points.some((point) => point.includes('Only 1 daily observation')));
});

test('a provider failure explains itself instead of showing an empty result', () => {
  const result = buildSellingInsights({
    subject: { crop: SUBJECT.crop, market: null },
    trend: null,
    forecast: null,
    dataStatus: 'UNAVAILABLE',
    isDemoData: false,
    unavailableReason: 'The mandi data provider is currently unavailable.',
  });

  assert.equal(result.status, 'insufficient_data');
  assert.ok(result.points.some((point) => point.includes('currently unavailable')));
});

test('demo data is always labelled in the caveats', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend(),
    forecast: forecast(),
    dataStatus: 'DEMO',
    isDemoData: true,
  });

  assert.ok(result.caveats.some((caveat) => caveat.includes('demonstration data')));
});

test('the result never promises a price, a profit, or a selling date', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend(),
    forecast: forecast(),
    dataStatus: 'DEMO',
    isDemoData: true,
  });

  const text = allText(result);
  for (const forbidden of [
    'guarantee',
    'guaranteed',
    'you will profit',
    'best day to sell',
    'sell on',
    'risk-free',
    'assured',
  ]) {
    assert.ok(!text.includes(forbidden), 'unexpected promise: ' + forbidden);
  }
});

test('a falling trend does not tell a farmer to wait', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend({ direction: 'falling' }),
    forecast: forecast(),
    dataStatus: 'DEMO',
    isDemoData: true,
  });

  assert.match(result.summary, /were falling/);
  assert.ok(result.points.some((point) => point.includes('not a good reason to delay')));
});

test('the AI narrative is added but never replaces the deterministic text', () => {
  const result = buildSellingInsights({
    subject: SUBJECT,
    trend: trend(),
    forecast: forecast(),
    dataStatus: 'DEMO',
    isDemoData: true,
    narrative: 'Prices have been moving up in this market lately.',
  });

  assert.equal(result.narrative, 'Prices have been moving up in this market lately.');
  assert.match(result.summary, /were rising/);
  assert.ok(result.points.length > 0);
});
