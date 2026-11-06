import type { PriceObservationDto } from '../../lib/mandiApi';
import { formatInr, formatObservationDate, toBadgeStatus } from '../../lib/priceAnalytics';
import { StateMessage } from '../ui/StateMessage';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './ObservationsTable.module.css';

/**
 * The price observations that match the filters.
 *
 * Every column the platform knows about is shown: the commodity, the market
 * and its location, the day the price was observed, the minimum, maximum,
 * and modal price, the unit, and the source with its freshness label
 * (PRD FR-03).
 */

export type ObservationsTableProps = {
  observations: PriceObservationDto[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectMarket?: (marketSlug: string) => void;
};

export function ObservationsTable({
  observations,
  loading,
  error,
  onRetry,
  onSelectMarket,
}: ObservationsTableProps) {
  if (error) {
    return (
      <StateMessage
        kind="error"
        title="Could not load the price observations"
        detail={error}
        onRetry={onRetry}
      />
    );
  }

  if (loading && observations.length === 0) {
    return (
      <StateMessage
        kind="loading"
        title="Loading the price observations"
        detail="The records that match the filters are collected."
      />
    );
  }

  if (observations.length === 0) {
    return (
      <StateMessage
        kind="empty"
        title="No observations match these filters"
        detail="Clear a filter or widen the date range to see more prices."
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table} role="table">
        <caption className="visually-hidden">
          Price observations that match the selected filters
        </caption>
        <thead>
          <tr role="row">
            <th role="columnheader" scope="col" className={styles.cropColumn}>
              Crop
            </th>
            <th role="columnheader" scope="col">
              Market and location
            </th>
            <th role="columnheader" scope="col">
              Observed on
            </th>
            <th role="columnheader" scope="col" className={styles.priceColumn}>
              Modal price
            </th>
            <th role="columnheader" scope="col" className={styles.priceColumn}>
              Minimum to maximum
            </th>
            <th role="columnheader" scope="col" className={styles.unitColumn}>
              Unit
            </th>
            <th role="columnheader" scope="col" className={styles.sourceColumn}>
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {observations.map((observation) => (
            <tr key={observation.crop.slug + observation.market.slug + observation.observedAt} role="row">
              <td role="cell" data-label="Crop" className={styles.cropColumn}>
                {observation.crop.name}
              </td>
              <td role="cell" data-label="Market">
                {onSelectMarket ? (
                  <button
                    type="button"
                    className={styles.marketButton}
                    onClick={() => onSelectMarket(observation.market.slug)}
                  >
                    {observation.market.name}
                  </button>
                ) : (
                  observation.market.name
                )}
                <span className={styles.location}>
                  {observation.market.locality
                    ? observation.market.locality + ', '
                    : ''}
                  {observation.market.district}, {observation.market.state}
                </span>
              </td>
              <td role="cell" data-label="Observed on">
                {formatObservationDate(observation.observedAt)}
              </td>
              <td role="cell" data-label="Modal price" className={styles.priceColumn}>
                {formatInr(observation.modalPrice)}
              </td>
              <td role="cell" data-label="Minimum to maximum" className={styles.priceColumn}>
                {formatInr(observation.minPrice)} - {formatInr(observation.maxPrice)}
              </td>
              <td role="cell" data-label="Unit" className={styles.unitColumn}>
                {observation.unitLabel}
              </td>
              <td role="cell" data-label="Source" className={styles.sourceColumn}>
                <StatusBadge status={toBadgeStatus(observation.dataStatus)} />
                <span className={styles.sourceName}>{observation.source}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
