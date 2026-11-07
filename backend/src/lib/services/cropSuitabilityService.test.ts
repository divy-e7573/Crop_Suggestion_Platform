/*
 * Tests for the crop suitability rule engine.
 *
 * The engine is pure, so these tests need no database and no provider. They
 * cover the matching rules, the land-area conversion, the way missing
 * information is treated, and the determinism of the ranking.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  rankCropsForProfile,
  type SuitabilityProfile,
  type SuitabilityRule,
} from './cropSuitabilityService.ts';

function rule(overrides: Partial<SuitabilityRule> = {}): SuitabilityRule {
  return {
    cropId: 'crop-wheat',
    cropSlug: 'wheat',
    cropName: 'Wheat',
    cropCategory: 'CEREAL',
    ruleVersion: 'demo-v1',
    soilTypes: ['ALLUVIAL', 'BLACK'],
    seasons: ['RABI'],
    irrigationTypes: ['CANAL', 'WELL', 'SPRINKLER'],
    applicableStates: [],
    minLandAreaAcre: 0.5,
    maxLandAreaAcre: null,
    explanation: 'Wheat is a rabi crop on alluvial and black soil.',
    dataStatus: 'DEMO',
    source: 'demo-seed',
    ...overrides,
  };
}

function profile(overrides: Partial<SuitabilityProfile> = {}): SuitabilityProfile {
  return {
    state: 'Maharashtra',
    district: 'Nashik',
    soilType: 'BLACK',
    season: 'RABI',
    landArea: 2,
    landAreaUnit: 'ACRE',
    irrigationType: 'WELL',
    currentCrop: null,
    ...overrides,
  };
}

test('a matching soil type keeps the crop and a different one removes it', () => {
  const rules = [rule()];

  const matched = rankCropsForProfile(profile({ soilType: 'BLACK' }), rules);
  assert.equal(matched.suggestions.length, 1);
  assert.equal(matched.suggestions[0].score, 100);
  assert.equal(matched.suggestions[0].confidence, 'high');

  const rejected = rankCropsForProfile(profile({ soilType: 'SANDY' }), rules);
  assert.equal(rejected.suggestions.length, 0);
  assert.equal(rejected.notRecommended.length, 1);
  assert.equal(rejected.notRecommended[0].crop.slug, 'wheat');
  assert.match(rejected.notRecommended[0].reason, /soil/i);
});

test('a rule without a soil restriction does not restrict the soil type', () => {
  const result = rankCropsForProfile(
    profile({ soilType: 'SANDY' }),
    [rule({ soilTypes: [] })],
  );

  assert.equal(result.suggestions.length, 1);
  assert.ok(
    result.suggestions[0].matchedCriteria.some((criterion) =>
      criterion.includes('does not restrict the soil type'),
    ),
  );
});

test('a different season removes the crop', () => {
  const result = rankCropsForProfile(profile({ season: 'KHARIF' }), [rule()]);

  assert.equal(result.suggestions.length, 0);
  assert.match(result.notRecommended[0].reason, /season/i);
});

test('a state the rule does not list removes the crop, and a listed one keeps it', () => {
  const rules = [rule({ applicableStates: ['Punjab'] })];

  const listed = rankCropsForProfile(profile({ state: 'Punjab' }), rules);
  assert.equal(listed.suggestions.length, 1);

  const notListed = rankCropsForProfile(profile({ state: 'Maharashtra' }), rules);
  assert.equal(notListed.suggestions.length, 0);
  assert.match(notListed.notRecommended[0].reason, /state/i);
});

test('the state comparison ignores case and surrounding spaces', () => {
  const result = rankCropsForProfile(
    profile({ state: ' punjab ' }),
    [rule({ applicableStates: ['Punjab'] })],
  );

  assert.equal(result.suggestions.length, 1);
});

test('an irrigation type the rule does not allow removes the crop', () => {
  const result = rankCropsForProfile(profile({ irrigationType: 'DRIP' }), [rule()]);

  assert.equal(result.suggestions.length, 0);
  assert.match(result.notRecommended[0].reason, /irrigation/i);
});

test('missing irrigation is not treated as a confirmed match', () => {
  const result = rankCropsForProfile(profile({ irrigationType: null }), [rule()]);

  assert.equal(result.suggestions.length, 1);
  assert.ok(result.suggestions[0].score < 100);
  assert.equal(result.suggestions[0].confidence, 'medium');
  assert.equal(result.suggestions[0].missingInformation.length, 1);
  assert.match(result.suggestions[0].missingInformation[0], /irrigate/i);
  assert.equal(result.missingInformation.length, 1);
});

test('a soil type recorded as other is unknown rather than a mismatch', () => {
  const result = rankCropsForProfile(profile({ soilType: 'OTHER' }), [rule()]);

  assert.equal(result.suggestions.length, 1);
  assert.ok(result.suggestions[0].score < 100);
  assert.match(result.suggestions[0].missingInformation.join(' '), /soil type/i);
});

test('the land area is converted to acres before it is compared', () => {
  const rules = [rule({ minLandAreaAcre: 2.4, maxLandAreaAcre: null })];

  const hectare = rankCropsForProfile(
    profile({ landArea: 1, landAreaUnit: 'HECTARE' }),
    rules,
  );

  assert.equal(hectare.landAreaInAcres, 2.47);
  assert.equal(hectare.suggestions.length, 1);

  const tooSmall = rankCropsForProfile(
    profile({ landArea: 1, landAreaUnit: 'HECTARE' }),
    [rule({ minLandAreaAcre: 2.5, maxLandAreaAcre: null })],
  );
  assert.equal(tooSmall.suggestions.length, 0);
});

test('the land area limits include both ends of the range', () => {
  const rules = [rule({ minLandAreaAcre: 1, maxLandAreaAcre: 5 })];

  assert.equal(rankCropsForProfile(profile({ landArea: 1 }), rules).suggestions.length, 1);
  assert.equal(rankCropsForProfile(profile({ landArea: 5 }), rules).suggestions.length, 1);
  assert.equal(rankCropsForProfile(profile({ landArea: 0.9 }), rules).suggestions.length, 0);
  assert.equal(rankCropsForProfile(profile({ landArea: 5.1 }), rules).suggestions.length, 0);
});

test('the ranking is deterministic and the ranks are numbered in order', () => {
  const rules = [
    rule({ cropId: 'crop-onion', cropSlug: 'onion', cropName: 'Onion' }),
    rule({ cropId: 'crop-rice', cropSlug: 'rice', cropName: 'Rice' }),
    rule({ cropId: 'crop-wheat', cropSlug: 'wheat', cropName: 'Wheat' }),
  ];

  const first = rankCropsForProfile(profile(), rules);
  const second = rankCropsForProfile(profile(), rules);

  assert.deepEqual(
    first.suggestions.map((suggestion) => suggestion.crop.slug),
    second.suggestions.map((suggestion) => suggestion.crop.slug),
  );
  assert.deepEqual(
    first.suggestions.map((suggestion) => suggestion.rank),
    [1, 2, 3],
  );
});

test('crops with the same score are ordered by confidence and then by name', () => {
  const rules = [
    rule({ cropId: 'crop-b', cropSlug: 'b', cropName: 'Bean' }),
    rule({
      cropId: 'crop-a',
      cropSlug: 'a',
      cropName: 'Apple',
      irrigationTypes: [],
    }),
  ];

  const result = rankCropsForProfile(profile(), rules);

  // Both match every factor, but one rule restricts the land size and the
  // other does not, so the scores are the same and the names decide.
  assert.equal(result.suggestions[0].crop.name, 'Apple');
  assert.equal(result.suggestions[1].crop.name, 'Bean');
});

test('a crop that matches more of its rule is ranked first', () => {
  const rules = [
    rule({
      cropId: 'crop-rice',
      cropSlug: 'rice',
      cropName: 'Rice',
      soilTypes: ['BLACK'],
      seasons: ['RABI'],
      irrigationTypes: ['WELL'],
    }),
    rule({
      cropId: 'crop-onion',
      cropSlug: 'onion',
      cropName: 'Onion',
      soilTypes: ['BLACK'],
      seasons: ['RABI'],
      irrigationTypes: [],
    }),
  ];

  const result = rankCropsForProfile(profile({ irrigationType: null }), rules);

  assert.equal(result.suggestions[0].crop.name, 'Onion');
  assert.equal(result.suggestions[0].score, 100);
  assert.equal(result.suggestions[1].crop.name, 'Rice');
  assert.equal(result.suggestions[1].score, 75);
});

test('the farmer crop is marked but does not change the rule based score', () => {
  const rules = [rule({ cropSlug: 'wheat', cropName: 'Wheat' })];

  const result = rankCropsForProfile(profile({ currentCrop: 'Wheat' }), rules);

  assert.equal(result.suggestions[0].isCurrentCrop, true);
  assert.equal(result.suggestions[0].score, 100);
  assert.match(result.suggestions[0].explanation, /already grow or plan to grow/);
});

test('the result names the rule version, the method, and the rule status', () => {
  const result = rankCropsForProfile(profile(), [rule()]);

  assert.equal(result.ruleVersion, 'demo-v1');
  assert.equal(result.ruleDataStatus, 'DEMO');
  assert.equal(result.ruleSource, 'demo-seed');
  assert.match(result.method, /ranked|ordered by score/i);
});

test('no promise of yield or profit is made anywhere in the text', () => {
  const result = rankCropsForProfile(profile(), [rule()]);
  const text = [
    result.suggestions[0].explanation,
    result.suggestions[0].guidance,
    ...result.suggestions[0].matchedCriteria,
    ...result.suggestions[0].missingInformation,
  ]
    .join(' ')
    .toLowerCase();

  for (const forbidden of ['guarantee', 'guaranteed', 'will profit', 'assured', 'risk-free']) {
    assert.ok(!text.includes(forbidden), 'unexpected promise: ' + forbidden);
  }
});
