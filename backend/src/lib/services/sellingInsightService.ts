/**
 * The selling-period insight module (PRD FR-07).
 *
 * It turns the observed trend and the forecast result into words a farmer can
 * act on, and it is deliberately careful about what it is allowed to say:
 *
 * - It never names a date as a good day to sell.
 * - It never promises a price, a profit, or a better deal.
 * - It never suggests waiting for a sale on the strength of a forecast that
 *   the data does not support.
 * - It always separates what was observed from what was estimated.
 *
 * When there is not enough evidence it says so instead of offering advice.
 */

import type { DataStatusValue } from '../providers/types.ts';
import type { ForecastDto } from './forecastService.ts';
import type { TrendAnalysisDto } from './trendAnalysisService.ts';

/** Whether the insights could be made or not. */
export type SellingInsightStatus = 'available' | 'insufficient_data';

/** The crop and market the insights are about. */
export type InsightSubject = {
  crop: { slug: string; name: string } | null;
  market: { slug: string; name: string; state: string; district: string } | null;
};

/** The result the API returns for the selling-period part of the analysis. */
export type SellingInsightsDto = {
  status: SellingInsightStatus;
  /** One plain-language sentence describing the situation. */
  summary: string;
  /** Short sentences with the detail behind the summary. */
  points: string[];
  /** The limits of what this result can be used for. */
  caveats: string[];
  /** The observed trend the insights are based on, when there was one. */
  observedTrend: TrendAnalysisDto | null;
  /** The baseline forecast, when the data supported one. */
  forecast: ForecastDto | null;
  /**
   * An optional extra sentence written by the AI provider.
   *
   * It can only add wording. It is never allowed to contain a figure, and it
   * never replaces the deterministic text above it.
   */
  narrative: string | null;
  dataStatus: DataStatusValue;
  isDemoData: boolean;
  /** The method, so the wording can be traced back to the calculations. */
  method: string;
};

/** The method, kept in one place so the API and the UI agree. */
export const SELLING_INSIGHT_METHOD =
  'The insights are built from two calculations and nothing else: the direction of the ' +
  'prices that were actually observed at one market, and a simple baseline estimate ' +
  'that is only produced when the observations clear the documented threshold. The ' +
  'wording never names a selling date, never promises a price or a profit, and never ' +
  'suggests delaying a sale on the strength of an estimate.';

/** The always-present limits of the result. */
function baseCaveats(isDemoData: boolean, forecast: ForecastDto | null): string[] {
  const caveats = [
    'This is observed market information, not advice on when to sell, and it cannot ' +
      'promise a better price on any date.',
  ];

  if (forecast && forecast.status === 'ok') {
    caveats.push(
      'The estimate is a straight line drawn through the observed prices and read ' +
        forecastQualityText(forecast) +
        '. It is a rough guide, not a market prediction.',
    );
  }

  if (isDemoData) {
    caveats.push(
      'These records are seeded demonstration data. They are not real mandi prices, so ' +
        'the direction shown here is an illustration and not a statement about your market.',
    );
  }

  return caveats;
}

/** A short phrase describing how much the estimate can be trusted. */
function forecastQualityText(forecast: ForecastDto): string {
  if (forecast.dataQuality === 'low') {
    return 'a short way ahead, and the data behind it is of low quality';
  }
  if (forecast.dataQuality === 'medium') {
    return 'a short way ahead, and the data behind it is of medium quality';
  }
  return 'a short way ahead, and the data behind it is of high quality';
}

/** Builds the selling insights from the trend and the forecast. */
export function buildSellingInsights(input: {
  subject: InsightSubject;
  trend: TrendAnalysisDto | null;
  forecast: ForecastDto | null;
  dataStatus: DataStatusValue;
  isDemoData: boolean;
  /** Why the market data could not be read, when it could not be read. */
  unavailableReason?: string | null;
  /** The optional AI wording, which is never allowed to change the facts. */
  narrative?: string | null;
}): SellingInsightsDto {
  const { subject, trend, forecast } = input;
  const isDemoData = input.isDemoData;
  const marketName = subject.market?.name ?? 'your market';

  if (!trend) {
    const reason =
      input.unavailableReason ??
      'The price records for this location could not be read, so no market information ' +
        'could be checked.';

    return {
      status: 'insufficient_data',
      summary:
        subject.crop === null
          ? 'No crop in the rule set matched this profile, so there is nothing to say ' +
            'about selling yet.'
          : 'There is no market information for ' +
            subject.crop.name +
            ' here yet, so no selling guidance can be given.',
      points: [reason],
      caveats: baseCaveats(isDemoData, null),
      observedTrend: null,
      forecast: null,
      narrative: input.narrative ?? null,
      dataStatus: input.dataStatus,
      isDemoData,
      method: SELLING_INSIGHT_METHOD,
    };
  }

  if (trend.direction === 'insufficient_data') {
    return {
      status: 'insufficient_data',
      summary: trend.summary,
      points: [
        trend.reason ??
          'There were not enough observations to work out which way the prices moved.',
        'The prices that were observed are still worth comparing between markets on the ' +
          'mandi prices page.',
      ],
      caveats: baseCaveats(isDemoData, forecast),
      observedTrend: trend,
      forecast: forecast,
      narrative: input.narrative ?? null,
      dataStatus: input.dataStatus,
      isDemoData,
      method: SELLING_INSIGHT_METHOD,
    };
  }

  const points: string[] = [trend.summary];

  if (forecast && forecast.status === 'ok' && forecast.evidence) {
    points.push(
      'If the same movement continues, the line fitted to those ' +
        forecast.evidence.observations +
        ' observed prices points to about ' +
        forecast.pointEstimate +
        ' ' +
        forecast.unitLabel +
        ' in about ' +
        forecast.horizonDays +
        ' days, with an approximate range of ' +
        forecast.lowerBound +
        ' to ' +
        forecast.upperBound +
        '. This is an estimate from a short history and not a market prediction.',
    );
  } else if (forecast && forecast.status === 'insufficient_data') {
    points.push(
      'There is not enough observed history to estimate a future price, so no estimated ' +
        'price is shown. ' +
        (forecast.reason ?? ''),
    );
  }

  if (trend.direction === 'rising') {
    points.push(
      'Observed prices are higher now than earlier in this period. Selling sooner and ' +
        'selling later both have risks, so compare the price at your own market with the ' +
        'prices of nearby mandis before you decide.',
    );
  } else if (trend.direction === 'falling') {
    points.push(
      'Observed prices are lower now than earlier in this period. On this evidence alone, ' +
        'waiting is not a good reason to delay a sale. Storage, market demand, and your ' +
        'own costs matter more than this short history.',
    );
  } else {
    points.push(
      'Observed prices have held steady over this period, so the history gives no strong ' +
        'reason to sell earlier or later than you otherwise would.',
    );
  }

  const summary =
    'The observed prices for ' +
    (subject.crop?.name ?? 'this crop') +
    ' at ' +
    marketName +
    ' were ' +
    (trend.direction === 'rising'
      ? 'rising'
      : trend.direction === 'falling'
        ? 'falling'
        : 'steady') +
    ' over the period that was observed. That describes what already happened, and it ' +
    'is not a promise about what a future sale will fetch.';

  return {
    status: 'available',
    summary,
    points,
    caveats: baseCaveats(isDemoData, forecast),
    observedTrend: trend,
    forecast,
    narrative: input.narrative ?? null,
    dataStatus: input.dataStatus,
    isDemoData,
    method: SELLING_INSIGHT_METHOD,
  };
}
