import { formatInr, formatObservationDate, type MarketComparison } from '../../lib/priceAnalytics';
import { StateMessage } from '../ui/StateMessage';
import styles from './MarketComparisonChart.module.css';

/**
 * The newest price of one crop across markets.
 *
 * The bars are drawn with plain elements rather than an image, so every
 * number stays readable by a screen reader and the chart never needs a
 * second description. Only the newest observation of each market is used,
 * so one bar is one market and one price (PRD FR-03).
 */

export type MarketComparisonChartProps = {
  comparison: MarketComparison | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectMarket?: (marketSlug: string) => void;
};

export function MarketComparisonChart({
  comparison,
  loading,
  error,
  onRetry,
  onSelectMarket,
}: MarketComparisonChartProps) {
  if (error) {
    return (
      <StateMessage
        kind="error"
        title="Could not compare the markets"
        detail={error}
        onRetry={onRetry}
      />
    );
  }

  if (loading && !comparison) {
    return (
      <StateMessage
        kind="loading"
        title="Comparing the markets"
        detail="The newest price of every matching market is collected."
      />
    );
  }

  if (!comparison) {
    return (
      <StateMessage
        kind="empty"
        title="Choose a crop to compare markets"
        detail="The comparison shows the newest price of the same crop in every market that matches the filters."
      />
    );
  }

  if (comparison.rows.length === 0) {
    return (
      <StateMessage
        kind="empty"
        title="No market has a price for this crop"
        detail="Widen the date range or clear a filter to see more markets."
      />
    );
  }

  const highest = comparison.rows.reduce((max, row) => Math.max(max, row.modalPrice), 0);

  return (
    <div>
      <p className={styles.caption}>
        Newest {comparison.cropName} price per market, in {comparison.unitLabel}.
      </p>

      <ul className={styles.list}>
        {comparison.rows.map((row) => {
          const width = highest > 0 ? Math.round((row.modalPrice / highest) * 100) : 0;

          return (
            <li key={row.marketSlug} className={styles.row}>
              <div className={styles.rowHeader}>
                {onSelectMarket ? (
                  <button
                    type="button"
                    className={styles.marketButton}
                    onClick={() => onSelectMarket(row.marketSlug)}
                  >
                    {row.marketName}
                  </button>
                ) : (
                  <span className={styles.marketName}>{row.marketName}</span>
                )}
                <span className={styles.price}>{formatInr(row.modalPrice)}</span>
              </div>

              <div className={styles.track} aria-hidden="true">
                <div className={styles.bar} style={{ width: width + '%' }} />
              </div>

              <p className={styles.meta}>
                {row.state}, {row.district} - observed on{' '}
                {formatObservationDate(row.observedAt)}
              </p>
            </li>
          );
        })}
      </ul>

      {comparison.mixedUnits ? (
        <p className={styles.footnote}>
          Markets recorded in another unit were left out, because prices in different
          units cannot be compared on one scale.
        </p>
      ) : null}
    </div>
  );
}
