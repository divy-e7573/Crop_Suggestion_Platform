/**
 * Wording helpers for the crop suggestion and selling-insight panels.
 *
 * These are pure functions, with no React and no network, so the wording
 * that the farmer reads can be checked on its own.
 */
import type {
  ForecastDto,
  ProfileAnalysisStatus,
  SuitabilityConfidence,
  TrendDirection,
} from './farmProfileApi';
import { formatDateRange, formatInr } from './priceAnalytics.ts';

/** The short label for how much of the rule could be checked. */
export function confidenceLabel(confidence: SuitabilityConfidence): string {
  if (confidence === 'high') return 'Well matched';
  if (confidence === 'medium') return 'Partly checked';
  return 'Barely checked';
}

/**
 * The short label for the observed direction.
 *
 * The word is always shown next to the full sentence, so the direction is
 * never communicated by colour alone (PRD FR-12).
 */
export function trendLabel(direction: TrendDirection): string {
  if (direction === 'rising') return 'Rising';
  if (direction === 'falling') return 'Falling';
  if (direction === 'stable') return 'Steady';
  return 'Not enough data';
}

/**
 * The short label for the evidence behind an estimate.
 *
 * The wording deliberately talks about the evidence and not about
 * confidence in the outcome. The forecast is a straight line read one week
 * beyond the last observation, and the range around it is the usual
 * day-to-day spread of the observed prices around that line. Saying
 * "high confidence" would promise more than that calculation can
 * establish (AGENTS.md section 3), so the label names the strength of the
 * evidence instead.
 */
export function qualityLabel(quality: ForecastDto['dataQuality']): string {
  if (quality === 'high') return 'Good evidence';
  if (quality === 'medium') return 'Fair evidence';
  if (quality === 'low') return 'Weak evidence';
  return 'No estimate';
}

/** The score, written so a farmer can read it without a legend. */
export function scoreLabel(score: number): string {
  return Math.round(score) + '% of the rule matched';
}

/** The estimated range, with the unit. */
export function forecastRangeLabel(forecast: ForecastDto): string {
  if (
    forecast.lowerBound === null ||
    forecast.upperBound === null ||
    forecast.pointEstimate === null
  ) {
    return 'Not enough data to estimate';
  }

  return (
    formatInr(forecast.lowerBound) +
    ' to ' +
    formatInr(forecast.upperBound) +
    ' ' +
    forecast.unitLabel
  );
}

/** The period the observations behind a result cover. */
export function periodLabel(period: { from: string; to: string } | null): string {
  if (!period) return 'no recorded period';
  return formatDateRange(period.from, period.to);
}

/** The short label for how complete the analysis is. */
export function analysisStatusLabel(status: ProfileAnalysisStatus): string {
  if (status === 'computed') return 'Ready';
  if (status === 'partial') return 'Partly ready';
  return 'Not available';
}
