/*
 * Integration tests for the profile analysis orchestrator.
 *
 * The orchestrator is tested with a fake rule set and a fake provider, so
 * the whole path from a saved profile to ranked suggestions and selling
 * insights is covered without a database or a network.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderUnavailableError } from '../providers/errors.ts';
import type {
  MandiPriceProvider,
  ProviderMarket,
  ProviderObservation,
  ProviderQuery,
  ProviderResult,
} from '../providers/types.ts';
import type { SuitabilityRule } from './cropSuitabilityService.ts';
import {
  chooseAnalysisCrop,
  computeProfileAnalysis,
  type AnalysisProfile,
} from './profileAnalysisService.ts';

const PROFILE: AnalysisProfile = {
  id: 'profile-1',
  state: 'Maharashtra',
  district: 'Nashik',
  soilType: 'BLACK',
  season: 'KHARIF',
  landArea: 2,
  landAreaUnit: 'ACRE',
  villageOrPin: null,
  irrigationType: 'DRIP',
  currentCrop: null,
  createdAt: '2026-01-05T00:00:00.000Z',
};

function rule(overrides: Partial<SuitabilityRule> = {}): SuitabilityRule {
  return {
    cropId: 'crop-soybean',
    cropSlug: 'soybean',
    cropName: 'Soybean',
    cropCategory: 'OILSEED',
    ruleVersion: 'demo-v1',
    soilTypes: ['BLACK'],
    seasons: ['KHARIF'],
    irrigationTypes: ['DRIP'],
    applicableStates: [],
    minLandAreaAcre: 1,
    maxLandAreaAcre: null,
    explanation: 'Soybean suits black soil in the kharif season.',
    dataStatus: 'DEMO',
    source: 'demo-seed',
    ...overrides,
  };
}

function observation(overrides: Partial<ProviderObservation> = {}): ProviderObservation {
  return {
    cropSlug: 'soybean',
    cropName: 'Soybean',
    cropVariety: null,
    cropGrade: null,
    marketSlug: 'nashik-apmc-maharashtra',
    marketName: 'Nashik APMC',
    state: 'Maharashtra',
    district: 'Nashik',
    locality: null,
    observedAt: new Date('2026-01-05T00:00:00.000Z'),
    minPrice: 1900,
    maxPrice: 2100,
    modalPrice: 2000,
    unit: 'RUPEES_PER_QUINTAL',
    currency: 'INR',
    source: 'demo-seed',
    dataStatus: 'DEMO',
    fetchedAt: null,
    ...overrides,
  };
}

/** A seven day demo series for one market. */
function demoSeries(
  marketSlug = 'nashik-apmc-maharashtra',
  district = 'Nashik',
): ProviderObservation[] {
  return Array.from({ length: 7 }, (_, index) =>
    observation({
      marketSlug,
      marketName: marketSlug === 'nashik-apmc-maharashtra' ? 'Nashik APMC' : 'Kolhapur APMC',
      district,
      observedAt: new Date(Date.UTC(2026, 0, 5 + index, 0, 0, 0, 0)),
      modalPrice: 2000 + index * 20,
    }),
  );
}

type FakeProviderOptions = {
  observations?: ProviderObservation[];
  fails?: boolean;
  dataStatus?: ProviderObservation['dataStatus'];
};

function fakeProvider(options: FakeProviderOptions = {}): MandiPriceProvider {
  const observations = options.observations ?? demoSeries();

  return {
    id: 'demo-seed',
    displayName: 'Seeded demonstration data',
    mode: 'demo',
    dataStatus: options.dataStatus ?? 'DEMO',
    isDemo: true,
    verifiedLive: false,
    configured: true,
    configurationIssue: null,
    sourceUrl: null,
    attribution: 'Demonstration records.',

    async listObservations(
      _query: ProviderQuery,
    ): Promise<ProviderResult<ProviderObservation>> {
      if (options.fails) {
        throw new ProviderUnavailableError('The mandi data provider is currently unavailable.');
      }
      return { items: observations, total: observations.length, truncated: false };
    },

    async listMarkets(_query: ProviderQuery): Promise<ProviderResult<ProviderMarket>> {
      return { items: [], total: 0, truncated: false };
    },
  };
}

test('a valid profile produces ranked suggestions and selling insights', async () => {
  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: fakeProvider(),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.equal(result.status, 'computed');
  assert.ok(result.cropSuggestions);
  assert.equal(result.cropSuggestions!.suggestions.length, 1);
  assert.equal(result.cropSuggestions!.suggestions[0].crop.name, 'Soybean');
  assert.ok(result.sellingInsights);
  assert.equal(result.sellingInsights!.observedTrend?.direction, 'rising');
  assert.equal(result.sellingInsights!.forecast?.status, 'ok');
});

test('the demo status is carried into the trend and the forecast', async () => {
  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: fakeProvider(),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.equal(result.sellingInsights!.observedTrend?.dataStatus, 'DEMO');
  assert.equal(result.sellingInsights!.observedTrend?.isDemoData, true);
  assert.equal(result.sellingInsights!.forecast?.isDemoData, true);
});

test('a provider failure leaves the crop suggestions in place and explains the gap', async () => {
  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: fakeProvider({ fails: true }),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.equal(result.status, 'partial');
  assert.equal(result.cropSuggestions!.suggestions.length, 1);
  assert.equal(result.sellingInsights!.status, 'insufficient_data');
  assert.ok(
    result.sellingInsights!.points.some((point) => point.includes('currently unavailable')),
  );
});

test('a provider failure that is already known is not asked again', async () => {
  let calls = 0;
  const provider = fakeProvider();
  const counting: MandiPriceProvider = {
    ...provider,
    async listObservations(query: ProviderQuery) {
      calls += 1;
      return provider.listObservations(query);
    },
  };

  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: counting,
    rules: {
      async listRules() {
        return [rule()];
      },
    },
    marketDataUnavailable: 'The data source could not be read.',
  });

  assert.equal(calls, 0);
  assert.equal(result.status, 'partial');
  assert.equal(result.cropSuggestions!.suggestions.length, 1);
});

test('rules that cannot be read leave the whole analysis unavailable', async () => {
  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: fakeProvider(),
    rules: {
      async listRules() {
        throw new Error('the database is not reachable');
      },
    },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.cropSuggestions, null);
  assert.equal(result.sellingInsights, null);
});

test('a profile that no rule suits reports the reasons instead of an empty list', async () => {
  const result = await computeProfileAnalysis({
    profile: { ...PROFILE, soilType: 'SANDY' },
    provider: fakeProvider(),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.equal(result.status, 'computed');
  assert.equal(result.cropSuggestions!.suggestions.length, 0);
  assert.equal(result.cropSuggestions!.notRecommended.length, 1);
  assert.match(result.message, /none of the crops/i);
});

test('no observations for the crop leaves the suggestions in place', async () => {
  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: fakeProvider({ observations: [] }),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.equal(result.status, 'partial');
  assert.equal(result.cropSuggestions!.suggestions.length, 1);
  assert.equal(result.sellingInsights!.status, 'insufficient_data');
  assert.match(result.message, /no price observations/i);
});

test('the market in the farmer own district is preferred', async () => {
  const observations = [
    ...demoSeries('nashik-apmc-maharashtra', 'Nashik'),
    ...demoSeries('kolhapur-apmc-maharashtra', 'Kolhapur'),
  ];

  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: fakeProvider({ observations }),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.ok(result.sellingInsights!.observedTrend?.summary.includes('Nashik APMC'));
});

test('a market outside the district is used but is explained', async () => {
  const result = await computeProfileAnalysis({
    profile: PROFILE,
    provider: fakeProvider({
      observations: demoSeries('kolhapur-apmc-maharashtra', 'Kolhapur'),
    }),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.equal(result.status, 'computed');
  assert.ok(result.sellingInsights!.caveats.some((caveat) => caveat.includes('Kolhapur')));
});

test('the crop the farmer named is marked on the suggestion', async () => {
  const result = await computeProfileAnalysis({
    profile: { ...PROFILE, currentCrop: 'Soybean' },
    provider: fakeProvider(),
    rules: {
      async listRules() {
        return [rule()];
      },
    },
  });

  assert.ok(result.sellingInsights!.observedTrend);
  assert.equal(result.cropSuggestions!.suggestions[0].isCurrentCrop, true);
});

test('a crop that is not in the rule set is not chosen for the analysis', () => {
  const ranking = {
    suggestions: [
      {
        rank: 1,
        crop: { slug: 'soybean', name: 'Soybean', category: 'OILSEED' },
        score: 100,
        confidence: 'high' as const,
        matchedCriteria: [],
        missingInformation: [],
        explanation: '',
        guidance: '',
        rule: { version: 'demo-v1', source: 'demo-seed', dataStatus: 'DEMO' },
        isCurrentCrop: false,
      },
    ],
    notRecommended: [],
    ruleVersion: 'demo-v1',
    method: '',
    missingInformation: [],
    landAreaInAcres: 2,
    ruleDataStatus: 'DEMO',
    ruleSource: 'demo-seed',
  };

  const chosen = chooseAnalysisCrop(ranking, 'Wheat');
  assert.equal(chosen?.crop.slug, 'soybean');
});
