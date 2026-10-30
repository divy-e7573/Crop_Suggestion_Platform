/**
 * Read-only repository helpers over the Prisma client.
 *
 * These deliberately return raw rows and know nothing about HTTP. Route
 * handlers in later phases will call these and map the result onto the API
 * envelope themselves, which keeps database concerns out of the response layer
 * (PRD FR-09, AGENTS.md section 2).
 *
 * Nothing here is called by an endpoint yet; the Phase 5 endpoints will use it.
 */
import { prisma } from './client.ts';

import type {
  DataStatusValue,
  ProviderQuery,
  StoredMarketRow,
  StoredObservationRow,
} from '../providers/types.ts';

export type PriceFilter = {
  cropSlug?: string;
  marketSlug?: string;
  state?: string;
  district?: string;
  from?: Date;
  to?: Date;
  take: number;
};

/**
 * Lists price observations newest first.
 *
 * `dataStatus` is always selected so a caller can never forget to label the
 * result, which is what keeps demo rows from being shown as live data.
 */
export async function listPriceObservations(filter: PriceFilter) {
  return prisma.mandiPriceObservation.findMany({
    where: {
      ...(filter.cropSlug ? { crop: { slug: filter.cropSlug } } : {}),
      ...(filter.marketSlug ? { market: { slug: filter.marketSlug } } : {}),
      ...(filter.state || filter.district
        ? {
            market: {
              ...(filter.marketSlug ? { slug: filter.marketSlug } : {}),
              ...(filter.state ? { state: { equals: filter.state, mode: 'insensitive' as const } } : {}),
              ...(filter.district
                ? { district: { equals: filter.district, mode: 'insensitive' as const } }
                : {}),
            },
          }
        : {}),
      ...(filter.from || filter.to
        ? {
            observedAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    },
    include: {
      crop: { select: { slug: true, name: true } },
      market: {
        select: {
          slug: true,
          name: true,
          state: true,
          district: true,
          latitude: true,
          longitude: true,
          dataStatus: true,
        },
      },
    },
    orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
    take: filter.take,
  });
}

/** Markets, optionally narrowed to one state or district. */
export async function listMarkets(filter: { state?: string; district?: string; take: number }) {
  return prisma.market.findMany({
    where: {
      ...(filter.state ? { state: { equals: filter.state, mode: 'insensitive' as const } } : {}),
      ...(filter.district
        ? { district: { equals: filter.district, mode: 'insensitive' as const } }
        : {}),
    },
    orderBy: [{ state: 'asc' }, { district: 'asc' }, { name: 'asc' }],
    take: filter.take,
  });
}

/** Crops with their alias list, used to populate filter options later. */
export async function listCrops(filter: { take: number }) {
  return prisma.crop.findMany({
    select: { slug: true, name: true, aliases: true, category: true, dataStatus: true },
    orderBy: { name: 'asc' },
    take: filter.take,
  });
}

/**
 * The historical series for one crop at one market, oldest first.
 *
 * Phase 8 needs this to decide whether there are enough observations for a
 * forecast; returning the raw series keeps that decision testable.
 */
export async function getPriceHistory(input: {
  cropSlug: string;
  marketSlug: string;
  take: number;
}) {
  return prisma.mandiPriceObservation.findMany({
    where: { crop: { slug: input.cropSlug }, market: { slug: input.marketSlug } },
    select: {
      observedAt: true,
      minPrice: true,
      maxPrice: true,
      modalPrice: true,
      unit: true,
      source: true,
      dataStatus: true,
    },
    orderBy: { observedAt: 'asc' },
    take: input.take,
  });
}

/* -------------------------------------------------------------------------
 * Provider-facing queries
 *
 * The helpers above keep the raw Prisma rows the Phase 4 verification script
 * relies on. The ones below are shaped for the Phase 5 provider layer: they
 * return plain objects, they always scope the result to a single source and
 * data status, and they never mix live records with seeded demo records.
 * ---------------------------------------------------------------------- */

export type StoredPriceQuery = ProviderQuery & {
  /** Only rows written by this source are returned. */
  source: string;
  /** Only rows with this freshness status are returned. */
  dataStatus: DataStatusValue;
};

export type StoredMarketQuery = ProviderQuery & {
  source: string;
  dataStatus: DataStatusValue;
};

const observationInclude = {
  crop: { select: { slug: true, name: true, aliases: true } },
  market: {
    select: {
      slug: true,
      name: true,
      state: true,
      district: true,
      locality: true,
      source: true,
      dataStatus: true,
    },
  },
} as const;

/** Builds the crop filter used by both the price and market lookups. */
function cropWhere(crop: string | undefined) {
  if (!crop) return undefined;
  return {
    is: {
      OR: [
        { slug: { equals: crop, mode: 'insensitive' as const } },
        { name: { equals: crop, mode: 'insensitive' as const } },
        { aliases: { has: crop } },
      ],
    },
  };
}

/** Builds the market filter used by the price lookup. */
function marketWhere(market: string | undefined) {
  if (!market) return undefined;
  return {
    is: {
      OR: [
        { slug: { equals: market, mode: 'insensitive' as const } },
        { name: { equals: market, mode: 'insensitive' as const } },
      ],
    },
  };
}

/** Builds the observation filter shared by the list and count queries. */
function observationWhere(query: StoredPriceQuery) {
  const crop = cropWhere(query.crop);
  const market = marketWhere(query.market);

  return {
    source: query.source,
    dataStatus: query.dataStatus,
    ...(crop ? { crop } : {}),
    ...(market ? { market } : {}),
    ...(query.state || query.district
      ? {
          market: {
            is: {
              ...(market ? market.is : {}),
              ...(query.state
                ? { state: { equals: query.state, mode: 'insensitive' as const } }
                : {}),
              ...(query.district
                ? { district: { equals: query.district, mode: 'insensitive' as const } }
                : {}),
            },
          },
        }
      : {}),
    ...(query.from || query.to
      ? {
          observedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };
}

/** Builds the market filter used by the market lookup. */
function marketListWhere(query: StoredMarketQuery) {
  return {
    source: query.source,
    dataStatus: query.dataStatus,
    ...(query.state ? { state: { equals: query.state, mode: 'insensitive' as const } } : {}),
    ...(query.district
      ? { district: { equals: query.district, mode: 'insensitive' as const } }
      : {}),
    ...(query.market
      ? {
          OR: [
            { slug: { equals: query.market, mode: 'insensitive' as const } },
            { name: { equals: query.market, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

/** Converts a stored observation into the plain shape the providers use. */
function toStoredObservation(row: {
  observedAt: Date;
  minPrice: unknown;
  maxPrice: unknown;
  modalPrice: unknown;
  unit: string;
  source: string;
  dataStatus: string;
  fetchedAt: Date | null;
  crop: { slug: string; name: string; aliases: string[] };
  market: {
    slug: string;
    name: string;
    state: string;
    district: string;
    locality: string | null;
    source: string;
    dataStatus: string;
  };
}): StoredObservationRow {
  return {
    observedAt: row.observedAt,
    minPrice: Number(row.minPrice),
    maxPrice: Number(row.maxPrice),
    modalPrice: Number(row.modalPrice),
    unit: row.unit as StoredObservationRow['unit'],
    source: row.source,
    dataStatus: row.dataStatus as DataStatusValue,
    fetchedAt: row.fetchedAt,
    crop: row.crop,
    market: {
      slug: row.market.slug,
      name: row.market.name,
      state: row.market.state,
      district: row.market.district,
      locality: row.market.locality,
      source: row.market.source,
      dataStatus: row.market.dataStatus as DataStatusValue,
    },
  };
}

/**
 * Lists stored price observations for one source, newest first.
 *
 * The source and data status are always part of the filter, so demo records
 * and provider records can never be mixed in one response.
 */
export async function listPriceRecords(query: StoredPriceQuery): Promise<{
  items: StoredObservationRow[];
  total: number;
}> {
  const where = observationWhere(query);

  const [rows, total] = await Promise.all([
    prisma.mandiPriceObservation.findMany({
      where,
      include: observationInclude,
      orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.mandiPriceObservation.count({ where }),
  ]);

  return { items: rows.map(toStoredObservation), total };
}

/** Counts the stored observations for one source, using the same filters. */
export async function countPriceRecords(query: StoredPriceQuery): Promise<number> {
  return prisma.mandiPriceObservation.count({ where: observationWhere(query) });
}

/**
 * Lists stored markets for one source, with each market's latest observation.
 *
 * The latest observation is found with a grouped maximum rather than one
 * query per market, so the number of round trips stays constant.
 */
export async function listMarketRecords(query: StoredMarketQuery): Promise<{
  items: StoredMarketRow[];
  total: number;
}> {
  const where = marketListWhere(query);

  const [markets, total] = await Promise.all([
    prisma.market.findMany({
      where,
      orderBy: [{ state: 'asc' }, { district: 'asc' }, { name: 'asc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.market.count({ where }),
  ]);

  const marketIds = markets.map((market) => market.id);
  const latestByMarket = new Map<string, StoredObservationRow>();

  if (marketIds.length > 0) {
    const grouped = await prisma.mandiPriceObservation.groupBy({
      by: ['marketId'],
      where: {
        marketId: { in: marketIds },
        source: query.source,
        dataStatus: query.dataStatus,
      },
      _max: { observedAt: true },
    });

    const pairs = grouped.flatMap((group) =>
      group._max.observedAt
        ? [{ marketId: group.marketId, observedAt: group._max.observedAt }]
        : [],
    );

    if (pairs.length > 0) {
      const rows = await prisma.mandiPriceObservation.findMany({
        where: { OR: pairs },
        include: observationInclude,
        orderBy: [{ crop: { name: 'asc' } }],
      });

      for (const row of rows) {
        const marketId = row.marketId;
        // The rows arrive sorted by crop name, so the first one wins the tie
        // when several commodities share the latest date in a market.
        if (!latestByMarket.has(marketId)) {
          latestByMarket.set(marketId, toStoredObservation(row));
        }
      }
    }
  }

  const items: StoredMarketRow[] = markets.map((market) => ({
    slug: market.slug,
    name: market.name,
    state: market.state,
    district: market.district,
    locality: market.locality,
    latitude: market.latitude === null ? null : Number(market.latitude),
    longitude: market.longitude === null ? null : Number(market.longitude),
    source: market.source,
    dataStatus: market.dataStatus as DataStatusValue,
    latest: latestByMarket.get(market.id) ?? null,
  }));

  return { items, total };
}
