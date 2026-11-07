/*
 * Tests for the wording helpers behind the analysis panels.
 *
 * They run on the plain Node test runner, the same way the backend tests
 * do, so the labels the farmer reads are checked without a browser.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analysisStatusLabel,
  confidenceLabel,
  forecastRangeLabel,
  periodLabel,
  qualityLabel,
  scoreLabel,
  trendLabel,
} from './analysisPresentation.ts';
import type { ForecastDto } from './farmProfileApi.ts';

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

test('the confidence labels are readable without a legend', () => {
  assert.equal(confidenceLabel('high'), 'Well matched');
  assert.equal(confidenceLabel('medium'), 'Partly checked');
  assert.equal(confidenceLabel('low'), 'Barely checked');
});

test('the trend label always names the direction in words', () => {
  assert.equal(trendLabel('rising'), 'Rising');
  assert.equal(trendLabel('falling'), 'Falling');
  assert.equal(trendLabel('stable'), 'Steady');
  assert.equal(trendLabel('insufficient_data'), 'Not enough data');
});

test('the quality label names the evidence, not the certainty of the outcome', () => {
  assert.equal(qualityLabel('high'), 'Good evidence');
  assert.equal(qualityLabel('medium'), 'Fair evidence');
  assert.equal(qualityLabel('low'), 'Weak evidence');
  assert.equal(qualityLabel(null), 'No estimate');
});

test('the score is written as a share of the rule', () => {
  assert.equal(scoreLabel(100), '100% of the rule matched');
  assert.equal(scoreLabel(75), '75% of the rule matched');
});

test('the estimated range carries the unit', () => {
  const label = forecastRangeLabel(forecast());
  assert.match(label, /2,300/);
  assert.match(label, /2,500/);
  assert.match(label, /INR per quintal/);
});

test('no range is shown when there is no estimate', () => {
  const label = forecastRangeLabel(
    forecast({ status: 'insufficient_data', pointEstimate: null, lowerBound: null, upperBound: null }),
  );
  assert.equal(label, 'Not enough data to estimate');
});

test('the period is shown as readable dates', () => {
  assert.match(periodLabel({ from: '2026-01-05', to: '2026-01-11' }), /5 Jan 2026/);
  assert.equal(periodLabel(null), 'no recorded period');
});

test('the analysis status is labelled in words', () => {
  assert.equal(analysisStatusLabel('computed'), 'Ready');
  assert.equal(analysisStatusLabel('partial'), 'Partly ready');
  assert.equal(analysisStatusLabel('unavailable'), 'Not available');
});
