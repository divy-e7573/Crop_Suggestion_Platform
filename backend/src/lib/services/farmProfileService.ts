/**
 * The farmer profile service.
 *
 * It validates a submitted profile, works out what data the active provider
 * has for that location, stores the profile, and returns a result the farmer
 * can understand. The route handler only parses, delegates, and wraps the
 * result in the standard envelope (PRD FR-09, AGENTS.md section 2).
 *
 * Scope note: this phase validates and stores the profile only. Crop
 * suggestions and selling-period insights are Phase 8, so the response says
 * so explicitly instead of returning an empty suggestion list that could be
 * mistaken for "no crops suit this farm".
 */
import { z } from 'zod';

import { isProviderError } from '../providers/errors.ts';
import type {
  DataStatusValue,
  MandiPriceProvider,
  ProviderMarket,
  ProviderObservation,
} from '../providers/types.ts';

/** Soil types, matching the `SoilType` enum in the Prisma schema. */
export const SOIL_TYPE_VALUES = [
  'ALLUVIAL',
  'BLACK',
  'RED',
  'LATERITE',
  'SANDY',
  'OTHER',
] as const;

/** Seasons, matching the `Season` enum in the Prisma schema. */
export const SEASON_VALUES = ['KHARIF', 'RABI', 'ZAID', 'WHOLE_YEAR', 'OTHER'] as const;

/** Irrigation types, matching the `IrrigationType` enum in the Prisma schema. */
export const IRRIGATION_TYPE_VALUES = [
  'RAINFED',
  'DRIP',
  'SPRINKLER',
  'FLOOD',
  'CANAL',
  'WELL',
  'OTHER',
] as const;

/** Land-area units, matching the `LandAreaUnit` enum in the Prisma schema. */
export const LAND_AREA_UNIT_VALUES = ['ACRE', 'HECTARE'] as const;

/** Longest accepted state or district name. */
export const MAX_LOCATION_LENGTH = 80;

/** Longest accepted village name or PIN code. */
export const MAX_VILLAGE_LENGTH = 80;

/** Longest accepted current or intended crop name. */
export const MAX_CROP_LENGTH = 120;

/** Largest land area accepted, expressed in acres. */
export const MAX_LAND_AREA_ACRES = 1000;

/** Hectares to acres, used for the range check. */
export const ACRES_PER_HECTARE = 2.47105;

/** A PIN code is exactly six digits. */
export const PIN_CODE_LENGTH = 6;

/** The land area, read from a number or from a numeric string. */
const landAreaSchema = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.union([z.number(), z.string()]),
  )
  .transform((value, ctx) => {
    if (typeof value === 'string' && value === '') {
      ctx.addIssue({ code: 'custom', message: 'Enter the size of your land.' });
      return z.NEVER;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: 'custom', message: 'Enter the land area as a number, for example 2.5.' });
      return z.NEVER;
    }
    return parsed;
  })
  .pipe(z.number().positive('Enter a land area greater than zero.'));

/** A village name, or a six digit PIN code. */
const villageOrPinSchema = z
  .string()
  .trim()
  .max(MAX_VILLAGE_LENGTH, 'Use at most ' + MAX_VILLAGE_LENGTH + ' characters.')
  .refine(
    (value) =>
      value === '' ||
      !/^[0-9]+$/.test(value) ||
      value.length === PIN_CODE_LENGTH,
    'A PIN code has exactly ' + PIN_CODE_LENGTH + ' digits.',
  );

/** An optional field that is treated as absent when it is left blank. */
const optionalText = <T extends z.ZodType<string>>(schema: T) =>
  schema.transform((value) => (value === '' ? undefined : value)).optional();

/**
 * The request body accepted by `POST /api/farm-profile/analyze`.
 *
 * The field names match the form field names exactly, so a validation error
 * can be shown next to the input that caused it.
 */
export const farmProfileSchema = z
  .object({
    state: z
      .string()
      .trim()
      .min(1, 'Enter the state where your farm is.')
      .max(MAX_LOCATION_LENGTH, 'Use at most ' + MAX_LOCATION_LENGTH + ' characters for the state.'),
    district: z
      .string()
      .trim()
      .min(1, 'Enter the district where your farm is.')
      .max(
        MAX_LOCATION_LENGTH,
        'Use at most ' + MAX_LOCATION_LENGTH + ' characters for the district.',
      ),
    soilType: z.enum(SOIL_TYPE_VALUES, {
      error: 'Choose the soil type on your farm.',
    }),
    season: z.enum(SEASON_VALUES, { error: 'Choose the season you plan to farm in.' }),
    landArea: landAreaSchema,
    landAreaUnit: z.enum(LAND_AREA_UNIT_VALUES, {
      error: 'Choose the unit your land area is measured in.',
    }),
    villageOrPin: optionalText(villageOrPinSchema),
    irrigationType: z.enum(IRRIGATION_TYPE_VALUES).optional(),
    currentCrop: optionalText(
      z
        .string()
        .trim()
        .max(
          MAX_CROP_LENGTH,
          'Use at most ' + MAX_CROP_LENGTH + ' characters for the crop name.',
        ),
    ),
  })
  .superRefine((value, ctx) => {
    const acres =
      value.landAreaUnit === 'HECTARE' ? value.landArea * ACRES_PER_HECTARE : value.landArea;
    if (acres > MAX_LAND_AREA_ACRES) {
      ctx.addIssue({
        code: 'custom',
        path: ['landArea'],
        message: 'That looks too large. Check the number, or use a smaller unit.',
      });
    }
  });

export type FarmProfileInput = z.infer<typeof farmProfileSchema>;

/** The stored profile, as the API returns it. */
export type FarmProfileDto = {
  id: string;
  state: string;
  district: string;
  soilType: (typeof SOIL_TYPE_VALUES)[number];
  season: (typeof SEASON_VALUES)[number];
  landArea: number;
  landAreaUnit: (typeof LAND_AREA_UNIT_VALUES)[number];
  /** The same area converted to acres, so a farmer can compare two entries. */
  landAreaInAcres: number;
  villageOrPin: string | null;
  irrigationType: (typeof IRRIGATION_TYPE_VALUES)[number] | null;
  currentCrop: string | null;
  createdAt: string;
};

/** What the data source could resolve for the submitted location. */
export type MatchingDataDto = {
  priceObservations: number;
  markets: number;
  /** False when the provider could only read part of the source. */
  isComplete: boolean;
  dataStatus: DataStatusValue;
  source: string;
  notice: string;
};

export type FarmProfileAnalysisDto = {
  profileId: string;
  savedAt: string;
  profile: FarmProfileDto;
  matchingData: MatchingDataDto;
  analysis: {
    status: 'not_computed';
    cropSuggestions: null;
    sellingInsights: null;
    message: string;
  };
  notice: string;
};

/** Converts the submitted area into acres, for a comparable number. */
export function toAcres(landArea: number, unit: string): number {
  const acres = unit === 'HECTARE' ? landArea * ACRES_PER_HECTARE : landArea;
  return Math.round(acres * 100) / 100;
}

/** Counts the distinct markets in a list of observations. */
function countDistinctMarkets(observations: ProviderObservation[]): number {
  return new Set(observations.map((observation) => observation.marketSlug)).size;
}

/** Counts the distinct markets in a list of markets. */
function countMarkets(markets: ProviderMarket[]): number {
  return new Set(markets.map((market) => market.slug)).size;
}

/**
 * Asks the provider what it has for the submitted location.
 *
 * A provider failure is not fatal: the profile is still valid and worth
 * storing, so the caller records the failure and carries on with an
 * `UNAVAILABLE` status instead (PRD section 12).
 */
export async function summariseMatchingData(
  provider: MandiPriceProvider,
  input: FarmProfileInput,
): Promise<MatchingDataDto> {
  const observations = await provider.listObservations({
    state: input.state,
    district: input.district,
    limit: 1,
    offset: 0,
  });

  const markets = await provider.listMarkets({
    state: input.state,
    district: input.district,
    limit: 10,
    offset: 0,
  });

  const distinctMarkets = Math.max(
    countDistinctMarkets(observations.items),
    countMarkets(markets.items),
  );

  const status = observations.items[0]?.dataStatus ?? provider.dataStatus;

  return {
    priceObservations: observations.total,
    markets: distinctMarkets,
    isComplete: !observations.truncated && !markets.truncated,
    dataStatus: provider.configured ? status : 'UNAVAILABLE',
    source: provider.id,
    notice: provider.isDemo
      ? 'These are seeded demonstration records. They are not real mandi prices.'
      : 'Matched against the official data.gov.in mandi price source.',
  };
}

/** Builds the failure summary used when the provider cannot answer. */
export function unavailableMatchingData(provider: MandiPriceProvider, message: string): MatchingDataDto {
  return {
    priceObservations: 0,
    markets: 0,
    isComplete: false,
    dataStatus: 'UNAVAILABLE',
    source: provider.id,
    notice: message,
  };
}

/** True when the error came from the data provider rather than from a fault. */
export function isRecoverableProviderFailure(error: unknown): boolean {
  return isProviderError(error);
}
