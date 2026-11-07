/**
 * The profile analysis orchestrator (PRD FR-06 and FR-07).
 *
 * This module puts the pieces together. It does not do the thinking itself:
 *
 * - The rule engine decides which crops suit the profile.
 * - The trend module works out what the observed prices did.
 * - The forecast module decides whether an estimate is allowed and makes it.
 * - The selling-insight module turns both into words.
 *
 * The orchestrator only decides which crop and which market to look at, and
 * it keeps the honest failure paths: when the rules cannot be read the whole
 * analysis is unavailable, and when the price records cannot be read the
 * crop suggestions still stand and the market part says why it is empty.
 * A provider failure never falls back to demonstration rows.
 */

import type {
  DataStatusValue,
  MandiPriceProvider,
  ProviderObservation,
} from '../providers/types.ts';
import { isProviderError } from '../providers/errors.ts';
import type { FarmProfileDto, MatchingDataDto } from './farmProfileService.ts';
import type { AiNarrativeProvider } from './aiNarrativeProvider.ts';
import {
  rankCropsForProfile,
  type CropSuitabilityResult,
  type CropSuggestionDto,
  type SuitabilityProfile,
  type SuitabilityRule,
} from './cropSuitabilityService.ts';
import { buildForecast, type ForecastDto } from './forecastService.ts';
import {
  buildSellingInsights,
  type SellingInsightsDto,
} from './sellingInsightService.ts';
import {
  analyseTrend,
  dataStatusFor,
  type TrendAnalysisDto,
  type TrendObservation,
} from './trendAnalysisService.ts';

/** How many observations are read for the crop and market analysis. */
export const ANALYSIS_OBSERVATION_LIMIT = 100;

/** The profile the analysis is built from. */
export type AnalysisProfile = {
  id: string;
  state: string;
  district: string;
  soilType: string;
  season: string;
  landArea: number;
  landAreaUnit: string;
  villageOrPin: string | null;
  irrigationType: string | null;
  currentCrop: string | null;
  createdAt: string;
};

/**
 * The read side of the crop rules.
 *
 * It is a port so the orchestrator can be tested with a fake, and the
 * Prisma client is only loaded when the rules are really read.
 */
export type SuitabilityRuleSource = {
  listRules(): Promise<SuitabilityRule[]>;
};

/** How complete the analysis is. */
export type ProfileAnalysisStatus = 'computed' | 'partial' | 'unavailable';

/** The result of analysing one profile. */
export type ProfileAnalysisResult = {
  status: ProfileAnalysisStatus;
  message: string;
  cropSuggestions: CropSuitabilityResult | null;
  sellingInsights: SellingInsightsDto | null;
};

/**
 * The whole response of the farmer profile endpoint.
 *
 * The envelope and the saved profile are unchanged from Phase 6. The
 * analysis block now carries the ranked crop suggestions and the
 * selling-period insights instead of the placeholder that said they were
 * still to come.
 */
export type FarmProfileAnalysisDto = {
  profileId: string;
  savedAt: string;
  profile: FarmProfileDto;
  matchingData: MatchingDataDto;
  analysis: {
    status: ProfileAnalysisStatus;
    /** A plain-language sentence describing what was and was not computed. */
    message: string;
    /** The ranked crop suggestions, when the rules could be read. */
    cropSuggestions: CropSuitabilityResult | null;
    /** The selling-period insights, when the market data could be read. */
    sellingInsights: SellingInsightsDto | null;
  };
  notice: string;
};

/**
 * The response of the endpoint that reads the most recent analysis.
 *
 * The optional village or PIN detail is deliberately not included here.
 * The analysis never uses it, and the crop-suggestions page does not need
 * it, so it is not repeated in a second response (PRD section 13).
 */
export type LatestProfileAnalysisDto = {
  profileId: string | null;
  savedAt: string | null;
  profile: {
    state: string;
    district: string;
    soilType: string;
    season: string;
    landArea: number;
    landAreaUnit: string;
    landAreaInAcres: number;
    irrigationType: string | null;
    currentCrop: string | null;
  } | null;
  analysis: {
    status: ProfileAnalysisStatus;
    message: string;
    cropSuggestions: CropSuitabilityResult | null;
    sellingInsights: SellingInsightsDto | null;
  };
  notice: string;
};

/** The crop rules, read from PostgreSQL. */
export function createDatabaseSuitabilityRuleSource(): SuitabilityRuleSource {
  return {
    async listRules() {
      const { listCropSuitabilityRules } = await import('../db/repositories.ts');
      return listCropSuitabilityRules();
    },
  };
}

/** One market and the observations that were read for it. */
type MarketGroup = {
  slug: string;
  name: string;
  state: string;
  district: string;
  observations: ProviderObservation[];
};

/** Groups the observations by the market they belong to. */
function groupByMarket(observations: ProviderObservation[]): MarketGroup[] {
  const groups = new Map<string, MarketGroup>();

  for (const observation of observations) {
    const existing = groups.get(observation.marketSlug);
    if (existing) {
      existing.observations.push(observation);
      continue;
    }

    groups.set(observation.marketSlug, {
      slug: observation.marketSlug,
      name: observation.marketName,
      state: observation.state,
      district: observation.district,
      observations: [observation],
    });
  }

  return [...groups.values()];
}

/**
 * Picks the market the analysis is about.
 *
 * A market in the farmer's own district comes first, then the market with
 * the most observations, and then the market name. The last step keeps the
 * choice deterministic when two markets have the same number of records.
 */
export function pickAnalysisMarket(
  groups: MarketGroup[],
  district: string,
): MarketGroup | null {
  if (groups.length === 0) return null;

  const wanted = district.trim().toLowerCase();

  return [...groups].sort((left, right) => {
    const leftInDistrict = left.district.trim().toLowerCase() === wanted ? 0 : 1;
    const rightInDistrict = right.district.trim().toLowerCase() === wanted ? 0 : 1;
    if (leftInDistrict !== rightInDistrict) return leftInDistrict - rightInDistrict;

    if (left.observations.length !== right.observations.length) {
      return right.observations.length - left.observations.length;
    }

    return left.name.localeCompare(right.name);
  })[0];
}

/**
 * Chooses the crop the market analysis is about.
 *
 * The crop the farmer already grows or plans to grow wins, as long as the
 * rules still suit it. Otherwise the highest ranked suggestion is used.
 */
export function chooseAnalysisCrop(
  ranking: CropSuitabilityResult,
  currentCrop: string | null,
): CropSuggestionDto | null {
  if (ranking.suggestions.length === 0) return null;

  const wanted = (currentCrop ?? '').trim().toLowerCase();
  if (wanted !== '') {
    const match = ranking.suggestions.find(
      (suggestion) =>
        suggestion.crop.slug.toLowerCase() === wanted ||
        suggestion.crop.name.toLowerCase() === wanted,
    );
    if (match) return match;
  }

  return ranking.suggestions[0];
}

/** Turns provider observations into the shape the trend module reads. */
function toTrendObservations(observations: ProviderObservation[]): TrendObservation[] {
  return observations.map((observation) => ({
    cropSlug: observation.cropSlug,
    marketSlug: observation.marketSlug,
    observedAt: observation.observedAt,
    modalPrice: observation.modalPrice,
    unit: observation.unit,
    dataStatus: observation.dataStatus,
    source: observation.source,
  }));
}

/** The data status label used in the AI prompt. */
function dataStatusLabel(status: DataStatusValue): string {
  if (status === 'DEMO') return 'Demo data';
  if (status === 'LIVE') return 'Live data';
  if (status === 'RECENT') return 'Recently fetched data';
  return 'No data available';
}

/**
 * Builds the whole analysis for one profile.
 *
 * The profile is already validated and stored when this is called, so the
 * function only reads data and calculates results.
 */
export async function computeProfileAnalysis(input: {
  profile: AnalysisProfile;
  provider: MandiPriceProvider;
  rules?: SuitabilityRuleSource;
  ai?: AiNarrativeProvider;
  /**
   * Set when the market data could not be read at all.
   *
   * The crop rules do not come from the market provider, so the ranking is
   * still produced and only the market part is reported as missing. The
   * provider is not asked a second time, because it has already failed.
   */
  marketDataUnavailable?: string | null;
}): Promise<ProfileAnalysisResult> {
  const { profile, provider } = input;
  const ruleSource = input.rules ?? createDatabaseSuitabilityRuleSource();

  let rules: SuitabilityRule[];
  try {
    rules = await ruleSource.listRules();
  } catch {
    return {
      status: 'unavailable',
      message:
        'The crop suitability rules could not be read, so no suggestions could be ' +
        'produced. The profile itself was saved and can be analysed again later.',
      cropSuggestions: null,
      sellingInsights: null,
    };
  }

  const suitabilityProfile: SuitabilityProfile = {
    state: profile.state,
    district: profile.district,
    soilType: profile.soilType,
    season: profile.season,
    landArea: profile.landArea,
    landAreaUnit: profile.landAreaUnit,
    irrigationType: profile.irrigationType,
    currentCrop: profile.currentCrop,
  };

  const ranking = rankCropsForProfile(suitabilityProfile, rules);
  const crop = chooseAnalysisCrop(ranking, profile.currentCrop);

  if (crop === null) {
    return {
      status: 'computed',
      message:
        'None of the crops in the rule set matched this profile. The reasons are listed ' +
        'below, so you can see which detail ruled each crop out.',
      cropSuggestions: ranking,
      sellingInsights: null,
    };
  }

  if (input.marketDataUnavailable) {
    return {
      status: 'partial',
      message:
        'Your profile was matched against the crop rules, but the price records could ' +
        'not be read, so no market information is shown. The crop suggestions below are ' +
        'not affected.',
      cropSuggestions: ranking,
      sellingInsights: buildSellingInsights({
        subject: { crop: crop.crop, market: null },
        trend: null,
        forecast: null,
        dataStatus: 'UNAVAILABLE',
        isDemoData: false,
        unavailableReason: input.marketDataUnavailable,
      }),
    };
  }

  let observations: ProviderObservation[];
  try {
    const result = await provider.listObservations({
      crop: crop.crop.slug,
      state: profile.state,
      limit: ANALYSIS_OBSERVATION_LIMIT,
      offset: 0,
    });
    observations = result.items;
  } catch (error) {
    const reason = isProviderError(error)
      ? error.message
      : 'The price records for this location could not be read.';

    return {
      status: 'partial',
      message:
        'Your profile was matched against the crop rules, but the price records could ' +
        'not be read, so no market information is shown. The crop suggestions below are ' +
        'not affected.',
      cropSuggestions: ranking,
      sellingInsights: buildSellingInsights({
        subject: { crop: crop.crop, market: null },
        trend: null,
        forecast: null,
        dataStatus: 'UNAVAILABLE',
        isDemoData: false,
        unavailableReason: reason,
      }),
    };
  }

  const market = pickAnalysisMarket(groupByMarket(observations), profile.district);

  if (market === null || market.observations.length === 0) {
    return {
      status: 'partial',
      message:
        'Your profile was matched against the crop rules, but no price observations were ' +
        'found for ' +
        crop.crop.name +
        ' in ' +
        profile.state +
        '.',
      cropSuggestions: ranking,
      sellingInsights: buildSellingInsights({
        subject: { crop: crop.crop, market: null },
        trend: null,
        forecast: null,
        dataStatus: 'UNAVAILABLE',
        isDemoData: false,
        unavailableReason:
          'No price observations were found for ' +
          crop.crop.name +
          ' in ' +
          profile.state +
          ' in the data that is currently available.',
      }),
    };
  }

  const unit = market.observations[0].unit;
  const series = toTrendObservations(market.observations);
  const scope = { cropSlug: crop.crop.slug, marketSlug: market.slug, unit };

  const trend: TrendAnalysisDto = analyseTrend(series, scope, market.name);
  const forecast: ForecastDto = buildForecast(series, scope);

  // The label is taken from every observation of the market, so a series
  // that partly came from the provider cache is not called live.
  const dataStatus: DataStatusValue = dataStatusFor(market.observations);
  const isDemoData = dataStatus === 'DEMO';

  let narrative: string | null = null;
  if (input.ai?.configured && trend.direction !== 'insufficient_data') {
    narrative = await input.ai.generate({
      cropName: crop.crop.name,
      marketName: market.name,
      direction: trend.direction,
      horizonText: 'about a week',
      dataStatusLabel: dataStatusLabel(dataStatus),
    });
  }

  const insights = buildSellingInsights({
    subject: {
      crop: crop.crop,
      market: {
        slug: market.slug,
        name: market.name,
        state: market.state,
        district: market.district,
      },
    },
    trend,
    forecast,
    dataStatus,
    isDemoData,
    narrative,
  });

  const marketIsInDistrict =
    market.district.trim().toLowerCase() === profile.district.trim().toLowerCase();

  if (!marketIsInDistrict) {
    insights.caveats.push(
      'The market used here is ' +
        market.name +
        ' in ' +
        market.district +
        ', because no observations were available for ' +
        profile.district +
        '. Check the prices in your own market before acting on it.',
    );
  }

  return {
    status: 'computed',
    message:
      'Your profile was matched against the crop rules and the price observations for ' +
      'your area.',
    cropSuggestions: ranking,
    sellingInsights: insights,
  };
}
