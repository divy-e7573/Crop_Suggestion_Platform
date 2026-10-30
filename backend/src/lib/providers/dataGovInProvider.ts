/**
 * The official data.gov.in mandi price provider.
 *
 * Verified during Phase 5 development against the live API:
 *
 * - Resource `9ef84268-d588-465a-a308-a864a43d0070`, published by the
 *   Ministry of Agriculture and Farmers Welfare (Directorate of Marketing and
 *   Inspection) as *Current Daily Price of Various Commodities from Various
 *   Markets (Mandi)*, and published under the Government Open Data
 *   Licence - India.
 * - The endpoint needs an `api-key`. A request without one is rejected with
 *   HTTP 400, and a request with an unknown key is rejected with HTTP 403.
 * - `filters[state]`, `filters[district]`, `filters[market]` and
 *   `filters[commodity]` are honoured and are matched case-insensitively.
 *   There is no usable date filter, so dates are applied to the fetched page.
 * - Every response is capped at 10 records, whatever `limit` asks for, so the
 *   provider pages through the resource itself.
 * - The service advertises no request budget in its headers: its
 *   `X-Ratelimit-Limit` header is `-1`. Measured behaviour is different: a
 *   burst of roughly 25 requests in a short window is enough for it to start
 *   answering HTTP 429, and it sometimes drops a connection. The provider is
 *   therefore sized to stay well inside that budget: it reads at most three
 *   upstream pages per request, keeps a minimum interval between upstream
 *   calls, caches pages for a few minutes, and backs off when it is throttled.
 *
 * When the upstream fails, this provider raises a `ProviderError`. It never
 * substitutes demo rows, because that would pass seeded data off as real
 * prices (PRD section 12).
 */
import {
  ProviderInvalidResponseError,
  ProviderNotConfiguredError,
  ProviderRateLimitedError,
  ProviderUnavailableError,
  isProviderError,
  type ProviderError,
} from './errors.ts';
import {
  normalizeDataGovInRecord,
  parseDataGovInEnvelope,
  slugify,
} from './normalize.ts';
import type {
  DataStatusValue,
  MandiPriceProvider,
  ProviderMarket,
  ProviderObservation,
  ProviderQuery,
  ProviderResult,
} from './types.ts';

/** The source id written onto every record fetched from data.gov.in. */
export const DATA_GOV_IN_SOURCE_ID = 'data-gov-in';

/** The verified resource id for the daily mandi price dataset. */
export const DEFAULT_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

/** The verified resource endpoint. */
export const DEFAULT_BASE_URL = 'https://api.data.gov.in/resource';

/** The human-readable page for the resource. */
export const DEFAULT_SOURCE_URL =
  'https://www.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';

/** The upstream caps every response at 10 records. */
export const UPSTREAM_PAGE_SIZE = 10;

/** Default number of upstream pages one request may read. */
export const DEFAULT_MAX_PAGES = 3;

/** Default number of extra attempts for a page that failed. */
export const DEFAULT_MAX_RETRIES = 3;

/** Default pause between two attempts, in milliseconds. */
export const DEFAULT_RETRY_DELAY_MS = 500;

/** Default pause before a retry of a throttled request, in milliseconds. */
export const DEFAULT_THROTTLE_DELAY_MS = 2000;

/** Default minimum gap between two upstream calls, in milliseconds. */
export const DEFAULT_MIN_INTERVAL_MS = 250;

/** Default upstream timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 8000;

/** Default lifetime of the in-process page cache. */
export const DEFAULT_CACHE_TTL_MS = 300_000;

export type DataGovInConfig = {
  apiKey: string | null;
  resourceId: string;
  baseUrl: string;
  timeoutMs: number;
  maxPages: number;
  maxRetries: number;
  retryDelayMs: number;
  throttleDelayMs: number;
  minIntervalMs: number;
  cacheTtlMs: number;
};

/** A page of upstream records plus when it was retrieved. */
type CachedPage = {
  records: unknown[];
  total: number;
  fetchedAt: Date;
  /** LIVE when the page was fetched during this request, RECENT from cache. */
  dataStatus: DataStatusValue;
};

export type DataGovInProviderOptions = {
  config: DataGovInConfig;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to a real clock. */
  now?: () => Date;
};

/** Reads the provider settings from the server environment. */
export function readDataGovInConfig(env: NodeJS.ProcessEnv = process.env): DataGovInConfig {
  const apiKey = env.MANDI_PROVIDER_API_KEY?.trim() || null;

  const timeout = Number(env.MANDI_PROVIDER_TIMEOUT_MS ?? '');
  const maxPages = Number(env.MANDI_PROVIDER_MAX_PAGES ?? '');
  const maxRetries = Number(env.MANDI_PROVIDER_MAX_RETRIES ?? '');
  const retryDelay = Number(env.MANDI_PROVIDER_RETRY_DELAY_MS ?? '');
  const throttleDelay = Number(env.MANDI_PROVIDER_THROTTLE_DELAY_MS ?? '');
  const minInterval = Number(env.MANDI_PROVIDER_MIN_INTERVAL_MS ?? '');
  const cacheTtl = Number(env.MANDI_PROVIDER_CACHE_TTL_MS ?? '');

  return {
    apiKey,
    resourceId: env.MANDI_PROVIDER_RESOURCE_ID?.trim() || DEFAULT_RESOURCE_ID,
    baseUrl: (env.MANDI_PROVIDER_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    maxPages: Number.isFinite(maxPages) && maxPages > 0 ? maxPages : DEFAULT_MAX_PAGES,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : DEFAULT_MAX_RETRIES,
    retryDelayMs:
      Number.isFinite(retryDelay) && retryDelay >= 0 ? retryDelay : DEFAULT_RETRY_DELAY_MS,
    throttleDelayMs:
      Number.isFinite(throttleDelay) && throttleDelay >= 0
        ? throttleDelay
        : DEFAULT_THROTTLE_DELAY_MS,
    minIntervalMs:
      Number.isFinite(minInterval) && minInterval >= 0 ? minInterval : DEFAULT_MIN_INTERVAL_MS,
    cacheTtlMs: Number.isFinite(cacheTtl) && cacheTtl >= 0 ? cacheTtl : DEFAULT_CACHE_TTL_MS,
  };
}

/** Waits for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Builds the upstream filter parameters for a query. */
function buildUpstreamFilters(query: ProviderQuery): Array<[string, string]> {
  const filters: Array<[string, string]> = [];
  if (query.state) filters.push(['filters[state]', query.state]);
  if (query.district) filters.push(['filters[district]', query.district]);
  if (query.market) filters.push(['filters[market]', query.market]);
  if (query.crop) filters.push(['filters[commodity]', query.crop]);
  return filters;
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** Applies the filters the upstream cannot do itself. */
function matchesQuery(observation: ProviderObservation, query: ProviderQuery): boolean {
  if (query.crop) {
    const wanted = query.crop.trim().toLowerCase();
    if (
      !sameText(observation.cropName, wanted) &&
      slugify(observation.cropName) !== slugify(query.crop)
    ) {
      return false;
    }
  }
  if (query.market && !sameText(observation.marketName, query.market)) return false;
  if (query.state && !sameText(observation.state, query.state)) return false;
  if (query.district && !sameText(observation.district, query.district)) return false;

  const observed = observation.observedAt.getTime();
  if (query.from && observed < query.from.getTime()) return false;
  if (query.to && observed > query.to.getTime()) return false;

  return true;
}

/** Picks the most recent observation per market, for the market list. */
function pickLatest(observations: ProviderObservation[]): ProviderObservation | null {
  if (observations.length === 0) return null;

  let latest = observations[0]!;
  for (const observation of observations) {
    if (observation.observedAt.getTime() > latest.observedAt.getTime()) {
      latest = observation;
    }
  }

  const latestTime = latest.observedAt.getTime();
  const sameDay = observations.filter((o) => o.observedAt.getTime() === latestTime);

  // Several commodities can share the latest date in one market. The crop
  // name breaks the tie so the same market always reports the same crop.
  sameDay.sort((a, b) => a.cropName.localeCompare(b.cropName));
  return sameDay[0]!;
}

/** Builds the official provider. */
export function createDataGovInProvider(options: DataGovInProviderOptions): MandiPriceProvider {
  const { config } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());

  /** Short-lived page cache, so a dashboard refresh does not re-read the upstream. */
  const cache = new Map<string, { page: CachedPage; expiresAt: number }>();

  /** The time of the last upstream call, used to space calls out. */
  let lastUpstreamCallAt = 0;

  const configurationIssue = config.apiKey
    ? null
    : 'MANDI_PROVIDER_API_KEY is not set, so the live mandi provider cannot run.';

  async function readPage(
    offset: number,
    filters: Array<[string, string]>,
  ): Promise<CachedPage> {
    if (!config.apiKey) {
      throw new ProviderNotConfiguredError(configurationIssue ?? 'The live provider is not configured.');
    }

    const url = new URL(config.baseUrl + '/' + config.resourceId);
    url.searchParams.set('api-key', config.apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(UPSTREAM_PAGE_SIZE));
    url.searchParams.set('offset', String(offset));
    for (const [name, value] of filters) {
      url.searchParams.set(name, value);
    }

    const cacheKey = url.toString();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now().getTime()) {
      // Served from the cache: the records are real, but they were not fetched
      // during this request, so they are reported as RECENT rather than LIVE.
      return { ...cached.page, dataStatus: 'RECENT' };
    }

    let lastError: ProviderError | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      // Space upstream calls out so a burst of API requests cannot become a
      // burst of upstream requests and trip the service's own limit.
      const sinceLastCall = now().getTime() - lastUpstreamCallAt;
      if (lastUpstreamCallAt !== 0 && sinceLastCall < config.minIntervalMs) {
        await sleep(config.minIntervalMs - sinceLastCall);
      }
      lastUpstreamCallAt = now().getTime();

      try {
        const response = await fetchImpl(url.toString(), {
          signal: AbortSignal.timeout(config.timeoutMs),
          headers: { accept: 'application/json' },
        });

        if (response.status === 429) {
          lastError = new ProviderRateLimitedError(
            'The mandi data provider refused the request because of a request budget.',
          );
        } else if (response.status === 401 || response.status === 403) {
          // The upstream rejects a missing or unknown key this way. Retrying
          // cannot help, so the failure is reported straight away.
          throw new ProviderNotConfiguredError(
            'The mandi data provider rejected the configured API key.',
          );
        } else if (!response.ok) {
          lastError = new ProviderUnavailableError(
            'The mandi data provider answered with HTTP ' + response.status + '.',
          );
        } else {
          const text = await response.text();
          let payload: unknown;
          try {
            payload = JSON.parse(text);
          } catch {
            throw new ProviderInvalidResponseError(
              'The mandi data provider returned a response that is not valid JSON.',
            );
          }

          const envelope = parseDataGovInEnvelope(payload);
          const page: CachedPage = {
            records: envelope.records,
            total: envelope.total,
            fetchedAt: now(),
            dataStatus: 'LIVE',
          };

          cache.set(cacheKey, { page, expiresAt: now().getTime() + config.cacheTtlMs });
          return page;
        }
      } catch (error) {
        // A malformed payload or a rejected key will not improve on a retry.
        if (isProviderError(error) && error.kind !== 'unavailable') throw error;

        const reason = error instanceof Error ? error.message : 'unknown error';
        lastError = new ProviderUnavailableError(
          'The mandi data provider could not be reached: ' + reason,
        );
      }

      if (attempt < config.maxRetries) {
        // A throttled upstream needs a longer pause than a dropped connection.
        const delay =
          lastError?.kind === 'rate-limited'
            ? config.throttleDelayMs * (attempt + 1)
            : config.retryDelayMs * (attempt + 1);
        await sleep(delay);
      }
    }

    throw lastError ?? new ProviderUnavailableError('The mandi data provider could not be reached.');
  }

  /** Reads pages until the requested number of matching records is reached. */
  async function collect(
    query: ProviderQuery,
  ): Promise<{ observations: ProviderObservation[]; total: number; truncated: boolean; skipped: number }> {
    const filters = buildUpstreamFilters(query);
    const observations: ProviderObservation[] = [];
    let total = 0;
    let offset = query.offset;
    let pages = 0;
    let exhausted = false;
    let skipped = 0;

    while (observations.length < query.limit && pages < config.maxPages) {
      const page = await readPage(offset, filters);
      if (pages === 0) total = page.total;
      pages++;

      if (page.records.length === 0) {
        exhausted = true;
        break;
      }

      for (const raw of page.records) {
        const observation = normalizeDataGovInRecord(raw, {
          source: DATA_GOV_IN_SOURCE_ID,
          dataStatus: page.dataStatus,
          fetchedAt: page.fetchedAt,
        });

        if (!observation) {
          // An unusable upstream row is dropped, never replaced.
          skipped++;
          continue;
        }
        if (!matchesQuery(observation, query)) continue;

        observations.push(observation);
        if (observations.length >= query.limit) break;
      }

      offset += page.records.length;
      if (page.records.length < UPSTREAM_PAGE_SIZE) {
        exhausted = true;
        break;
      }
    }

    const truncated = !exhausted && offset < total && observations.length < query.limit;

    return { observations, total, truncated, skipped };
  }

  return {
    id: DATA_GOV_IN_SOURCE_ID,
    displayName: 'data.gov.in daily mandi prices (Ministry of Agriculture and Farmers Welfare)',
    mode: 'live',
    dataStatus: 'LIVE',
    isDemo: false,
    // True because the resource was contacted and answered during development.
    // It does not claim the upstream is reachable right now.
    verifiedLive: true,
    configured: config.apiKey !== null,
    configurationIssue,
    sourceUrl: DEFAULT_SOURCE_URL,
    attribution: 'Source: data.gov.in, Ministry of Agriculture and Farmers Welfare (Government Open Data Licence - India).',

    async listObservations(query: ProviderQuery): Promise<ProviderResult<ProviderObservation>> {
      const result = await collect(query);

      if (result.skipped > 0) {
        console.warn(
          '[provider:data-gov-in] dropped ' + result.skipped + ' unusable upstream record(s).',
        );
      }

      return {
        items: result.observations,
        total: result.total,
        truncated: result.truncated,
      };
    },

    async listMarkets(query: ProviderQuery): Promise<ProviderResult<ProviderMarket>> {
      const result = await collect({ ...query, limit: Math.max(query.limit, 1) });

      const byMarket = new Map<string, ProviderObservation[]>();
      for (const observation of result.observations) {
        const key = observation.marketSlug;
        const list = byMarket.get(key);
        if (list) list.push(observation);
        else byMarket.set(key, [observation]);
      }

      const items: ProviderMarket[] = [];
      for (const [slug, observations] of byMarket) {
        const latest = pickLatest(observations);
        if (!latest) continue;
        items.push({
          slug,
          name: latest.marketName,
          state: latest.state,
          district: latest.district,
          locality: latest.locality,
          source: DATA_GOV_IN_SOURCE_ID,
          dataStatus: latest.dataStatus,
          // The verified resource does not publish coordinates, so distance is
          // never calculated from this source (PRD FR-05).
          hasVerifiedCoordinates: false,
          latitude: null,
          longitude: null,
          latestObservation: latest,
        });
      }

      items.sort((a, b) => a.name.localeCompare(b.name));

      return { items, total: result.total, truncated: result.truncated };
    },
  };
}
