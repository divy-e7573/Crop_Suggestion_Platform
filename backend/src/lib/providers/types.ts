/**
 * The contract shared by every mandi data source.
 *
 * PRD FR-11 asks for a provider interface so an official data source can be
 * connected later without rewriting the UI, the route handlers, or the
 * recommendation logic. This module is that contract: it describes what a
 * provider returns, not where the data came from.
 *
 * The type module deliberately imports nothing, so every other module can
 * depend on it without dragging in Prisma, the network, or the database.
 */

/** Which kind of source a provider is. */
export type ProviderMode = 'demo' | 'live';

/**
 * Freshness of a record.
 *
 * These are the same four states as the `DataStatus` enum in the Prisma
 * schema. They are repeated here as plain string unions so the provider layer
 * stays independent of the generated Prisma client; the database layer
 * assigns Prisma rows to these types, so the compiler proves the two lists
 * still agree.
 */
export type DataStatusValue = 'LIVE' | 'RECENT' | 'DEMO' | 'UNAVAILABLE';

/** The price unit, always combined with the INR currency. */
export type PriceUnitValue =
  | 'RUPEES_PER_QUINTAL'
  | 'RUPEES_PER_KILOGRAM'
  | 'RUPEES_PER_TONNE';

/** Human-readable unit label, so a client never has to guess the unit. */
export const PRICE_UNIT_LABELS: Record<PriceUnitValue, string> = {
  RUPEES_PER_QUINTAL: 'INR per quintal',
  RUPEES_PER_KILOGRAM: 'INR per kilogram',
  RUPEES_PER_TONNE: 'INR per tonne',
};

/** Filters shared by the price and market lookups. */
export type ProviderQuery = {
  /** Crop slug, crop name, or alias. Matched case-insensitively. */
  crop?: string;
  /** Market slug or market name. Matched case-insensitively. */
  market?: string;
  state?: string;
  district?: string;
  /** Inclusive lower bound on the observation date. */
  from?: Date;
  /** Inclusive upper bound on the observation date. */
  to?: Date;
  limit: number;
  offset: number;
};

/** A page of results plus the number of matching records the source knows about. */
export type ProviderResult<T> = {
  items: T[];
  /** Total matching records reported by the source, not the page size. */
  total: number;
  /** True when the source had more records than this request could fetch. */
  truncated: boolean;
};

/** One observed price, normalized so every source looks the same to callers. */
export type ProviderObservation = {
  cropSlug: string;
  cropName: string;
  /** Source-specific variety and grade, when the source publishes them. */
  cropVariety: string | null;
  cropGrade: string | null;
  marketSlug: string;
  marketName: string;
  state: string;
  district: string;
  locality: string | null;
  /** The date the price was observed, as UTC midnight of that calendar day. */
  observedAt: Date;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: PriceUnitValue;
  currency: 'INR';
  /** Provenance id, for example `demo-seed` or `data-gov-in`. */
  source: string;
  dataStatus: DataStatusValue;
  /** When the record was retrieved. Null for records never fetched. */
  fetchedAt: Date | null;
};

/** One market, normalized. */
export type ProviderMarket = {
  slug: string;
  name: string;
  state: string;
  district: string;
  locality: string | null;
  source: string;
  dataStatus: DataStatusValue;
  /** True only when the source published verified coordinates. */
  hasVerifiedCoordinates: boolean;
  latitude: number | null;
  longitude: number | null;
  /** The most recent observation for this market, when the source has one. */
  latestObservation: ProviderObservation | null;
};

/** A price observation joined with its market and crop, as stored. */
export type StoredObservationRow = {
  observedAt: Date;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: PriceUnitValue;
  source: string;
  dataStatus: DataStatusValue;
  fetchedAt: Date | null;
  crop: { slug: string; name: string; aliases: string[] };
  market: {
    slug: string;
    name: string;
    state: string;
    district: string;
    locality: string | null;
    source: string;
    dataStatus: DataStatusValue;
  };
};

/** A market as stored, plus its latest observation when there is one. */
export type StoredMarketRow = {
  slug: string;
  name: string;
  state: string;
  district: string;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  dataStatus: DataStatusValue;
  latest: StoredObservationRow | null;
};

/**
 * The read side of a data source.
 *
 * A provider must return normalized records, must label the freshness of
 * every record, and must never invent data: when the upstream source fails,
 * it raises a `ProviderError` instead of returning fallback rows.
 */
export interface MandiPriceProvider {
  /** Stable id, also used as the `source` value on every record. */
  readonly id: string;
  readonly displayName: string;
  readonly mode: ProviderMode;
  /** The status carried by the records this provider returns. */
  readonly dataStatus: DataStatusValue;
  /** True when the provider returns seeded demonstration records. */
  readonly isDemo: boolean;
  /**
   * True only for a provider whose upstream was contacted and verified during
   * development. It never means "the upstream is healthy right now".
   */
  readonly verifiedLive: boolean;
  /** False when the provider cannot run, for example a missing API key. */
  readonly configured: boolean;
  /** Why the provider cannot run, when it cannot. */
  readonly configurationIssue: string | null;
  /** Link to the human-readable source page, when there is one. */
  readonly sourceUrl: string | null;
  /** Attribution line shown with the data. */
  readonly attribution: string;
  listObservations(query: ProviderQuery): Promise<ProviderResult<ProviderObservation>>;
  listMarkets(query: ProviderQuery): Promise<ProviderResult<ProviderMarket>>;
}
