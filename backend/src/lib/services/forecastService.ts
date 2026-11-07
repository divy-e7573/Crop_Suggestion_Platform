/**
 * The forecast eligibility check and the baseline forecast (PRD FR-07).
 *
 * Two rules govern this module:
 *
 * 1. A number is only produced when the observations clear a documented
    threshold. When they do not, the result is insufficient_data with the
    reason, and never a made-up estimate.
 * 2. The number is a simple, explainable baseline, not a machine-learning
    model. A straight line is fitted to the daily prices and read a week
    ahead of the last observation.
 *
 * The threshold, in full:
 *
 * - At least 7 observations.
 * - At least 5 different observation dates.
 * - At least 7 calendar days of history, counting the first and the last day.
 * - Exactly one crop, one market, and one price unit. Observations that do
 *   not match are dropped before the threshold is checked, and the number of
 *   dropped rows is reported.
 *
 * The seeded demonstration data covers 7 days, so it clears the threshold
 * and produces a forecast that is labelled low quality. The official
 * data.gov.in feed publishes only the current day for a given market, so a
 * live series usually holds a single observation and does not clear it.
 */

import { PRICE_UNIT_LABELS, type DataStatusValue, type PriceUnitValue } from '../providers/types.ts';
import {
  buildDailySeries,
  dataStatusFor,
  daysBetween,
  selectUsableObservations,
  type TrendObservation,
} from './trendAnalysisService.ts';
import { leastSquares, roundTo, type SeriesPoint } from './priceStatistics.ts';

/** The fewest observations a forecast may be calculated from. */
export const FORECAST_MIN_OBSERVATIONS = 7;

/** The fewest different dates a forecast may be calculated from. */
export const FORECAST_MIN_DISTINCT_DATES = 5;

/** The fewest calendar days of history a forecast may be calculated from. */
export const FORECAST_MIN_COVERAGE_DAYS = 7;

/** How far ahead the baseline looks, in days. */
export const FORECAST_HORIZON_DAYS = 7;

/**
 * The multiplier used for the range around the estimate.
 *
 * 1.2816 is the two-sided 80 percent normal multiplier. It is used to
 * scale the standard error of the fit, which makes the range a description
 * of how far the observed prices normally sat from the fitted line. It is
 * **not** a calibrated prediction interval: the uncertainty of the fitted
 * line itself is not included, and the range does not widen the further
 * the line is read beyond the last observation. It is a rough guide, and
 * the method string says so (Phase 9 terminology review).
 */
export const FORECAST_BAND_MULTIPLIER = 1.2816;

/** How much the evidence behind a forecast can be trusted. */
export type ForecastDataQuality = 'low' | 'medium' | 'high';

/** The observations the forecast was built from. */
export type ForecastEvidence = {
  /** The first observation date, as yyyy-mm-dd. */
  from: string;
  /** The last observation date, as yyyy-mm-dd. */
  to: string;
  /** How many observations were used. */
  observations: number;
  /** How many different dates they covered. */
  distinctDates: number;
  /** How many calendar days the period spans, counting both ends. */
  coverageDays: number;
  /** How many observations were dropped for belonging to another crop, market, or unit. */
  droppedObservations: number;
};

/** The result of the forecast. */
export type ForecastDto = {
  status: 'ok' | 'insufficient_data';
  /** The price field the forecast is about. */
  metric: 'MODAL_PRICE';
  /** Always false. A forecast is never an observed price. */
  isObserved: false;
  /** The single best guess, which is the fitted line read at the horizon. */
  pointEstimate: number | null;
  /** The lower end of the approximate range. */
  lowerBound: number | null;
  /** The upper end of the approximate range. */
  upperBound: number | null;
  unit: PriceUnitValue;
  unitLabel: string;
  currency: 'INR';
  /** How far ahead the estimate looks, in days. */
  horizonDays: number;
  /** The same horizon in words, for the interface. */
  horizonLabel: string;
  /** The observations the estimate was built from. */
  evidence: ForecastEvidence | null;
  /** How much the evidence can be trusted. */
  dataQuality: ForecastDataQuality | null;
  dataStatus: DataStatusValue;
  isDemoData: boolean;
  source: string;
  /** The calculation and its assumptions, shown so it can be checked. */
  method: string;
  /** Why no estimate was produced, when none was. */
  reason: string | null;
};

/** The method, kept in one place so the API and the UI agree. */
export const FORECAST_METHOD =
  'A straight line is fitted by least squares to the daily modal prices of one crop ' +
  'at one market in one unit, and the line is read 7 days beyond the last observation. ' +
  'The range around it is the estimate plus or minus 1.28 times the standard error ' +
  'of the fit, which is the typical day-to-day spread of the observed prices ' +
  'around that line. It shows how much the observed prices normally moved around ' +
  'the line, and it is not a calibrated prediction interval: it does not include ' +
  'the uncertainty of the fitted line itself, and it does not widen with the ' +
  'distance the line is read beyond the last observation, so it is a rough guide ' +
  'rather than a bound. The lower end is never allowed below zero, because a ' +
  'price cannot be negative. The evidence label is low with fewer than 14 ' +
  'observations, fewer than 7 days of history, or a fit that explains under 30 ' +
  'percent of the variation; medium with fewer than 30 observations or a fit under ' +
  '60 percent; high otherwise. The label describes how much and how good the ' +
  'evidence is, not how certain the estimate is. An estimate is produced only ' +
  'with at least 7 observations on at least 5 different dates covering at least 7 ' +
  'days of one crop at one market in one unit.';

/** The scope of the series a forecast is calculated from. */
export type ForecastScope = {
  cropSlug: string;
  marketSlug: string;
  unit: PriceUnitValue;
};

/** Labels the data quality from the amount of evidence and the fit. */
export function dataQualityFor(
  observations: number,
  coverageDays: number,
  rSquared: number,
): ForecastDataQuality {
  if (observations < 14 || coverageDays < 7 || rSquared < 0.3) return 'low';
  if (observations < 30 || rSquared < 0.6) return 'medium';
  return 'high';
}

/**
 * Builds the forecast, or the reason there is not one.
 *
 * The observations are the only evidence. Nothing is extrapolated from a
 * market, a crop, or a period that was not observed.
 */
export function buildForecast(
  observations: TrendObservation[],
  scope: ForecastScope,
): ForecastDto {
  const unit = scope.unit;
  const unitLabel = PRICE_UNIT_LABELS[unit];

  const usable = selectUsableObservations(observations, scope);
  const series = buildDailySeries(usable, scope);

  // The label follows the observations that were really used, so a part of
  // the series that came from the provider cache is never called live.
  const dataStatus: DataStatusValue = dataStatusFor(usable);
  const source = usable[0]?.source ?? 'unknown';

  const evidence: ForecastEvidence | null =
    series.length > 0
      ? {
          from: series[0].date,
          to: series[series.length - 1].date,
          observations: usable.length,
          distinctDates: series.length,
          coverageDays: daysBetween(
            new Date(series[0].date + 'T00:00:00.000Z'),
            new Date(series[series.length - 1].date + 'T00:00:00.000Z'),
          ),
          droppedObservations: observations.length - usable.length,
        }
      : null;

  const shortfall: string[] = [];
  if (usable.length < FORECAST_MIN_OBSERVATIONS) {
    shortfall.push(
      usable.length +
        ' usable observations were found, and at least ' +
        FORECAST_MIN_OBSERVATIONS +
        ' are needed',
    );
  }
  if (series.length < FORECAST_MIN_DISTINCT_DATES) {
    shortfall.push(
      series.length +
        ' different dates were found, and at least ' +
        FORECAST_MIN_DISTINCT_DATES +
        ' are needed',
    );
  }
  if (evidence !== null && evidence.coverageDays < FORECAST_MIN_COVERAGE_DAYS) {
    shortfall.push(
      'the history covers ' +
        evidence.coverageDays +
        ' days, and at least ' +
        FORECAST_MIN_COVERAGE_DAYS +
        ' are needed',
    );
  }

  if (shortfall.length > 0 || evidence === null) {
    return {
      status: 'insufficient_data',
      metric: 'MODAL_PRICE',
      isObserved: false,
      pointEstimate: null,
      lowerBound: null,
      upperBound: null,
      unit,
      unitLabel,
      currency: 'INR',
      horizonDays: FORECAST_HORIZON_DAYS,
      horizonLabel: FORECAST_HORIZON_DAYS + ' days ahead',
      evidence,
      dataQuality: null,
      dataStatus,
      isDemoData: dataStatus === 'DEMO',
      source,
      method: FORECAST_METHOD,
      reason:
        'There is not enough observed history to estimate a future price: ' +
        (shortfall.length > 0 ? shortfall.join('; ') : 'no usable observations were found') +
        '. No estimate is shown rather than a guess.',
    };
  }

  const startDate = new Date(evidence.from + 'T00:00:00.000Z');
  const points: SeriesPoint[] = series.map((point) => ({
    x: Math.round(
      (new Date(point.date + 'T00:00:00.000Z').getTime() - startDate.getTime()) / 86_400_000,
    ),
    y: point.price,
  }));

  const fit = leastSquares(points);
  const horizonX = points[points.length - 1].x + FORECAST_HORIZON_DAYS;
  const pointEstimate = roundTo(fit.intercept + fit.slope * horizonX, 2);

  if (!Number.isFinite(pointEstimate) || pointEstimate <= 0) {
    return {
      status: 'insufficient_data',
      metric: 'MODAL_PRICE',
      isObserved: false,
      pointEstimate: null,
      lowerBound: null,
      upperBound: null,
      unit,
      unitLabel,
      currency: 'INR',
      horizonDays: FORECAST_HORIZON_DAYS,
      horizonLabel: FORECAST_HORIZON_DAYS + ' days ahead',
      evidence,
      dataQuality: null,
      dataStatus,
      isDemoData: dataStatus === 'DEMO',
      source,
      method: FORECAST_METHOD,
      reason:
        'The fitted line does not give a positive price for this period, so no estimate ' +
        'is shown rather than a number that cannot be right.',
    };
  }

  const band = roundTo(FORECAST_BAND_MULTIPLIER * fit.residualStandardError, 2);
  const lowerBound = Math.max(0, roundTo(pointEstimate - band, 2));
  const upperBound = roundTo(pointEstimate + band, 2);

  return {
    status: 'ok',
    metric: 'MODAL_PRICE',
    isObserved: false,
    pointEstimate,
    lowerBound,
    upperBound,
    unit,
    unitLabel,
    currency: 'INR',
    horizonDays: FORECAST_HORIZON_DAYS,
    horizonLabel: FORECAST_HORIZON_DAYS + ' days ahead',
    evidence,
    dataQuality: dataQualityFor(evidence.observations, evidence.coverageDays, fit.rSquared),
    dataStatus,
    isDemoData: dataStatus === 'DEMO',
    source,
    method: FORECAST_METHOD,
    reason: null,
  };
}
