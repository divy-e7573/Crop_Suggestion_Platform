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
