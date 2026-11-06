import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiRequestError } from './apiClient';
import {
  fetchCrops,
  fetchDataSources,
  fetchMarkets,
  fetchPriceSeries,
  fetchPrices,
  type CropDto,
  type DataSourcesDto,
  type MarketDto,
  type PriceListDto,
  type PriceObservationDto,
  type PriceSeriesDto,
} from './mandiApi';
import {
  compareMarkets,
  districtOptions as districtOptionsFor,
  relevantMarkets as relevantMarketsFor,
  resolveCropSlug,
  stateOptions as stateOptionsFor,
  summariseObservations,
  toChartPoints,
  type ChartPoint,
  type MarketComparison,
  type PriceSummary,
} from './priceAnalytics';

/**
 * The state behind the mandi price dashboard.
 *
 * Every number the page shows comes from one of the backend endpoints. The
 * hook owns the requests so the page itself stays a composition of reusable
 * components, and so each request only runs when the value it depends on
 * actually changes (PRD FR-03, FR-09).
 *
 * Every request keeps the key it was made for. A result is only shown when
 * its key still matches the current filters, so a slow answer can never
 * overwrite a newer one, and the loading state is worked out during the
 * render instead of being set from inside an effect.
 */

/** How many observations one page of the table holds. */
export const PAGE_SIZE = 12;

/** The filters the dashboard offers. */
export type DashboardFilters = {
  /** A crop slug, a crop name, or a commodity typed by the farmer. */
  crop: string;
  state: string;
  district: string;
  /** A market slug taken from the markets endpoint. */
  market: string;
  /** The first day of the range, as yyyy-mm-dd. */
  from: string;
  /** The last day of the range, as yyyy-mm-dd. */
  to: string;
};

/** The filters with nothing selected. */
export const EMPTY_FILTERS: DashboardFilters = {
  crop: '',
  state: '',
  district: '',
  market: '',
  from: '',
  to: '',
};

/** True when two sets of filters ask for exactly the same thing. */
function sameFilters(left: DashboardFilters, right: DashboardFilters): boolean {
  return (
    left.crop === right.crop &&
    left.state === right.state &&
    left.district === right.district &&
    left.market === right.market &&
    left.from === right.from &&
    left.to === right.to
  );
}

/** Turns a failed request into a message the farmer can act on. */
function messageFor(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return 'Something went wrong while loading the prices. Please try again.';
}

/** The result of one request, together with the key it was made for. */
type RequestState<T> = {
  key: string;
  data: T | null;
  error: string | null;
};

/** What the page shows for one request. */
type RequestView<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/* Stable empty lists, so a value derived from them keeps its identity
 * between renders instead of being a new array every time. */
const NO_CROPS: CropDto[] = [];
const NO_MARKETS: MarketDto[] = [];
const NO_OBSERVATIONS: PriceObservationDto[] = [];

/**
 * Reads a request result.
 *
 * A result from another key is ignored, and the request is treated as still
 * running, because the new request has not answered yet.
 */
function readRequest<T>(state: RequestState<T>, key: string): RequestView<T> {
  if (key === '' || state.key !== key) {
    return { data: null, error: null, loading: key !== '' };
  }
  return { data: state.data, error: state.error, loading: false };
}

export type MandiDashboard = {
  filters: DashboardFilters;
  applyFilters: (next: DashboardFilters) => void;
  resetFilters: () => void;
  /** The slug the typed crop resolved to. */
  resolvedCrop: string;

  /** The crop catalogue, used for the crop suggestions. */
  crops: CropDto[];
  /** The markets that match the selected state. */
  markets: MarketDto[];
  /** The markets that match the selected state and district. */
  relevantMarkets: MarketDto[];
  /** The state names available in the markets. */
  stateOptions: string[];
  /** The district names available in the selected state. */
  districtOptions: string[];

  /** The observations on the current page. */
  observations: PriceObservationDto[];
  /** The number of observations that match the filters. */
  totalObservations: number;
  /** The page that is shown, counted from zero. */
  page: number;
  /** The number of pages the results need. */
  pageCount: number;
  goToPage: (page: number) => void;
  pricesLoading: boolean;
  pricesError: string | null;

  /** The minimum, maximum, and average of the observations on screen. */
  summary: PriceSummary | null;
  /** The newest price per market for the selected crop. */
  comparison: MarketComparison | null;
  comparisonLoading: boolean;
  comparisonError: string | null;

  /** The series for the selected crop and market. */
  series: PriceSeriesDto | null;
  chartPoints: ChartPoint[];
  seriesLoading: boolean;
  seriesError: string | null;

  /** The status of the active data provider. */
  dataSources: DataSourcesDto | null;
  dataSourcesError: string | null;

  /** Runs every request again, used by the retry buttons. */
  retry: () => void;
};

export function useMandiDashboard(): MandiDashboard {
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const [catalogueState, setCatalogueState] = useState<RequestState<CropDto[]>>({
    key: '',
    data: null,
    error: null,
  });
  const [marketsState, setMarketsState] = useState<RequestState<MarketDto[]>>({
    key: '',
    data: null,
    error: null,
  });
  const [pricesState, setPricesState] = useState<RequestState<PriceListDto>>({
    key: '',
    data: null,
    error: null,
  });
  const [pricesTotal, setPricesTotal] = useState(0);
  const [comparisonState, setComparisonState] = useState<RequestState<PriceListDto>>({
    key: '',
    data: null,
    error: null,
  });
  const [seriesState, setSeriesState] = useState<RequestState<PriceSeriesDto>>({
    key: '',
    data: null,
    error: null,
  });
  const [dataSourcesState, setDataSourcesState] = useState<RequestState<DataSourcesDto>>({
    key: '',
    data: null,
    error: null,
  });

  const retry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const applyFilters = useCallback((next: DashboardFilters) => {
    setFilters((current) => {
      let value = next;

      // Changing the state invalidates the district and the market, and
      // changing the district invalidates the market. Keeping a market that
      // belongs to another district would return nothing at all.
      if (next.state !== current.state) {
        value = { ...value, district: '', market: '' };
      } else if (next.district !== current.district) {
        value = { ...value, market: '' };
      }

      return sameFilters(current, value) ? current : value;
    });
    setPage(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(0);
  }, []);

  const goToPage = useCallback((next: number) => {
    setPage(Math.max(0, next));
  }, []);

  // The crop catalogue. It is reference data, so a failure only means the
  // crop field falls back to typed text.
  const catalogueKey = 'catalogue-' + reloadToken;

  useEffect(() => {
    let cancelled = false;

    fetchCrops()
      .then((result) => {
        if (cancelled) return;
        setCatalogueState({ key: catalogueKey, data: result.crops, error: null });
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogueState({ key: catalogueKey, data: [], error: null });
      });

    return () => {
      cancelled = true;
    };
  }, [catalogueKey]);

  const catalogue = readRequest(catalogueState, catalogueKey);
  const crops = catalogue.data ?? NO_CROPS;
  const catalogueReady = catalogue.data !== null;

  // The slug the crop filter resolves to, once the catalogue is known.
  const resolvedCrop = useMemo(
    () => resolveCropSlug(crops, filters.crop),
    [crops, filters.crop],
  );

  /*
   * Every market the active provider knows about.
   *
   * The list is fetched once, without a state filter, because it fills the
   * location filters: if it were filtered by the selected state, the state
   * dropdown would only ever offer the state that was already chosen and
   * the farmer could not switch to another one. The relevant markets are
   * then picked out of this list on the client, which also saves a request
   * every time the state changes.
   */
  const marketsKey = 'markets-' + reloadToken;

  useEffect(() => {
    let cancelled = false;

    fetchMarkets({})
      .then((result) => {
        if (cancelled) return;
        setMarketsState({ key: marketsKey, data: result.markets, error: null });
      })
      .catch(() => {
        if (cancelled) return;
        setMarketsState({ key: marketsKey, data: [], error: null });
      });

    return () => {
      cancelled = true;
    };
  }, [marketsKey]);

  const marketsView = readRequest(marketsState, marketsKey);
  const markets = marketsView.data ?? NO_MARKETS;

  // The price observations of the current page.
  const pricesKey = [
    filters.crop,
    filters.state,
    filters.district,
    filters.market,
    filters.from,
    filters.to,
    page,
    reloadToken,
  ].join('|');

  useEffect(() => {
    let cancelled = false;

    fetchPrices(
      {
        crop: filters.crop || undefined,
        state: filters.state || undefined,
        district: filters.district || undefined,
        market: filters.market || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
      { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    )
      .then((result) => {
        if (cancelled) return;
        setPricesState({ key: pricesKey, data: result, error: null });
        setPricesTotal(result.pagination.total);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPricesState({ key: pricesKey, data: null, error: messageFor(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [
    pricesKey,
    filters.crop,
    filters.state,
    filters.district,
    filters.market,
    filters.from,
    filters.to,
    page,
  ]);

  const pricesView = readRequest(pricesState, pricesKey);
  const observations = pricesView.data?.observations ?? NO_OBSERVATIONS;
  // The last known total is kept while the next page is loading, so the
  // page counter never reads as if the results had disappeared.
  const totalObservations = pricesView.data?.pagination.total ?? pricesTotal;

  // The market comparison needs one crop, so it only runs when a crop is
  // selected. It uses the same filters as the table, with a page big enough
  // to hold every matching market.
  const comparisonKey =
    catalogueReady && filters.crop.trim() !== ''
      ? [
          resolvedCrop,
          filters.state,
          filters.district,
          filters.from,
          filters.to,
          reloadToken,
        ].join('|')
      : '';

  useEffect(() => {
    if (comparisonKey === '') return;

    let cancelled = false;

    fetchPrices(
      {
        crop: resolvedCrop,
        state: filters.state || undefined,
        district: filters.district || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
      { limit: 100, offset: 0 },
    )
      .then((result) => {
        if (cancelled) return;
        setComparisonState({ key: comparisonKey, data: result, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setComparisonState({ key: comparisonKey, data: null, error: messageFor(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [
    comparisonKey,
    resolvedCrop,
    filters.state,
    filters.district,
    filters.from,
    filters.to,
  ]);

  const comparisonView = readRequest(comparisonState, comparisonKey);

  // The price series for one crop at one market. It is only requested when
  // both are known, because a series needs both.
  const seriesKey =
    filters.crop.trim() !== '' && filters.market.trim() !== ''
      ? [
          resolvedCrop,
          filters.market,
          filters.from,
          filters.to,
          reloadToken,
        ].join('|')
      : '';

  useEffect(() => {
    if (seriesKey === '') return;

    let cancelled = false;

    fetchPriceSeries({
      crop: resolvedCrop,
      market: filters.market,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setSeriesState({ key: seriesKey, data: result, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSeriesState({ key: seriesKey, data: null, error: messageFor(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [seriesKey, resolvedCrop, filters.market, filters.from, filters.to]);

  const seriesView = readRequest(seriesState, seriesKey);

  // The status of the active provider.
  const dataSourcesKey = 'data-sources-' + reloadToken;

  useEffect(() => {
    let cancelled = false;

    fetchDataSources()
      .then((result) => {
        if (cancelled) return;
        setDataSourcesState({ key: dataSourcesKey, data: result, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDataSourcesState({
          key: dataSourcesKey,
          data: null,
          error: messageFor(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [dataSourcesKey]);

  const dataSourcesView = readRequest(dataSourcesState, dataSourcesKey);

  const summary = useMemo(() => summariseObservations(observations), [observations]);

  const comparison = useMemo(
    () => compareMarkets(comparisonView.data?.observations ?? [], resolvedCrop),
    [comparisonView.data, resolvedCrop],
  );

  const chartPoints = useMemo(() => {
    if (!seriesView.data) return [];
    return toChartPoints(seriesView.data, {
      crop: resolvedCrop,
      market: filters.market,
    });
  }, [seriesView.data, resolvedCrop, filters.market]);

  const stateOptions = useMemo(
    () => stateOptionsFor(markets),
    [markets],
  );

  const districtOptions = useMemo(() => {
    return districtOptionsFor(markets, filters.state);
  }, [markets, filters.state]);

  const relevantMarkets = useMemo(
    () =>
      relevantMarketsFor(markets, {
        state: filters.state,
        district: filters.district,
      }),
    [markets, filters.state, filters.district]);

  const pageCount = Math.max(1, Math.ceil(totalObservations / PAGE_SIZE));

  return {
    filters,
    applyFilters,
    resetFilters,
    resolvedCrop,
    crops,
    markets,
    relevantMarkets,
    stateOptions,
    districtOptions,
    observations,
    totalObservations,
    page,
    pageCount,
    goToPage,
    pricesLoading: pricesView.loading,
    pricesError: pricesView.error,
    summary,
    comparison,
    comparisonLoading: comparisonView.loading,
    comparisonError: comparisonView.error,
    series: seriesView.data,
    chartPoints,
    seriesLoading: seriesView.loading,
    seriesError: seriesView.error,
    dataSources: dataSourcesView.data,
    dataSourcesError: dataSourcesView.error,
    retry,
  };
}
