import type { PriceSeriesDto } from '../../lib/mandiApi';
import { formatDateRange, type ChartPoint } from '../../lib/priceAnalytics';
import { UplotChart } from '../charts/UplotChart';
import { StateMessage } from '../ui/StateMessage';
import styles from './PriceTrendChart.module.css';

/**
 * The price trend of one crop at one market.
 *
 * A line is only drawn when the source really returned more than one
 * observation. With a single point there is no movement to show, so the
 * component says that instead of drawing a line that invents a trend
 * (PRD FR-04).
 */

export type PriceTrendChartProps = {
  points: ChartPoint[];
  series: PriceSeriesDto | null;
  loading: boolean;
  error: string | null;
  /** The crop the farmer selected. */
  cropLabel: string;
  /** The market the farmer selected. */
  marketLabel: string;
  /** The date range the results cover. */
  from: string;
  to: string;
  onRetry: () => void;
};

export function PriceTrendChart({
  points,
  series,
  loading,
  error,
  cropLabel,
  marketLabel,
  from,
  to,
  onRetry,
}: PriceTrendChartProps) {
  if (error) {
    return (
      <StateMessage
        kind="error"
        title="Could not load the price history"
        detail={error}
        onRetry={onRetry}
      />
    );
  }

  if (!cropLabel || !marketLabel) {
    return (
      <StateMessage
        kind="empty"
        title="Choose a crop and a market to see the trend"
        detail="A price series always belongs to one crop at one market, so both are needed before a line can be drawn."
      />
    );
  }

  if (loading && points.length === 0) {
    return (
      <StateMessage
        kind="loading"
        title="Loading the price history"
        detail="The observations for this crop at this market are collected."
      />
    );
  }

  if (points.length < 2) {
    return (
      <StateMessage
        kind="empty"
        title="Not enough observations for a trend"
        detail={
          points.length === 1
            ? 'Only one observation is available for this crop at this market, so there is no movement to plot. The live data source publishes a single record per request, so a trend is rarely available in live mode.'
            : 'No observation was found for this crop at this market in the selected date range.'
        }
      />
    );
  }

  const unitLabel = series?.series.unitLabel ?? 'INR per quintal';

  return (
    <div>
      <UplotChart
        title="Modal price over time"
        description={
          'Modal price in ' +
          unitLabel +
          ', observed from ' +
          formatDateRange(from, to).toLowerCase() +
          '.'
        }
        yLabel={'Modal price (' + unitLabel + ')'}
        seriesLabel="Modal price"
        points={points}
        ariaLabel={
          'Line chart of the modal price of ' +
          cropLabel +
          ' at ' +
          marketLabel +
          ' over ' +
          points.length +
          ' observations, in ' +
          unitLabel +
          '.'
        }
      />

      <p className={styles.footnote}>
        {points.length} observations of {cropLabel} at {marketLabel}. Each point is one
        observation recorded by the source; missing days are not filled in.
      </p>
    </div>
  );
}
