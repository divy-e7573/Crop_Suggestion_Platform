import assert from 'node:assert/strict';
import test from 'node:test';

import * as formRules from '../../../../frontend/src/lib/farmProfileValidation.ts';
import { ValidationError } from '../api/errors.ts';
import { parseValue } from '../api/validation.ts';
import { ProviderUnavailableError } from '../providers/errors.ts';
import type { MandiPriceProvider, ProviderObservation } from '../providers/types.ts';
import {
  ACRES_PER_HECTARE,
  IRRIGATION_TYPE_VALUES,
  LAND_AREA_UNIT_VALUES,
  MAX_CROP_LENGTH,
  MAX_LAND_AREA_ACRES,
  MAX_LOCATION_LENGTH,
  MAX_VILLAGE_LENGTH,
  PIN_CODE_LENGTH,
  SEASON_VALUES,
  SOIL_TYPE_VALUES,
  farmProfileSchema,
  isRecoverableProviderFailure,
  summariseMatchingData,
  toAcres,
  unavailableMatchingData,
} from './farmProfileService.ts';

const validPayload = {
  state: 'Maharashtra',
  district: 'Nashik',
  soilType: 'BLACK',
  season: 'KHARIF',
  landArea: 2.5,
  landAreaUnit: 'ACRE',
};

function expectValidationError(payload: unknown): ValidationError {
  try {
    parseValue(farmProfileSchema, payload, 'body');
  } catch (error) {
    assert.ok(error instanceof ValidationError, 'expected a ValidationError');
    return error;
  }
  throw new Error('expected the call to throw');
}

function errorFields(error: ValidationError): string[] {
  return (error.details ?? []).map((detail) => detail.field);
}

test('a complete profile is accepted and trimmed', () => {
  const parsed = parseValue(
    farmProfileSchema,
    { ...validPayload, state: '  Maharashtra  ', district: ' Nashik ' },
    'body',
  );

  assert.equal(parsed.state, 'Maharashtra');
  assert.equal(parsed.district, 'Nashik');
  assert.equal(parsed.soilType, 'BLACK');
  assert.equal(parsed.season, 'KHARIF');
  assert.equal(parsed.landArea, 2.5);
  assert.equal(parsed.landAreaUnit, 'ACRE');
});

test('the optional fields are optional and a blank one is treated as absent', () => {
  const withoutOptional = parseValue(farmProfileSchema, validPayload, 'body');
  assert.equal(withoutOptional.villageOrPin, undefined);
  assert.equal(withoutOptional.irrigationType, undefined);
  assert.equal(withoutOptional.currentCrop, undefined);

  const withBlankOptional = parseValue(
    farmProfileSchema,
    { ...validPayload, villageOrPin: '', currentCrop: '' },
    'body',
  );
  assert.equal(withBlankOptional.villageOrPin, undefined);
  assert.equal(withBlankOptional.currentCrop, undefined);

  const withOptional = parseValue(
    farmProfileSchema,
    {
      ...validPayload,
      villageOrPin: 'Pimpalgaon',
      irrigationType: 'DRIP',
      currentCrop: 'Soybean',
    },
    'body',
  );
  assert.equal(withOptional.villageOrPin, 'Pimpalgaon');
  assert.equal(withOptional.irrigationType, 'DRIP');
  assert.equal(withOptional.currentCrop, 'Soybean');
});

test('the required fields are rejected when they are missing', () => {
  const stateError = expectValidationError({ ...validPayload, state: '' });
  assert.deepEqual(errorFields(stateError), ['state']);

  const districtError = expectValidationError({ ...validPayload, district: '   ' });
  assert.deepEqual(errorFields(districtError), ['district']);

  const soilError = expectValidationError({ ...validPayload, soilType: '' });
  assert.deepEqual(errorFields(soilError), ['soilType']);

  const seasonError = expectValidationError({ ...validPayload, season: undefined });
  assert.deepEqual(errorFields(seasonError), ['season']);
});

test('unknown enum values are rejected on the field that caused them', () => {
  assert.deepEqual(errorFields(expectValidationError({ ...validPayload, soilType: 'PEAT' })), [
    'soilType',
  ]);
  assert.deepEqual(errorFields(expectValidationError({ ...validPayload, season: 'SUMMER' })), [
    'season',
  ]);
  assert.deepEqual(
    errorFields(expectValidationError({ ...validPayload, irrigationType: 'WELL_IRRIGATION' })),
    ['irrigationType'],
  );
  assert.deepEqual(
    errorFields(expectValidationError({ ...validPayload, landAreaUnit: 'BIGH' })),
    ['landAreaUnit'],
  );
});

test('the land area must be a positive number within a sensible range', () => {
  assert.deepEqual(errorFields(expectValidationError({ ...validPayload, landArea: '' })), [
    'landArea',
  ]);
  assert.deepEqual(errorFields(expectValidationError({ ...validPayload, landArea: 0 })), [
    'landArea',
  ]);
  assert.deepEqual(errorFields(expectValidationError({ ...validPayload, landArea: -3 })), [
    'landArea',
  ]);
  assert.deepEqual(errorFields(expectValidationError({ ...validPayload, landArea: 'two' })), [
    'landArea',
  ]);

  const tooLarge = expectValidationError({ ...validPayload, landArea: 5000 });
  assert.deepEqual(errorFields(tooLarge), ['landArea']);

  // 500 hectares is about 1235 acres, so it is over the limit as well.
  const tooLargeHectares = expectValidationError({
    ...validPayload,
    landArea: 500,
    landAreaUnit: 'HECTARE',
  });
  assert.deepEqual(errorFields(tooLargeHectares), ['landArea']);
});

test('a numeric string for the land area is accepted', () => {
  const parsed = parseValue(farmProfileSchema, { ...validPayload, landArea: '3.75' }, 'body');
  assert.equal(parsed.landArea, 3.75);
});

test('a PIN code must have exactly six digits, but a village name is free text', () => {
  assert.deepEqual(
    errorFields(expectValidationError({ ...validPayload, villageOrPin: '42230' })),
    ['villageOrPin'],
  );
  assert.deepEqual(
    errorFields(expectValidationError({ ...validPayload, villageOrPin: '4223012' })),
    ['villageOrPin'],
  );

  const parsed = parseValue(
    farmProfileSchema,
    { ...validPayload, villageOrPin: '422301' },
    'body',
  );
  assert.equal(parsed.villageOrPin, '422301');

  const village = parseValue(
    farmProfileSchema,
    { ...validPayload, villageOrPin: 'Pimpalgaon' },
    'body',
  );
  assert.equal(village.villageOrPin, 'Pimpalgaon');
});

test('over-long text is rejected on its own field', () => {
  assert.deepEqual(
    errorFields(expectValidationError({ ...validPayload, state: 'x'.repeat(MAX_LOCATION_LENGTH + 1) })),
    ['state'],
  );
  assert.deepEqual(
    errorFields(
      expectValidationError({ ...validPayload, villageOrPin: 'x'.repeat(MAX_VILLAGE_LENGTH + 1) }),
    ),
    ['villageOrPin'],
  );
  assert.deepEqual(
    errorFields(
      expectValidationError({ ...validPayload, currentCrop: 'x'.repeat(MAX_CROP_LENGTH + 1) }),
    ),
    ['currentCrop'],
  );
});

test('toAcres converts hectares and keeps acres as they are', () => {
  assert.equal(toAcres(2.5, 'ACRE'), 2.5);
  assert.equal(toAcres(1, 'HECTARE'), Math.round(ACRES_PER_HECTARE * 100) / 100);
});

test('the form and the API agree on every option list', () => {
  const values = (options: readonly { value: string }[]) => options.map((option) => option.value);

  assert.deepEqual(values(formRules.SOIL_TYPE_OPTIONS), [...SOIL_TYPE_VALUES]);
  assert.deepEqual(values(formRules.SEASON_OPTIONS), [...SEASON_VALUES]);
  assert.deepEqual(values(formRules.IRRIGATION_TYPE_OPTIONS), [...IRRIGATION_TYPE_VALUES]);
  assert.deepEqual(values(formRules.LAND_AREA_UNIT_OPTIONS), [...LAND_AREA_UNIT_VALUES]);
});

test('the form and the API agree on the numeric limits', () => {
  assert.equal(formRules.MAX_LAND_AREA_ACRES, MAX_LAND_AREA_ACRES);
  assert.equal(formRules.MAX_LOCATION_LENGTH, MAX_LOCATION_LENGTH);
  assert.equal(formRules.MAX_VILLAGE_LENGTH, MAX_VILLAGE_LENGTH);
  assert.equal(formRules.MAX_CROP_LENGTH, MAX_CROP_LENGTH);
  assert.equal(formRules.PIN_CODE_LENGTH, PIN_CODE_LENGTH);
  assert.equal(formRules.ACRES_PER_HECTARE, ACRES_PER_HECTARE);
});

test('every field the API can report an error for exists in the form', () => {
  const reported = new Set([
    'state',
    'district',
    'soilType',
    'season',
    'landArea',
    'landAreaUnit',
    'villageOrPin',
    'irrigationType',
    'currentCrop',
  ]);
  for (const field of reported) {
    assert.ok(
      formRules.FARM_PROFILE_FIELDS.includes(field as never),
      'the form does not know the field ' + field,
    );
  }
  assert.equal(formRules.FARM_PROFILE_FIELDS.length, reported.size);
});

function fakeProvider(overrides: Partial<MandiPriceProvider> = {}): MandiPriceProvider {
  const observation: ProviderObservation = {
    cropSlug: 'wheat',
    cropName: 'Wheat',
    cropVariety: null,
    cropGrade: null,
    marketSlug: 'nashik-apmc-maharashtra',
    marketName: 'Nashik APMC',
    state: 'Maharashtra',
    district: 'Nashik',
    locality: null,
    observedAt: new Date('2026-01-05T00:00:00.000Z'),
    minPrice: 2000,
    maxPrice: 2400,
    modalPrice: 2200,
    unit: 'RUPEES_PER_QUINTAL',
    currency: 'INR',
    source: 'demo-seed',
    dataStatus: 'DEMO',
    fetchedAt: null,
  };

  return {
    id: 'demo-seed',
    displayName: 'Seeded demonstration data',
    mode: 'demo',
    dataStatus: 'DEMO',
    isDemo: true,
    verifiedLive: false,
    configured: true,
    configurationIssue: null,
    sourceUrl: null,
    attribution: 'Demonstration records.',
    async listObservations() {
      return { items: [observation], total: 42, truncated: false };
    },
    async listMarkets() {
      return { items: [], total: 3, truncated: false };
    },
    ...overrides,
  };
}

test('the matching summary reports the counts and the data status', async () => {
  const summary = await summariseMatchingData(
    fakeProvider(),
    parseValue(farmProfileSchema, validPayload, 'body'),
  );

  assert.equal(summary.priceObservations, 42);
  assert.equal(summary.markets, 1);
  assert.equal(summary.dataStatus, 'DEMO');
  assert.equal(summary.source, 'demo-seed');
  assert.equal(summary.isComplete, true);
  assert.ok(summary.notice.toLowerCase().includes('demonstration'));
});

test('a provider failure is recoverable and is reported as unavailable', () => {
  const provider = fakeProvider();
  const error = new ProviderUnavailableError('The provider could not be reached.');

  assert.equal(isRecoverableProviderFailure(error), true);
  assert.equal(isRecoverableProviderFailure(new Error('database is down')), false);

  const summary = unavailableMatchingData(provider, error.message);
  assert.equal(summary.dataStatus, 'UNAVAILABLE');
  assert.equal(summary.priceObservations, 0);
  assert.equal(summary.isComplete, false);
});

test('a provider that cannot run is never described as live', () => {
  const provider = fakeProvider({ mode: 'live', isDemo: false, configured: false });
  const summary = unavailableMatchingData(provider, 'No API key is set.');
  assert.equal(summary.dataStatus, 'UNAVAILABLE');
  assert.equal(summary.source, 'demo-seed');
});
