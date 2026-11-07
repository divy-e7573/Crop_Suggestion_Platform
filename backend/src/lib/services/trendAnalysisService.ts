/**
 * The observed price-trend module (PRD FR-07).
 *
 * It answers one question: what direction did the prices that were actually
 * observed move in, and how confident can we be? It never looks at a future
 * price, and it never mixes two crops, two markets, or two price units into
 * one line (PRD FR-04).
 *
 * Method, in full:
 *
 * 1. Only observations of the requested crop at the requested market and in
    the requested unit are kept. Anything else is dropped, not mixed in.
 * 2. Observations with a missing or impossible price are dropped.
 * 3. Observations recorded on the same date are averaged into one point, so
 *    a day that was reported twice cannot count twice.
 * 4. The points are sorted oldest first.
 * 5. A least-squares straight line is fitted to the daily prices.
 * 6. The change of that line across the observed period is compared with the
    mean price. A relative change below 2 percent is called stable; anything
    larger is reported as rising or falling in the direction of the line.
 * 7. Fewer than three points on three different dates is reported as
    insufficient data, because a two-day movement is not a trend.
 */

import { PRICE_UNIT_LABELS, type DataStatusValue, type PriceUnitValue } from '../providers/types.ts';
import { leastSquares, roundTo, type SeriesPoint } from './priceStatistics.ts';

/** The fewest points a direction may be calculated from. */
export const MIN_TREND_POINTS = 3;

/** The fewest different dates a direction may be calculated from. */
export const MIN_TREND_DISTINCT_DATES = 3;

/**
 * The relative change below which the movement is called stable.
 *
 * Two percent of the mean price is small enough that it is inside the daily
 * noise of a mandi, so it is reported as steady rather than as a move.
 */
export const STABLE_RELATIVE_CHANGE = 0.02;

/** The direction the observed prices moved in. */
export type TrendDirection = 'rising' | 'falling' | 'stable' | 'insufficient_data';

/** One observation, in the shape the trend module needs. */
export type TrendObservation = {
  cropSlug: string;
  marketSlug: string;
  observedAt: Date;
  modalPrice: number;
  unit: PriceUnitValue;
  dataStatus: DataStatusValue;
  source: string;
};

/** The period the observations cover. */
export type TrendPeriod = {
  /** The first observation date, as yyyy-mm-dd. */
  from: string;
  /** The last observation date, as yyyy-mm-dd. */
  to: string;
  /** The number of calendar days the period spans, counting both ends. */
  days: number;
};

/** The result of the trend analysis. */
export type TrendAnalysisDto = {
  direction: TrendDirection;
  /** The price field the trend was calculated from. */
  metric: 'MODAL_PRICE';
  /** One plain-language sentence describing the movement. */
  summary: string;
  /** Why there is no direction, when there is none. */
  reason: string | null;
  /** How many observations were used. */
  observationCount: number;
  /** How many different dates those observations covered. */
  distinctDates: number;
  period: TrendPeriod | null;
  unit: PriceUnitValue;
  unitLabel: string;
  currency: 'INR';
  firstPrice: number | null;
  lastPrice: number | null;
  meanPrice: number | null;
  /** The change from the first to the last observation, as a percentage. */
  changePercent: number | null;
  dataStatus: DataStatusValue;
  isDemoData: boolean;
  source: string;
  /** The method, shown so the result can be understood and checked. */
  method: string;
};

/** The method, kept in one place so the API and the UI agree. */
export const TREND_METHOD =
  'The modal price of one crop at one market, in one unit, is used. Observations on the ' +
  'same date are averaged, and the daily prices are sorted oldest first. A straight ' +
  'line is fitted to them by least squares, and the change of that line across the ' +
  'observed period is compared with the average price. A change of less than 2 ' +
  'percent is reported as stable, otherwise the direction of the line is reported as ' +
  'rising or falling. Fewer than 3 observations on 3 different dates is reported as ' +
  'insufficient data.';

/** Formats a date for a sentence, for example "5 Jan 2026". */
function readableDate(date: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return date.getUTCDate() + ' ' + months[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
}

/** The UTC calendar day of a date, used to group duplicate days. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The number of calendar days between two dates, counting both ends. */
export function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toUtc - fromUtc) / 86_400_000) + 1;
}

/**
 * Keeps only the observations that belong to the requested series.
 *
 * A row for another crop, another market, another price unit, or with an
 * impossible price is dropped rather than mixed in, so one line always
 * describes one thing.
 */
export function selectUsableObservations(
  observations: TrendObservation[],
  scope: { cropSlug: string; marketSlug: string; unit: PriceUnitValue },
): TrendObservation[] {
  return observations.filter(
    (observation) =>
      observation.cropSlug === scope.cropSlug &&
      observation.marketSlug === scope.marketSlug &&
      observation.unit === scope.unit &&
      Number.isFinite(observation.modalPrice) &&
      observation.modalPrice > 0,
  );
}

/**
 * The freshness of a set of observations, chosen conservatively.
 *
 * A seeded record must never be labelled live, so a demo row wins over
 * everything else. A record that came from the provider's cache is reported
 * as RECENT rather than LIVE, because part of the series was not fetched
 * during this request (PRD FR-11, PRD FR-12).
 */
export function dataStatusFor(
  observations: readonly { dataStatus: DataStatusValue }[],
): DataStatusValue {
  if (observations.length === 0) return 'UNAVAILABLE';
  if (observations.some((observation) => observation.dataStatus === 'DEMO')) return 'DEMO';
  if (observations.some((observation) => observation.dataStatus === 'RECENT')) return 'RECENT';
  if (observations.some((observation) => observation.dataStatus === 'LIVE')) return 'LIVE';
  return 'UNAVAILABLE';
}

/**
 * Cleans a list of observations into one point per day.
 *
 * Rows that belong to another crop, market, or unit are dropped, prices that
 * are not real numbers are dropped, and the prices recorded on the same day
 * are averaged.
 */
export function buildDailySeries(
  observations: TrendObservation[],
  scope: { cropSlug: string; marketSlug: string; unit: PriceUnitValue },
): { date: string; price: number }[] {
  const byDate = new Map<string, { total: number; count: number }>();

  for (const observation of selectUsableObservations(observations, scope)) {
    const key = dayKey(observation.observedAt);
    const existing = byDate.get(key);
    if (existing) {
      existing.total += observation.modalPrice;
      existing.count += 1;
    } else {
      byDate.set(key, { total: observation.modalPrice, count: 1 });
    }
  }

  return [...byDate.entries()]
    .map(([date, entry]) => ({ date, price: roundTo(entry.total / entry.count, 2) }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Works out the direction of the observed prices.
 *
 * The observations are the only evidence used. When there is not enough of
 * it, the result says so instead of describing a direction that was never
 * observed.
 */
export function analyseTrend(
  observations: TrendObservation[],
  scope: { cropSlug: string; marketSlug: string; unit: PriceUnitValue },
  marketName?: string,
): TrendAnalysisDto {
  const unit = scope.unit;
  const unitLabel = PRICE_UNIT_LABELS[unit];
  const series = buildDailySeries(observations, scope);

  // The status and the source come from the observations that were actually
  // used, so a row that was dropped for belonging to another crop, market,
  // or unit can never decide the label of the series.
  const usable = selectUsableObservations(observations, scope);
  const dataStatus = dataStatusFor(usable);
  const source = usable[0]?.source ?? 'unknown';

  if (series.length < MIN_TREND_POINTS) {
    return {
      direction: 'insufficient_data',
      metric: 'MODAL_PRICE',
      summary:
        'Not enough observations to say which way the prices moved at ' +
        (marketName ?? 'this market') +
        '.',
      reason:
        'Only ' +
        series.length +
        ' daily observation' +
        (series.length === 1 ? '' : 's') +
        ' were available. At least ' +
        MIN_TREND_POINTS +
        ' observations on ' +
        MIN_TREND_DISTINCT_DATES +
        ' different dates are needed to describe a trend.',
      observationCount: series.length,
      distinctDates: series.length,
      period: null,
      unit,
      unitLabel,
      currency: 'INR',
      firstPrice: series[0]?.price ?? null,
      lastPrice: series[series.length - 1]?.price ?? null,
      meanPrice: null,
      changePercent: null,
      dataStatus,
      isDemoData: dataStatus === 'DEMO',
      source,
      method: TREND_METHOD,
    };
  }

  const startDate = new Date(series[0].date + 'T00:00:00.000Z');
  const endDate = new Date(series[series.length - 1].date + 'T00:00:00.000Z');
  const points: SeriesPoint[] = series.map((point) => ({
    x: Math.round(
      (new Date(point.date + 'T00:00:00.000Z').getTime() - startDate.getTime()) / 86_400_000,
    ),
    y: point.price,
  }));

  const fit = leastSquares(points);
  const averagePrice = roundTo(
    points.reduce((total, point) => total + point.y, 0) / points.length,
    2,
  );
  const lastX = points[points.length - 1].x;
  const relativeChange = averagePrice === 0 ? 0 : (fit.slope * lastX) / averagePrice;

  let direction: TrendDirection;
  if (Math.abs(relativeChange) < STABLE_RELATIVE_CHANGE) direction = 'stable';
  else if (relativeChange > 0) direction = 'rising';
  else direction = 'falling';

  const firstPrice = series[0].price;
  const lastPrice = series[series.length - 1].price;
  const changePercent =
    firstPrice === 0 ? 0 : roundTo(((lastPrice - firstPrice) / firstPrice) * 100, 2);

  const where = marketName ?? 'this market';
  const movement =
    direction === 'rising'
      ? 'went up'
      : direction === 'falling'
        ? 'went down'
        : 'stayed roughly the same';

  return {
    direction,
    metric: 'MODAL_PRICE',
    summary:
      'The observed modal price at ' +
      where +
      ' ' +
      movement +
      ', from ' +
      firstPrice +
      ' to ' +
      lastPrice +
      ' ' +
      unitLabel +
      ' between ' +
      readableDate(startDate) +
      ' and ' +
      readableDate(endDate) +
      ', across ' +
      series.length +
      ' daily observations.',
    reason: null,
    observationCount: series.length,
    distinctDates: series.length,
    period: {
      from: series[0].date,
      to: series[series.length - 1].date,
      days: daysBetween(startDate, endDate),
    },
    unit,
    unitLabel,
    currency: 'INR',
    firstPrice,
    lastPrice,
    meanPrice: averagePrice,
    changePercent,
    dataStatus,
    isDemoData: dataStatus === 'DEMO',
    source,
    method: TREND_METHOD,
  };
}
