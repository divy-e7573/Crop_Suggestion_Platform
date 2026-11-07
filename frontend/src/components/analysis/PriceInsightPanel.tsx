import {
  forecastRangeLabel,
  periodLabel,
  qualityLabel,
  trendLabel,
} from '../../lib/analysisPresentation';
import type { SellingInsightsDto, TrendDirection } from '../../lib/farmProfileApi';
import { formatInr } from '../../lib/priceAnalytics';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './ProfileAnalysisView.module.css';

export type PriceInsightPanelProps = {
  /** The observed trend, the estimate, and the wording around them. */
  insights: SellingInsightsDto;
};

/** The colour class for a direction. The word is always shown as well. */
function directionClass(direction: TrendDirection): string {
  if (direction === 'rising') return styles.directionUp;
  if (direction === 'falling') return styles.directionDown;
  if (direction === 'stable') return styles.directionSteady;
  return styles.directionUnknown;
}

/** Maps the freshness of a record onto the shared badge vocabulary. */
function badgeStatus(status: SellingInsightsDto['dataStatus']) {
  if (status === 'LIVE') return 'live' as const;
  if (status === 'RECENT') return 'recent' as const;
  if (status === 'DEMO') return 'demo' as const;
  return 'unavailable' as const;
}

/**
 * The observed trend, the estimate, and the selling guidance (PRD FR-07).
 *
 * The estimate only appears when the backend produced one. When it did not,
 * the panel says so and explains why, instead of showing a number.
 */
export function PriceInsightPanel({ insights }: PriceInsightPanelProps) {
  const trend = insights.observedTrend;
  const forecast = insights.forecast;

  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Observed price trend</h4>

        {trend ? (
          <>
            <p className={styles.direction + ' ' + directionClass(trend.direction)}>
              {trendLabel(trend.direction)}
            </p>
            <p className={styles.note}>{trend.summary}</p>

            <dl className={styles.facts}>
              <div>
                <dt className={styles.factTerm}>Period observed</dt>
                <dd className={styles.factValue}>{periodLabel(trend.period)}</dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Observations used</dt>
                <dd className={styles.factValue}>{trend.observationCount}</dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Price field</dt>
                <dd className={styles.factValue}>Modal price, {trend.unitLabel}</dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Data source</dt>
                <dd className={styles.factValue}>
                  <StatusBadge status={badgeStatus(trend.dataStatus)} /> {trend.source}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className={styles.noEstimate}>
            There is no price history for this crop at this location yet, so no direction
            can be reported.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Estimated future price</h4>

        {forecast && forecast.status === 'ok' ? (
          <>
            <p className={styles.estimate}>
              {formatInr(forecast.pointEstimate ?? 0)} {forecast.unitLabel}
            </p>
            <p className={styles.note}>
              Approximate range: {forecastRangeLabel(forecast)} &middot; about{' '}
              {forecast.horizonDays} days ahead
            </p>

            <dl className={styles.facts}>
              <div>
                <dt className={styles.factTerm}>Evidence period</dt>
                <dd className={styles.factValue}>
                  {forecast.evidence
                    ? periodLabel({ from: forecast.evidence.from, to: forecast.evidence.to })
                    : 'no recorded period'}
                </dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Observations behind it</dt>
                <dd className={styles.factValue}>
                  {forecast.evidence ? forecast.evidence.observations : 0}
                </dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Forecast horizon</dt>
                <dd className={styles.factValue}>{forecast.horizonLabel}</dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Data quality</dt>
                <dd className={styles.factValue}>{qualityLabel(forecast.dataQuality)}</dd>
              </div>
            </dl>

            <p className={styles.warning}>
              This is an estimate from the prices that were observed, not an observed price
              and not a promise. Check the price at your own market before you sell.
            </p>
          </>
        ) : (
          <>
            <p className={styles.noEstimate}>Not enough data to estimate</p>
            <p className={styles.note}>
              {forecast?.reason ??
                'There is not enough observed history to produce an estimate, so no number ' +
                  'is shown. The observed prices above are still worth comparing.'}
            </p>
          </>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Selling-period guidance</h4>

        <p className={styles.explanation}>{insights.summary}</p>

        {insights.points.length > 0 ? (
          <ul className={styles.points}>
            {insights.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}

        {insights.narrative ? (
          <p className={styles.narrative}>{insights.narrative}</p>
        ) : null}

        {insights.caveats.length > 0 ? (
          <ul className={styles.caveats}>
            {insights.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
