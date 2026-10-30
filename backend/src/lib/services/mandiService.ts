/**
 * The mandi price service.
 *
 * This is the layer between the HTTP routes and the data providers. It
 * validates the query, asks the active provider for records, and maps the
 * result onto the API shape. The routes only parse, delegate, and wrap the
 * result in the response envelope (PRD FR-09, AGENTS.md section 2).
 *
 * Nothing here invents data. Every record carries the status and source it
 * had in the provider, and a provider failure becomes a clear error instead
 * of demo rows (PRD section 12).
 */
import { z } from 'zod';

import { ApiError } from '../api/errors.ts';
import { boundedIntQuery } from '../api/validation.ts';
import { isProviderError, type ProviderError } from '../providers/errors.ts';
import { formatDate } from '../providers/normalize.ts';
import {
  PRICE_UNIT_LABELS,
  type DataStatusValue,
  type MandiPriceProvider,
  type PriceUnitValue,
  type ProviderMarket,
  type ProviderObservation,
  type ProviderQuery,
} from '../providers/types.ts';

/** The largest page a client may ask for. */
export const MAX_PAGE_SIZE = 100;

/** The default page size. */
export const DEFAULT_PAGE_SIZE = 25;

/** The largest offset a client may ask for. */
export const MAX_OFFSET = 10_000;

const isoDateQuery = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the yyyy-mm-dd format, for example 2026-01-05.')
  .refine(
    (value) => {
      const parsed = new Date(value + 'T00:00:00.000Z');
      if (Number.isNaN(parsed.getTime())) return false;
      // The Date constructor rolls impossible days over, for example
      // 2026-02-30 becoming 2026-03-02, so the round trip is checked instead.
      return parsed.toISOString().slice(0, 10) === value;
    },
    'That date does not exist.',
  )
  .transform((value) => new Date(value + 'T00:00:00.000Z'))
  .optional();

const textQuery = z.string().trim().min(1).max(160).optional();

/** Query parameters accepted by `GET /api/mandi-prices`. */
export const priceQuerySchema = z
  .object({
    crop: textQuery,
    market: textQuery,
    state: textQuery,
    district: textQuery,
    from: isoDateQuery,
    to: isoDateQuery,
    limit: boundedIntQuery({ defaultValue: DEFAULT_PAGE_SIZE, min: 1, max: MAX_PAGE_SIZE }),
    offset: boundedIntQuery({ defaultValue: 0, min: 0, max: MAX_OFFSET }),
  })
  .refine((value) => !value.from || !value.to || value.from.getTime() <= value.to.getTime(), {
    message: 'The from date must not be after the to date.',
    path: ['from'],
  });

/** Query parameters accepted by `GET /api/markets`. */
export const marketQuerySchema = z.object({
  market: textQuery,
  state: textQuery,
  district: textQuery,
  limit: boundedIntQuery({ defaultValue: DEFAULT_PAGE_SIZE, min: 1, max: MAX_PAGE_SIZE }),
  offset: boundedIntQuery({ defaultValue: 0, min: 0, max: MAX_OFFSET }),
});

export type PriceQuery = z.infer<typeof priceQuerySchema>;
export type MarketQuery = z.infer<typeof marketQuerySchema>;

/** One price observation as the API returns it. */
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
  unit: PriceUnitValue;
  unitLabel: string;
  currency: 'INR';
  source: string;
  dataStatus: DataStatusValue;
  /** True only for a record fetched from a verified provider during this request. */
  isLive: boolean;
  fetchedAt: string | null;
};

/** One market as the API returns it. */
export type MarketDto = {
  slug: string;
  name: string;
  state: string;
  district: string;
  locality: string | null;
  source: string;
  dataStatus: DataStatusValue;
  isLive: boolean;
  /** True only when the source published verified coordinates. */
  hasVerifiedCoordinates: boolean;
  latestPrice: PriceObservationDto | null;
};

/** The block that tells a client where the data came from. */
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
  /** True when the source had more records than this request could read. */
  truncated: boolean;
};

export type PriceListDto = {
  observations: PriceObservationDto[];
  pagination: PaginationDto;
  dataSource: DataSourceDto;
};

export type MarketListDto = {
  markets: MarketDto[];
  pagination: PaginationDto;
  dataSource: DataSourceDto;
};

/** The plain-language warning shown with the data. */
function noticeFor(provider: MandiPriceProvider, status: DataStatusValue): string {
  if (provider.isDemo) {
    return 'These are seeded demonstration records. They are not real mandi prices.';
  }
  if (status === 'RECENT') {
    return 'Fetched from the official source a moment ago and served from a short cache.';
  }
  if (status === 'LIVE') {
    return 'Fetched from the official source while handling this request.';
  }
  return 'No data source status is available for this response.';
}

/** Builds the data-source block for a provider. */
export function buildDataSource(
  provider: MandiPriceProvider,
  status: DataStatusValue = provider.dataStatus,
): DataSourceDto {
  // A provider that cannot run must never be described as if it had served
  // live data, so its status is reported as unavailable.
  const effectiveStatus: DataStatusValue = provider.configured ? status : 'UNAVAILABLE';

  return {
    providerId: provider.id,
    providerName: provider.displayName,
    mode: provider.mode,
    dataStatus: effectiveStatus,
    isDemoData: provider.isDemo,
    isLiveData: !provider.isDemo && provider.configured,
    label: !provider.configured
      ? 'Unavailable'
      : provider.isDemo
        ? 'Demo data'
        : 'Live (verified source)',
    notice: provider.configured
      ? noticeFor(provider, effectiveStatus)
      : (provider.configurationIssue ?? 'The data provider is not configured.'),
    source: {
      id: provider.id,
      url: provider.sourceUrl,
      attribution: provider.attribution,
    },
  };
}

/** Maps a provider observation onto the API shape. */
export function toPriceObservationDto(observation: ProviderObservation): PriceObservationDto {
  return {
    crop: {
      slug: observation.cropSlug,
      name: observation.cropName,
      variety: observation.cropVariety,
      grade: observation.cropGrade,
    },
    market: {
      slug: observation.marketSlug,
      name: observation.marketName,
      state: observation.state,
      district: observation.district,
      locality: observation.locality,
    },
    observedAt: formatDate(observation.observedAt),
    minPrice: observation.minPrice,
    maxPrice: observation.maxPrice,
    modalPrice: observation.modalPrice,
    unit: observation.unit,
    unitLabel: PRICE_UNIT_LABELS[observation.unit],
    currency: observation.currency,
    source: observation.source,
    dataStatus: observation.dataStatus,
    isLive: observation.dataStatus === 'LIVE',
    fetchedAt: observation.fetchedAt ? observation.fetchedAt.toISOString() : null,
  };
}

/** Maps a provider market onto the API shape. */
export function toMarketDto(market: ProviderMarket): MarketDto {
  return {
    slug: market.slug,
    name: market.name,
    state: market.state,
    district: market.district,
    locality: market.locality,
    source: market.source,
    dataStatus: market.dataStatus,
    isLive: market.dataStatus === 'LIVE',
    hasVerifiedCoordinates: market.hasVerifiedCoordinates,
    latestPrice: market.latestObservation ? toPriceObservationDto(market.latestObservation) : null,
  };
}

/** Turns a provider failure into a safe HTTP error. */
function toApiError(error: ProviderError): ApiError {
  switch (error.kind) {
    case 'not-configured':
      return new ApiError(503, 'PROVIDER_NOT_CONFIGURED', error.message);
    case 'rate-limited':
      return new ApiError(503, 'PROVIDER_RATE_LIMITED', error.message);
    case 'invalid-response':
      return new ApiError(
        502,
        'PROVIDER_UNAVAILABLE',
        'The mandi data provider returned an unusable response. Please try again later.',
      );
    case 'unavailable':
    default:
      return new ApiError(
        503,
        'PROVIDER_UNAVAILABLE',
        'The mandi data provider is currently unavailable. Please try again later.',
      );
  }
}

/** Runs a provider call and converts provider failures into API errors. */
async function callProvider<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isProviderError(error)) throw toApiError(error);
    throw error;
  }
}

/** Builds the provider query from the parsed request query. */
function toProviderQuery(query: PriceQuery | MarketQuery): ProviderQuery {
  const price = query as PriceQuery;
  return {
    crop: price.crop,
    market: query.market,
    state: query.state,
    district: query.district,
    from: price.from,
    to: price.to,
    limit: query.limit,
    offset: query.offset,
  };
}

/** Lists price observations from the active provider. */
export async function listMandiPrices(
  provider: MandiPriceProvider,
  query: PriceQuery,
): Promise<PriceListDto> {
  const result = await callProvider(() => provider.listObservations(toProviderQuery(query)));

  const observations = result.items.map(toPriceObservationDto);
  const status = result.items[0]?.dataStatus ?? provider.dataStatus;

  return {
    observations,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      returned: observations.length,
      total: result.total,
      truncated: result.truncated,
    },
    dataSource: buildDataSource(provider, status),
  };
}

/** Lists markets from the active provider. */
export async function listMandiMarkets(
  provider: MandiPriceProvider,
  query: MarketQuery,
): Promise<MarketListDto> {
  const result = await callProvider(() => provider.listMarkets(toProviderQuery(query)));

  const markets = result.items.map((market) => toMarketDto(market));
  const status = result.items[0]?.dataStatus ?? provider.dataStatus;

  return {
    markets,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      returned: markets.length,
      total: result.total,
      truncated: result.truncated,
    },
    dataSource: buildDataSource(provider, status),
  };
}
