/**
 * The supported-crop catalogue.
 *
 * PRD section 9 lists `GET /api/crops` as "supported crops and metadata".
 * The `Crop` table already holds exactly that - the canonical crop name, the
 * aliases a government source may use, and the category - so this service
 * reads that reference data instead of inventing a second list.
 *
 * The catalogue is reference data, not a price feed. Every crop row carries
 * its own `dataStatus`, and the response says so, so the catalogue is never
 * mistaken for a live feed (AGENTS.md section 3).
 */
import type { DataStatusValue, MandiPriceProvider } from '../providers/types.ts';

/** The largest catalogue the endpoint will return. */
export const DEFAULT_CROP_LIMIT = 100;

/** One row of the crop reference table. */
export type CropCatalogueRow = {
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  dataStatus: string;
};

/**
 * The read side the catalogue needs.
 *
 * It is a port, so the service can be unit tested without a database and
 * the Prisma client is only loaded when the catalogue is really read.
 */
export type CropCatalogue = {
  listCrops(filter: { take: number }): Promise<CropCatalogueRow[]>;
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
    /** True because this list is reference data rather than a price feed. */
    isReferenceData: true;
    /** False when the catalogue could not be read. */
    available: boolean;
    dataStatus: DataStatusValue;
    notice: string;
  };
  /** The provider that answers price requests, so a client can compare. */
  provider: {
    id: string;
    displayName: string;
    mode: 'demo' | 'live';
    configured: boolean;
  };
};

/**
 * Builds the catalogue over the Prisma repository.
 *
 * The database module is imported lazily so a missing `DATABASE_URL` turns
 * into a clear notice in the response instead of crashing the module loader.
 */
export function createDatabaseCropCatalogue(): CropCatalogue {
  return {
    async listCrops(filter) {
      const { listCrops } = await import('../db/repositories.ts');
      return listCrops(filter);
    },
  };
}

/**
 * Lists the crops the platform supports.
 *
 * A failure to read the catalogue is reported as an empty catalogue with an
 * explanation, because the crop filter also accepts free text and the rest
 * of the dashboard keeps working without it.
 */
export async function listSupportedCrops(
  provider: MandiPriceProvider,
  catalogue: CropCatalogue = createDatabaseCropCatalogue(),
  limit: number = DEFAULT_CROP_LIMIT,
): Promise<CropListDto> {
  const providerSummary = {
    id: provider.id,
    displayName: provider.displayName,
    mode: provider.mode,
    configured: provider.configured,
  };

  let rows: CropCatalogueRow[] = [];
  let available = true;

  try {
    rows = await catalogue.listCrops({ take: limit });
  } catch {
    available = false;
  }

  const crops: CropDto[] = rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    aliases: row.aliases,
    category: row.category,
    dataStatus: row.dataStatus as DataStatusValue,
  }));

  const status = crops[0]?.dataStatus ?? 'UNAVAILABLE';

  return {
    crops,
    catalogue: {
      isReferenceData: true,
      available,
      dataStatus: status,
      notice: available
        ? 'These are the crops this platform supports. The commodity names published by ' +
          'the active data source can differ, and any commodity can be typed into the filter.'
        : 'The crop catalogue could not be read, so the crop filter only accepts typed text.',
    },
    provider: providerSummary,
  };
}

