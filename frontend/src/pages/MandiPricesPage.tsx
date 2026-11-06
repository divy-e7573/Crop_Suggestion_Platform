import { MarketComparisonChart } from '../components/mandi/MarketComparisonChart';
import { MandiFilterBar } from '../components/mandi/MandiFilterBar';
import { ObservationsTable } from '../components/mandi/ObservationsTable';
import { Pagination } from '../components/mandi/Pagination';
import { PriceSummaryCards } from '../components/mandi/PriceSummaryCards';
import { PriceTrendChart } from '../components/mandi/PriceTrendChart';
import { ProviderStatusCard } from '../components/mandi/ProviderStatusCard';
import { RelevantMarkets } from '../components/mandi/RelevantMarkets';
import { Card } from '../components/ui/Card';
import { useMandiDashboard } from '../lib/useMandiDashboard';
import { formatDateRange } from '../lib/priceAnalytics';
import styles from './pages.module.css';

/**
 * The mandi price dashboard.
 *
 * Every figure on this page comes from the backend: the filter bar drives
 * the price list, the summary is calculated from the records that are on
 * screen, the comparison and the trend chart use the same records, and the
 * status of the data source is read from the API. Nothing here is a
 * placeholder number (PRD FR-01, FR-03, FR-04, FR-05).
 */
export function MandiPricesPage() {
  const dashboard = useMandiDashboard();

  const cropOptions = dashboard.crops.map((crop) => ({
    slug: crop.slug,
    name: crop.name,
  }));

  const marketOptions = dashboard.markets
    .filter(
      (market) =>
        !dashboard.filters.state || market.state === dashboard.filters.state,
    )
    .filter(
      (market) =>
        !dashboard.filters.district || market.district === dashboard.filters.district,
    )
    .map((market) => ({ slug: market.slug, name: market.name }));

  const selectedCropName =
    dashboard.crops.find((crop) => crop.slug === dashboard.resolvedCrop)?.name ??
    dashboard.filters.crop;

  const selectedMarketName =
    dashboard.markets.find((market) => market.slug === dashboard.filters.market)?.name ??
    dashboard.filters.market;

  const selection = [
    selectedCropName ? 'crop: ' + selectedCropName : 'every crop',
    selectedMarketName ? 'market: ' + selectedMarketName : 'every market',
    'dates: ' + formatDateRange(dashboard.filters.from, dashboard.filters.to).toLowerCase(),
  ].join(' - ');

  function selectMarket(marketSlug: string) {
    dashboard.applyFilters({ ...dashboard.filters, market: marketSlug });
  }

  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <h1>Mandi prices</h1>
        <p className={styles.lead}>
          Compare recent prices across mandis, see how a price moved over time, and check
          which markets are relevant to your district. Every price is shown with its
          observation date, its unit, and the source it came from.
        </p>
        <p className={styles.selection}>
          Currently showing {selection}.
        </p>
      </header>

      <Card
        title="Data source"
        description="Which provider answered this request, and what its records mean."
      >
        <ProviderStatusCard
          dataSources={dashboard.dataSources}
          error={dashboard.dataSourcesError}
          onRetry={dashboard.retry}
        />
      </Card>

      <Card
        title="Filters"
        description="Narrow the prices by crop, location, market, and observation date."
      >
        <MandiFilterBar
          values={dashboard.filters}
          onChange={dashboard.applyFilters}
          cropOptions={cropOptions}
          stateOptions={dashboard.stateOptions}
          districtOptions={dashboard.districtOptions}
          marketOptions={marketOptions}
          onReset={dashboard.resetFilters}
        />
      </Card>

      <Card
        title="Price overview"
        description="The lowest, highest, and average price of the records that match the filters."
      >
        <PriceSummaryCards
          summary={dashboard.summary}
          loading={dashboard.pricesLoading}
          error={dashboard.pricesError}
          onRetry={dashboard.retry}
        />
      </Card>

      <div className={styles.chartGrid}>
        <Card
          title="Market comparison"
          description="The newest price of the selected crop in every matching market."
        >
          <MarketComparisonChart
            comparison={dashboard.comparison}
            loading={dashboard.comparisonLoading}
            error={dashboard.comparisonError}
            onRetry={dashboard.retry}
            onSelectMarket={selectMarket}
          />
        </Card>

        <Card
          title="Price trend"
          description="The recorded observations of one crop at one market over time."
        >
          <PriceTrendChart
            points={dashboard.chartPoints}
            series={dashboard.series}
            loading={dashboard.seriesLoading}
            error={dashboard.seriesError}
            cropLabel={selectedCropName}
            marketLabel={selectedMarketName}
            from={dashboard.filters.from}
            to={dashboard.filters.to}
            onRetry={dashboard.retry}
          />
        </Card>
      </div>

      <Card
        title="Price observations"
        description="The records behind the numbers above, newest first."
      >
        <ObservationsTable
          observations={dashboard.observations}
          loading={dashboard.pricesLoading}
          error={dashboard.pricesError}
          onRetry={dashboard.retry}
          onSelectMarket={selectMarket}
        />

        <Pagination
          page={dashboard.page}
          pageCount={dashboard.pageCount}
          total={dashboard.totalObservations}
          loading={dashboard.pricesLoading}
          onChange={dashboard.goToPage}
        />
      </Card>

      <Card
        title="Relevant markets"
        description="The markets that match the selected location, with their latest recorded price."
      >
        <RelevantMarkets
          markets={dashboard.relevantMarkets}
          loading={dashboard.pricesLoading}
          error={dashboard.pricesError}
          onRetry={dashboard.retry}
          onSelectMarket={selectMarket}
        />
      </Card>
    </div>
  );
}
