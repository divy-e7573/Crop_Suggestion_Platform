/**
 * The client for the mandi price APIs.
 *
 * The shapes mirror the backend responses exactly, so the dashboard never
 * has to guess what a field means. Every list response carries its own
 * `dataSource` block, which is what keeps a seeded price from ever being
 * presented as a live one (PRD FR-03, AGENTS.md section 3).
 */
import { getJson } from './apiClient';

/** The freshness of a record, matching the backend's DataStatus enum. */
export type DataStatusValue = 'LIVE' | 'RECENT' | 'DEMO' | 'UNAVAILABLE';

/** One observed price. */
export type PriceObservationDto = {
  crop: { slug: string; name: string; variety: string | null; grade: string | null };
  market: {
    slug: string;
    name: string;
    state: string;
    district: string;
    locality: string | null;
  };
  observedAt: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: string;
  unitLabel: string;
  currency: 'INR';
  source: string;
  dataStatus: DataStatusValue;
  isLive: boolean;
  fetchedAt: string | null;
};

/** The block that says where the data came from. */
export type DataSourceDto = {
  providerId: string;
  providerName: string;
  mode: 'demo' | 'live';
  dataStatus: DataStatusValue;
  isDemoData: boolean;
  isLiveData: boolean;
  label: string;
  notice: string;
  source: { id: string; url: string | null; attribution: string };
};

export type PaginationDto = {
  limit: number;
  offset: number;
  returned: number;
  total: number;
  truncated: boolean;
};

export type PriceListDto = {
  observations: PriceObservationDto[];
  pagination: PaginationDto;
  dataSource: DataSourceDto;
};

export type MarketDto = {
  slug: string;
  name: string;
  state: string;
  district: string;
  locality: string | null;
  source: string;
  dataStatus: DataStatusValue;
  isLive: boolean;
  hasVerifiedCoordinates: boolean;
  latestPrice: PriceObservationDto | null;
};

export type MarketListDto = {
  markets: MarketDto[];
  pagination: PaginationDto;
  dataSource: DataSourceDto;
};

export type CropDto = {
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  dataStatus: DataStatusValue;
};

export type CropListDto = {
  crops: CropDto[];
  catalogue: {
    isReferenceData: boolean;
    available: boolean;
    dataStatus: DataStatusValue;
    notice: string;
  };
  provider: {
    id: string;
    displayName: string;
    mode: 'demo' | 'live';
    configured: boolean;
  };
};

export type PriceSeriesDto = {
  series: {
    crop: { slug: string; name: string };
    market: { slug: string; name: string; state: string; district: string };
    metric: 'MODAL_PRICE';
    unit: string;
    unitLabel: string;
    currency: 'INR';
    points: Array<{
      observedAt: string;
      minPrice: number;
      maxPrice: number;
      modalPrice: number;
      dataStatus: DataStatusValue;
      source: string;
    }>;
    isComplete: boolean;
  };
  dataSource: DataSourceDto;
};

/** The status of the active provider, as `/api/data-sources` reports it. */
export type DataSourcesDto = {
  provider: {
    id: string;
    displayName: string;
    mode: 'demo' | 'live';
    configured: boolean;
    configurationIssue: string | null;
    verifiedLive: boolean;
  };
  dataStatus: DataStatusValue;
  isDemoData: boolean;
  isLiveData: boolean;
  liveDataAvailable: boolean;
  demoDataAvailable: boolean;
  label: string;
  notice: string;
  source: { id: string; url: string | null; attribution: string };
  upstream: {
    checked: boolean;
    reachable: boolean | null;
    status: 'ok' | 'unavailable' | 'not-applicable' | 'not-configured';
    checkedAt: string | null;
    message: string;
  };
  checkedAt: string;
};

/** The filters the dashboard can apply. Empty strings mean "no filter". */
export type PriceFilters = {
  crop?: string;
  state?: string;
  district?: string;
  market?: string;
  from?: string;
  to?: string;
};

/** Builds a query string, leaving out every filter that is not set. */
export function buildPriceQuery(filters: PriceFilters): string {
  const params = new URLSearchParams();

  for (const key of ['crop', 'market', 'state', 'district', 'from', 'to'] as const) {
    const value = filters[key];
    if (value !== undefined && value.trim() !== '') {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

/** Reads a page of price observations. */
export function fetchPrices(
  filters: PriceFilters,
  page: { limit: number; offset: number },
): Promise<PriceListDto> {
  const params = new URLSearchParams(buildPriceQuery(filters));
  params.set('limit', String(page.limit));
  params.set('offset', String(page.offset));
  return getJson<PriceListDto>('/api/mandi-prices?' + params.toString());
}

/** Reads the markets, used to populate the market, state, and district filters. */
export function fetchMarkets(filters: PriceFilters): Promise<MarketListDto> {
  const params = new URLSearchParams(buildPriceQuery(filters));
  params.set('limit', '100');
  params.set('offset', '0');
  return getJson<MarketListDto>('/api/markets?' + params.toString());
}

/** Reads the supported-crop catalogue. */
export function fetchCrops(): Promise<CropListDto> {
  return getJson<CropListDto>('/api/crops');
}

/** Reads the price series for one crop at one market. */
export function fetchPriceSeries(input: {
  crop: string;
  market: string;
  from?: string;
  to?: string;
}): Promise<PriceSeriesDto> {
  const params = new URLSearchParams();
  params.set('crop', input.crop);
  params.set('market', input.market);
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  return getJson<PriceSeriesDto>('/api/mandi-prices/history?' + params.toString());
}

/** Reads the status of the active data provider. */
export function fetchDataSources(): Promise<DataSourcesDto> {
  return getJson<DataSourcesDto>('/api/data-sources');
}

