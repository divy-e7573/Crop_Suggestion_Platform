import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CROPS,
  DEMO_SOURCE,
  MARKETS,
  OBSERVED_DATES,
  SUITABILITY_RULES,
  buildObservations,
} from './seed-data.ts';

test('crops and markets use unique slugs', () => {
  const cropSlugs = CROPS.map((c) => c.slug);
  const marketSlugs = MARKETS.map((m) => m.slug);
  assert.equal(new Set(cropSlugs).size, cropSlugs.length);
  assert.equal(new Set(marketSlugs).size, marketSlugs.length);
});

test('markets carry no invented coordinates', () => {
  // Distance may only be shown for verified coordinates (PRD FR-05), so the
  // demo seeds must not supply any.
  for (const market of MARKETS) {
    assert.equal((market as { latitude?: unknown }).latitude, undefined);
    assert.equal((market as { longitude?: unknown }).longitude, undefined);
  }
});

test('every observation is labelled demo data', () => {
  for (const row of buildObservations()) {
    assert.equal(row.dataStatus, 'DEMO');
    assert.equal(row.source, DEMO_SOURCE);
    assert.equal(row.unit, 'RUPEES_PER_QUINTAL');
    assert.equal(row.fetchedAt, null, 'demo rows were never fetched from a provider');
  }
});

test('price ranges are internally consistent and positive', () => {
  for (const row of buildObservations()) {
    assert.ok(row.minPrice > 0);
    assert.ok(row.minPrice <= row.modalPrice, `min <= modal for ${row.cropSlug}`);
    assert.ok(row.modalPrice <= row.maxPrice, `modal <= max for ${row.cropSlug}`);
  }
});

test('buildObservations is deterministic across calls', () => {
  assert.deepEqual(buildObservations(), buildObservations());
});

test('observation count is crops x markets x dates', () => {
  assert.equal(buildObservations().length, CROPS.length * MARKETS.length * OBSERVED_DATES.length);
});

test('every observation references a known crop and market', () => {
  const cropSlugs = new Set(CROPS.map((c) => c.slug));
  const marketSlugs = new Set(MARKETS.map((m) => m.slug));
  for (const row of buildObservations()) {
    assert.ok(cropSlugs.has(row.cropSlug), 'unknown crop ' + row.cropSlug);
    assert.ok(marketSlugs.has(row.marketSlug), 'unknown market ' + row.marketSlug);
    assert.ok(OBSERVED_DATES.includes(row.observedAt as (typeof OBSERVED_DATES)[number]));
  }
});

test('every suitability rule references a known crop and is unique per version', () => {
  const cropSlugs = new Set(CROPS.map((c) => c.slug));
  const seen = new Set<string>();

  for (const rule of SUITABILITY_RULES) {
    assert.ok(cropSlugs.has(rule.cropSlug), 'rule references unknown crop ' + rule.cropSlug);
    const key = rule.cropSlug + ':' + rule.ruleVersion;
    assert.ok(!seen.has(key), 'duplicate rule key ' + key);
    seen.add(key);
    assert.equal(rule.dataStatus, 'DEMO');
    assert.equal(rule.source, DEMO_SOURCE);
    assert.ok(rule.explanation.length > 0);
  }
});

test('suitability rules never promise a yield or profit', () => {
  const forbidden = /guarantee|guaranteed|will profit|assured profit|always grows/i;
  for (const rule of SUITABILITY_RULES) {
    assert.ok(
      !forbidden.test(rule.explanation),
      'rule explanation must not promise an outcome: ' + rule.explanation,
    );
  }
});

test('land area bounds are ordered when both are present', () => {
  for (const rule of SUITABILITY_RULES) {
    const { minLandAreaAcre: min, maxLandAreaAcre: max } = rule;
    if (min !== null && max !== null) {
      assert.ok(min <= max, 'min must not exceed max for ' + rule.cropSlug);
    }
  }
});
