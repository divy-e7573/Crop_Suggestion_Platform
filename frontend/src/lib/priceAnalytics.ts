/**
 * Pure helpers behind the mandi price dashboard.
 *
 * Everything in this module is a calculation on data the API already
 * returned. No value is invented here: a summary is null when there is
 * nothing to summarise, and a chart series is empty when the data does not
 * match the crop and market the user asked for (AGENTS.md section 3).
 */
import type {
  CropDto,
  DataStatusValue,
  MarketDto,
  PriceObservationDto,
  PriceSeriesDto,
} from './mandiApi';

/** A rounded to two decimal places, so averages do not show float noise. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The minimum, maximum, and average of the observations on screen. */
export type PriceSummary = {
  /** How many observations were summarised. */
  count: number;
  /** How many observations were handed in. */
  totalCount: number;
  unit: string;
  unitLabel: string;
  currency: string;
  minPrice: number;
  maxPrice: number;
  /** The mean modal price, which is the price farmers compare. */
  averageModalPrice: number;
  /** True when some observations used another unit and were left out. */
  mixedUnits: boolean;
};

/**
 * Summarises the prices on screen.
 *
 * Observations are only added together when they share a unit, because a
 * mean of rupees per quintal and rupees per tonne would be meaningless.
 * Returns null when there is nothing to summarise.
 */
export function summariseObservations(
  observations: PriceObservationDto[],
): PriceSummary | null {
  if (observations.length === 0) return null;

  const unit = observations[0].unit;
  const sameUnit = observations.filter((observation) => observation.unit === unit);
  const pool = sameUnit.length > 0 ? sameUnit : observations;

  let total = 0;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;

  for (const observation of pool) {
    total += observation.modalPrice;
    if (observation.minPrice < minPrice) minPrice = observation.minPrice;
    if (observation.maxPrice > maxPrice) maxPrice = observation.maxPrice;
  }

  return {
    count: pool.length,
    totalCount: observations.length,
    unit: pool[0].unit,
    unitLabel: pool[0].unitLabel,
    currency: pool[0].currency,
    minPrice,
    maxPrice,
    averageModalPrice: round2(total / pool.length),
    mixedUnits: pool.length !== observations.length,
  };
}

/** One market in the market comparison. */
export type MarketComparisonRow = {
  marketSlug: string;
  marketName: string;
  state: string;
  district: string;
  observedAt: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  unitLabel: string;
  currency: string;
  dataStatus: DataStatusValue;
};

/** The market comparison for one crop. */
export type MarketComparison = {
  cropSlug: string;
  cropName: string;
  unit: string;
  unitLabel: string;
  currency: string;
  /** Newest price per market, highest modal price first. */
  rows: MarketComparisonRow[];
  /** True when some markets were left out because they used another unit. */
  mixedUnits: boolean;
};

/** True when the observation belongs to the crop the user asked for. */
function isCrop(observation: PriceObservationDto, wanted: string): boolean {
  return (
    observation.crop.slug.toLowerCase() === wanted ||
    observation.crop.name.toLowerCase() === wanted
  );
}

/**
 * Compares the newest price of one crop across markets.
 *
 * Only observations of the requested crop are used, and only the newest
 * observation per market, so one bar is one market and one price. Returns
 * null when there is nothing to compare.
 */
export function compareMarkets(
  observations: PriceObservationDto[],
  crop: string,
): MarketComparison | null {
  const wanted = crop.trim().toLowerCase();
  if (wanted === '') return null;

  const matching = observations.filter((observation) => isCrop(observation, wanted));
  if (matching.length === 0) return null;

  const latestByMarket = new Map<string, PriceObservationDto>();
  for (const observation of matching) {
    const existing = latestByMarket.get(observation.market.slug);
    if (!existing || observation.observedAt > existing.observedAt) {
      latestByMarket.set(observation.market.slug, observation);
    }
  }

  const newest = matching[0];
  const sameUnit = [...latestByMarket.values()].filter(
    (observation) => observation.unit === newest.unit,
  );
  const pool = sameUnit.length > 0 ? sameUnit : [...latestByMarket.values()];

  const rows: MarketComparisonRow[] = pool
    .map((observation) => ({
      marketSlug: observation.market.slug,
      marketName: observation.market.name,
      state: observation.market.state,
      district: observation.market.district,
      observedAt: observation.observedAt,
      modalPrice: observation.modalPrice,
      minPrice: observation.minPrice,
      maxPrice: observation.maxPrice,
      unit: observation.unit,
      unitLabel: observation.unitLabel,
      currency: observation.currency,
      dataStatus: observation.dataStatus,
    }))
    .sort((left, right) => right.modalPrice - left.modalPrice);

  return {
    cropSlug: newest.crop.slug,
    cropName: newest.crop.name,
    unit: pool[0].unit,
    unitLabel: pool[0].unitLabel,
    currency: pool[0].currency,
    rows,
    mixedUnits: pool.length !== latestByMarket.size,
  };
}

/** One point of a chart. */
export type ChartPoint = {
  /** Unix time in seconds, the unit a uPlot time axis expects. */
  x: number;
  /** The modal price. */
  y: number;
  /** The calendar day the price was observed. */
  observedAt: string;
};

/** True when a slug or a name matches what the user asked for. */
function matchesIdentifier(slug: string, name: string, wanted: string): boolean {
  const target = wanted.trim().toLowerCase();
  if (target === '') return false;
  return slug.toLowerCase() === target || name.toLowerCase() === target;
}

/**
 * Turns a price series into chart points.
 *
 * The series is only drawn when it really is the crop and market the user
 * asked for. A mismatch returns an empty array, so a line can never join two
 * commodities or two markets (PRD FR-04).
 */
export function toChartPoints(
  series: PriceSeriesDto,
  expected: { crop: string; market: string },
): ChartPoint[] {
  const cropMatches = matchesIdentifier(
    series.series.crop.slug,
    series.series.crop.name,
    expected.crop,
  );
  const marketMatches = matchesIdentifier(
    series.series.market.slug,
    series.series.market.name,
    expected.market,
  );

  if (!cropMatches || !marketMatches) return [];

  const points: ChartPoint[] = [];
  for (const point of series.series.points) {
    const time = Date.parse(point.observedAt + 'T00:00:00.000Z');
    if (Number.isNaN(time)) continue;
    points.push({
      x: Math.floor(time / 1000),
      y: point.modalPrice,
      observedAt: point.observedAt,
    });
  }

  points.sort((left, right) => left.x - right.x);
  return points;
}

/** The crops that appear in the observations on screen. */
export function distinctCrops(
  observations: PriceObservationDto[],
): Array<{ slug: string; name: string }> {
  const names = new Map<string, string>();
  for (const observation of observations) {
    if (!names.has(observation.crop.slug)) {
      names.set(observation.crop.slug, observation.crop.name);
    }
  }

  return [...names.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Finds the catalogue slug for a typed crop name.
 *
 * A crop can be typed as its slug, its name, or one of its aliases, so the
 * filter accepts all three. Text that is not in the catalogue is passed
 * through unchanged, because the data source may publish commodities this
 * project does not know about yet.
 */
export function resolveCropSlug(catalogue: CropDto[], text: string): string {
  const wanted = text.trim().toLowerCase();
  if (wanted === '') return '';

  for (const crop of catalogue) {
    if (crop.slug.toLowerCase() === wanted) return crop.slug;
    if (crop.name.toLowerCase() === wanted) return crop.slug;
    if (crop.aliases.some((alias) => alias.toLowerCase() === wanted)) return crop.slug;
  }

  return text.trim();
}

/** Finds the market slug for a typed market name, or passes the text through. */
export function resolveMarketSlug(markets: MarketDto[], text: string): string {
  const wanted = text.trim().toLowerCase();
  if (wanted === '') return '';

  for (const market of markets) {
    if (market.slug.toLowerCase() === wanted) return market.slug;
    if (market.name.toLowerCase() === wanted) return market.slug;
  }

  return text.trim();
}

/** The states the known markets sit in, for the state filter. */
export function stateOptions(markets: MarketDto[]): string[] {
  return [...new Set(markets.map((market) => market.state))].sort();
}

/**
 * The districts the state filter can offer.
 *
 * A chosen state narrows the list to its own districts, but the list is
 * always built from every known market, so another state can still be
 * picked afterwards.
 */
export function districtOptions(markets: MarketDto[], state: string): string[] {
  const names = markets
    .filter((market) => !state || market.state === state)
    .map((market) => market.district);
  return [...new Set(names)].sort();
}

/** The markets that match the chosen state and district. */
export function relevantMarkets(
  markets: MarketDto[],
  filters: { state: string; district: string },
): MarketDto[] {
  return markets.filter(
    (market) =>
      (!filters.state || market.state === filters.state) &&
      (!filters.district || market.district === filters.district),
  );
}

/** Formats a price in Indian rupees, without decimals. */
export function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formats an observation date such as 2026-01-11 as 11 Jan 2026. */
export function formatObservationDate(iso: string): string {
  const time = Date.parse(iso + 'T00:00:00.000Z');
  if (Number.isNaN(time)) return iso;

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(time));
}

/** Describes the date range the results cover. */
export function formatDateRange(from: string, to: string): string {
  if (from && to) {
    return formatObservationDate(from) + ' to ' + formatObservationDate(to);
  }
  if (from) return 'from ' + formatObservationDate(from);
  if (to) return 'up to ' + formatObservationDate(to);
  return 'all recorded dates';
}

/** The status a record carries, mapped onto the shared badge vocabulary. */
export function toBadgeStatus(status: DataStatusValue): 'live' | 'recent' | 'demo' | 'unavailable' {
  switch (status) {
    case 'LIVE':
      return 'live';
    case 'RECENT':
      return 'recent';
    case 'DEMO':
      return 'demo';
    default:
      return 'unavailable';
  }
}
