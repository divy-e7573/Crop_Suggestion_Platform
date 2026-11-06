import type { MarketDto } from '../../lib/mandiApi';
import { formatInr, formatObservationDate, toBadgeStatus } from '../../lib/priceAnalytics';
import { StateMessage } from '../ui/StateMessage';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './RelevantMarkets.module.css';

/**
 * The markets that match the location filters.
 *
 * The list is called "relevant markets" rather than "nearby markets",
 * because no source in this project publishes verified coordinates. A
 * distance is only shown when one was actually computed from coordinates
 * the source published (PRD FR-05).
 */

export type RelevantMarketsProps = {
  markets: MarketDto[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectMarket?: (marketSlug: string) => void;
};

export function RelevantMarkets({
  markets,
  loading,
  error,
  onRetry,
  onSelectMarket,
}: RelevantMarketsProps) {
  if (error) {
    return (
      <StateMessage
        kind="error"
        title="Could not load the relevant markets"
        detail={error}
        onRetry={onRetry}
      />
    );
  }

  if (loading && markets.length === 0) {
    return (
      <StateMessage
        kind="loading"
        title="Loading the relevant markets"
        detail="The markets that match the selected location are collected."
      />
    );
  }

  if (markets.length === 0) {
    return (
      <StateMessage
        kind="empty"
        title="No market matches this location"
        detail="Choose another state or district to see more markets."
      />
    );
  }

  const withCoordinates = markets.filter((market) => market.hasVerifiedCoordinates).length;

  return (
    <div>
      <ul className={styles.list}>
        {markets.map((market) => {
          const price = market.latestPrice;

          return (
            <li key={market.slug} className={styles.row}>
              <div className={styles.header}>
                {onSelectMarket ? (
                  <button
                    type="button"
                    className={styles.marketButton}
                    onClick={() => onSelectMarket(market.slug)}
                  >
                    {market.name}
                  </button>
                ) : (
                  <span className={styles.marketName}>{market.name}</span>
                )}
                <StatusBadge status={toBadgeStatus(market.dataStatus)} />
              </div>

              <p className={styles.location}>
                {market.locality ? market.locality + ', ' : ''}
                {market.district}, {market.state}
              </p>

              {price ? (
                <p className={styles.price}>
                  {formatInr(price.modalPrice)} - {price.crop.name}, observed on{' '}
                  {formatObservationDate(price.observedAt)}
                </p>
              ) : (
                <p className={styles.price}>No price has been recorded for this market yet.</p>
              )}
            </li>
          );
        })}
      </ul>

      <p className={styles.footnote}>
        {withCoordinates > 0
          ? withCoordinates + ' of these markets published verified coordinates.'
          : 'No distance is shown because this data source does not publish verified coordinates. These are the markets that match the filters, not the closest ones.'}
      </p>
    </div>
  );
}
