/**
 * The deterministic demo provider.
 *
 * It serves the seeded records that already live in PostgreSQL. Nothing is
 * generated at request time, so the same request always returns the same
 * rows, and running the API never creates new data (Phase 5 checklist).
 *
 * Every record it returns is forced to `DEMO` status with the `demo-seed`
 * source. A stored row that claims to be anything else is skipped rather
 * than served, so a demo price can never be presented as a live one.
 */
import type {
  MandiPriceProvider,
  ProviderMarket,
  ProviderObservation,
  ProviderQuery,
  ProviderResult,
  StoredMarketRow,
  StoredObservationRow,
} from './types.ts';

/** The source id carried by every seeded record. */
export const DEMO_SOURCE_ID = 'demo-seed';

/**
 * The read side the demo provider needs from the database.
 *
 * Keeping this a port means the provider can be unit tested with a fake, and
 * the Prisma client is only loaded when the provider is really used.
 */
export type DemoDataSource = {
  listObservations(
    query: ProviderQuery,
  ): Promise<{ items: StoredObservationRow[]; total: number }>;
  listMarkets(query: ProviderQuery): Promise<{ items: StoredMarketRow[]; total: number }>;
};

function matchesText(value: string, wanted: string): boolean {
  return value.toLowerCase() === wanted.toLowerCase();
}

/** A crop matches by slug, by display name, or by one of its aliases. */
function cropMatches(
  crop: { slug: string; name: string; aliases: string[] },
  wanted: string,
): boolean {
  if (matchesText(crop.slug, wanted)) return true;
  if (matchesText(crop.name, wanted)) return true;
  return crop.aliases.some((alias) => matchesText(alias, wanted));
}

/** A market matches by slug or by display name. */
function marketMatches(market: { slug: string; name: string }, wanted: string): boolean {
  return matchesText(market.slug, wanted) || matchesText(market.name, wanted);
}

function withinDateRange(date: Date, query: ProviderQuery): boolean {
  if (query.from && date.getTime() < query.from.getTime()) return false;
  if (query.to && date.getTime() > query.to.getTime()) return false;
  return true;
}

/** Maps a stored observation onto the provider contract. */
function toObservation(row: StoredObservationRow): ProviderObservation {
  return {
    cropSlug: row.crop.slug,
    cropName: row.crop.name,
    cropVariety: null,
    cropGrade: null,
    marketSlug: row.market.slug,
    marketName: row.market.name,
    state: row.market.state,
    district: row.market.district,
    locality: row.market.locality,
    observedAt: row.observedAt,
    minPrice: row.minPrice,
    maxPrice: row.maxPrice,
    modalPrice: row.modalPrice,
    unit: row.unit,
    currency: 'INR',
    source: DEMO_SOURCE_ID,
    dataStatus: 'DEMO',
    fetchedAt: null,
  };
}

/**
 * Builds the demo provider over a data source.
 *
 * The provider is pure with respect to the database: it filters, maps, and
 * labels rows, and nothing else.
 */
export function createDemoProvider(source: DemoDataSource): MandiPriceProvider {
  return {
    id: DEMO_SOURCE_ID,
    displayName: 'Seeded demonstration data',
    mode: 'demo',
    dataStatus: 'DEMO',
    isDemo: true,
    verifiedLive: false,
    configured: true,
    configurationIssue: null,
    sourceUrl: null,
    attribution: 'Demonstration records seeded by this project. Not real market prices.',

    async listObservations(query: ProviderQuery): Promise<ProviderResult<ProviderObservation>> {
      const page = await source.listObservations(query);

      const items: ProviderObservation[] = [];
      let skipped = 0;

      for (const row of page.items) {
        // A stored row that is not explicitly demo data is never served by the
        // demo provider, whatever the database says about its status.
        if (row.dataStatus !== 'DEMO' || row.source !== DEMO_SOURCE_ID) {
          skipped++;
          continue;
        }

        if (query.crop && !cropMatches(row.crop, query.crop)) continue;
        if (query.market && !marketMatches(row.market, query.market)) continue;
        if (query.state && !matchesText(row.market.state, query.state)) continue;
        if (query.district && !matchesText(row.market.district, query.district)) continue;
        if (!withinDateRange(row.observedAt, query)) continue;

        items.push(toObservation(row));
      }

      if (skipped > 0) {
        console.warn(
          '[provider:demo] skipped ' + skipped + ' stored row(s) that were not labelled DEMO.',
        );
      }

      return { items, total: page.total, truncated: false };
    },

    async listMarkets(query: ProviderQuery): Promise<ProviderResult<ProviderMarket>> {
      const page = await source.listMarkets(query);

      const items: ProviderMarket[] = [];
      let skipped = 0;

      for (const row of page.items) {
        if (row.dataStatus !== 'DEMO' || row.source !== DEMO_SOURCE_ID) {
          skipped++;
          continue;
        }

        if (query.market && !marketMatches(row, query.market)) continue;
        if (query.state && !matchesText(row.state, query.state)) continue;
        if (query.district && !matchesText(row.district, query.district)) continue;

        items.push({
          slug: row.slug,
          name: row.name,
          state: row.state,
          district: row.district,
          locality: row.locality,
          source: DEMO_SOURCE_ID,
          dataStatus: 'DEMO',
          // Demo markets deliberately carry no coordinates, so the API can
          // never show an invented distance (PRD FR-05).
          hasVerifiedCoordinates: row.latitude !== null && row.longitude !== null,
          latitude: row.latitude,
          longitude: row.longitude,
          latestObservation: row.latest ? toObservation(row.latest) : null,
        });
      }

      if (skipped > 0) {
        console.warn(
          '[provider:demo] skipped ' + skipped + ' stored market(s) that were not labelled DEMO.',
        );
      }

      return { items, total: page.total, truncated: false };
    },
  };
}

/**
 * The demo provider wired to PostgreSQL.
 *
 * The database module is imported lazily so that a missing `DATABASE_URL`
 * surfaces as a clear provider error at request time instead of crashing the
 * module loader.
 */
export function createDatabaseDemoProvider(): MandiPriceProvider {
  const dataSource: DemoDataSource = {
    async listObservations(query) {
      const { listPriceRecords } = await import('../db/repositories.ts');
      return listPriceRecords({ ...query, source: DEMO_SOURCE_ID, dataStatus: 'DEMO' });
    },
    async listMarkets(query) {
      const { listMarketRecords } = await import('../db/repositories.ts');
      return listMarketRecords({ ...query, source: DEMO_SOURCE_ID, dataStatus: 'DEMO' });
    },
  };

  return createDemoProvider(dataSource);
}
