import { formatInr, type PriceSummary } from '../../lib/priceAnalytics';
import { StateMessage } from '../ui/StateMessage';
import styles from './PriceSummaryCards.module.css';

/**
 * The minimum, maximum, and average price of the observations on screen.
 *
 * Every figure is calculated from the records the API returned. When there
 * is nothing to calculate the component says so instead of showing a zero.
 */

export type PriceSummaryCardsProps = {
  summary: PriceSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function PriceSummaryCards({
  summary,
  loading,
  error,
  onRetry,
}: PriceSummaryCardsProps) {
  if (error) {
    return (
      <StateMessage
        kind="error"
        title="Could not calculate the price summary"
        detail={error}
        onRetry={onRetry}
      />
    );
  }

  if (loading && !summary) {
    return (
      <StateMessage
        kind="loading"
        title="Working out the price range"
        detail="The minimum, maximum, and average are calculated from the records that match the filters."
      />
    );
  }

  if (!summary) {
    return (
      <StateMessage
        kind="empty"
        title="No prices to summarise"
        detail="Choose a crop and a date range to see the minimum, maximum, and average price."
      />
    );
  }

  const observations = summary.count === 1 ? 'observation' : 'observations';

  return (
    <div>
      <dl className={styles.grid}>
        <div className={styles.stat}>
          <dt className={styles.label}>Minimum price</dt>
          <dd className={styles.value}>{formatInr(summary.minPrice)}</dd>
          <dd className={styles.note}>Lowest price in the results</dd>
        </div>

        <div className={styles.stat}>
          <dt className={styles.label}>Maximum price</dt>
          <dd className={styles.value}>{formatInr(summary.maxPrice)}</dd>
          <dd className={styles.note}>Highest price in the results</dd>
        </div>

        <div className={styles.stat}>
          <dt className={styles.label}>Average modal price</dt>
          <dd className={styles.value}>{formatInr(summary.averageModalPrice)}</dd>
          <dd className={styles.note}>Mean of the modal prices</dd>
        </div>
      </dl>

      <p className={styles.footnote}>
        Based on {summary.count} {observations} in {summary.unitLabel}.
        {summary.mixedUnits
          ? ' Observations recorded in another unit were left out, because prices in different units cannot be averaged together.'
          : ''}
      </p>
    </div>
  );
}
