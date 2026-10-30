/**
 * Farmer profile rules shared by the form and by the server-side checks.
 *
 * This module is deliberately free of React and of any import, so it can be
 * loaded by the plain Node test runner in the backend workspace. That lets the
 * backend test prove that the option lists and the numeric limits used by the
 * form are the same ones the API accepts, instead of the two drifting apart.
 *
 * The API is still the authority: every value is validated again on the
 * server before anything is stored (AGENTS.md section 5).
 */

export type FarmProfileField =
  | 'state'
  | 'district'
  | 'soilType'
  | 'season'
  | 'landArea'
  | 'landAreaUnit'
  | 'villageOrPin'
  | 'irrigationType'
  | 'currentCrop';

/** Every field the form can report an error for. */
export const FARM_PROFILE_FIELDS: readonly FarmProfileField[] = [
  'state',
  'district',
  'soilType',
  'season',
  'landArea',
  'landAreaUnit',
  'villageOrPin',
  'irrigationType',
  'currentCrop',
];

export type Option = { value: string; label: string };

/** Soil types, matching PRD FR-02 (a configurable list plus `Other`). */
export const SOIL_TYPE_OPTIONS: readonly Option[] = [
  { value: 'ALLUVIAL', label: 'Alluvial' },
  { value: 'BLACK', label: 'Black (regur)' },
  { value: 'RED', label: 'Red' },
  { value: 'LATERITE', label: 'Laterite' },
  { value: 'SANDY', label: 'Sandy' },
  { value: 'OTHER', label: 'Other' },
];

/** Seasons, matching PRD FR-02 (at least Kharif, Rabi, Zaid, and `Other`). */
export const SEASON_OPTIONS: readonly Option[] = [
  { value: 'KHARIF', label: 'Kharif (monsoon)' },
  { value: 'RABI', label: 'Rabi (winter)' },
  { value: 'ZAID', label: 'Zaid (summer)' },
  { value: 'WHOLE_YEAR', label: 'Whole year' },
  { value: 'OTHER', label: 'Other' },
];

/** Irrigation availability or type, an optional PRD FR-02 field. */
export const IRRIGATION_TYPE_OPTIONS: readonly Option[] = [
  { value: 'RAINFED', label: 'Rainfed only' },
  { value: 'DRIP', label: 'Drip irrigation' },
  { value: 'SPRINKLER', label: 'Sprinkler irrigation' },
  { value: 'FLOOD', label: 'Flood irrigation' },
  { value: 'CANAL', label: 'Canal irrigation' },
  { value: 'WELL', label: 'Well or borewell' },
  { value: 'OTHER', label: 'Other' },
];

/** The land-area units supported by PRD FR-02. */
export const LAND_AREA_UNIT_OPTIONS: readonly Option[] = [
  { value: 'ACRE', label: 'Acre' },
  { value: 'HECTARE', label: 'Hectare' },
];

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

/** The values the form starts with. */
export type FarmProfileValues = {
  state: string;
  district: string;
  soilType: string;
  season: string;
  landArea: string;
  landAreaUnit: string;
  villageOrPin: string;
  irrigationType: string;
  currentCrop: string;
};

/** The empty form. Every field starts blank so nothing is assumed. */
export const EMPTY_FARM_PROFILE: FarmProfileValues = {
  state: '',
  district: '',
  soilType: '',
  season: '',
  landArea: '',
  landAreaUnit: 'ACRE',
  villageOrPin: '',
  irrigationType: '',
  currentCrop: '',
};

/** The request body the API expects. */
export type FarmProfileRequest = {
  state: string;
  district: string;
  soilType: string;
  season: string;
  landArea: number;
  landAreaUnit: string;
  villageOrPin?: string;
  irrigationType?: string;
  currentCrop?: string;
};

function isOneOf(value: string, options: readonly Option[]): boolean {
  return options.some((option) => option.value === value);
}

/** True when the text is only digits, so it should be read as a PIN code. */
export function looksLikePinCode(value: string): boolean {
  return value.length > 0 && /^[0-9]+$/.test(value);
}

/**
 * Validates the form values.
 *
 * Returns a map of field name to message. An empty map means the values are
 * acceptable, which is exactly the same rule the API applies afterwards.
 */
export function validateFarmProfile(
  values: FarmProfileValues,
): Partial<Record<FarmProfileField, string>> {
  const errors: Partial<Record<FarmProfileField, string>> = {};

  const state = values.state.trim();
  if (state === '') {
    errors.state = 'Enter the state where your farm is.';
  } else if (state.length > MAX_LOCATION_LENGTH) {
    errors.state = 'Use at most ' + MAX_LOCATION_LENGTH + ' characters for the state.';
  }

  const district = values.district.trim();
  if (district === '') {
    errors.district = 'Enter the district where your farm is.';
  } else if (district.length > MAX_LOCATION_LENGTH) {
    errors.district = 'Use at most ' + MAX_LOCATION_LENGTH + ' characters for the district.';
  }

  if (values.soilType === '') {
    errors.soilType = 'Choose the soil type on your farm.';
  } else if (!isOneOf(values.soilType, SOIL_TYPE_OPTIONS)) {
    errors.soilType = 'Choose a soil type from the list.';
  }

  if (values.season === '') {
    errors.season = 'Choose the season you plan to farm in.';
  } else if (!isOneOf(values.season, SEASON_OPTIONS)) {
    errors.season = 'Choose a season from the list.';
  }

  if (!isOneOf(values.landAreaUnit, LAND_AREA_UNIT_OPTIONS)) {
    errors.landAreaUnit = 'Choose the unit your land area is measured in.';
  }

  const rawArea = values.landArea.trim();
  if (rawArea === '') {
    errors.landArea = 'Enter the size of your land.';
  } else {
    const area = Number(rawArea);
    if (!Number.isFinite(area)) {
      errors.landArea = 'Enter the land area as a number, for example 2.5.';
    } else if (area <= 0) {
      errors.landArea = 'Enter a land area greater than zero.';
    } else {
      const acres = values.landAreaUnit === 'HECTARE' ? area * ACRES_PER_HECTARE : area;
      if (acres > MAX_LAND_AREA_ACRES) {
        errors.landArea = 'That looks too large. Check the number, or use a smaller unit.';
      }
    }
  }

  const village = values.villageOrPin.trim();
  if (village !== '') {
    if (village.length > MAX_VILLAGE_LENGTH) {
      errors.villageOrPin =
        'Use at most ' + MAX_VILLAGE_LENGTH + ' characters for the village or PIN code.';
    } else if (looksLikePinCode(village) && village.length !== PIN_CODE_LENGTH) {
      errors.villageOrPin =
        'A PIN code has exactly ' +
        PIN_CODE_LENGTH +
        ' digits. Leave this empty if you are not entering a PIN code.';
    }
  }

  if (values.irrigationType !== '' && !isOneOf(values.irrigationType, IRRIGATION_TYPE_OPTIONS)) {
    errors.irrigationType = 'Choose an irrigation option from the list.';
  }

  const crop = values.currentCrop.trim();
  if (crop.length > MAX_CROP_LENGTH) {
    errors.currentCrop = 'Use at most ' + MAX_CROP_LENGTH + ' characters for the crop name.';
  }

  return errors;
}

/**
 * Turns the form values into the request body the API expects.
 *
 * Only called after validation has passed, so the empty optional fields are
 * left out rather than sent as empty strings.
 */
export function toFarmProfileRequest(values: FarmProfileValues): FarmProfileRequest {
  const village = values.villageOrPin.trim();
  const irrigation = values.irrigationType;
  const crop = values.currentCrop.trim();

  return {
    state: values.state.trim(),
    district: values.district.trim(),
    soilType: values.soilType,
    season: values.season,
    landArea: Number(values.landArea.trim()),
    landAreaUnit: values.landAreaUnit,
    ...(village === '' ? {} : { villageOrPin: village }),
    ...(irrigation === '' ? {} : { irrigationType: irrigation }),
    ...(crop === '' ? {} : { currentCrop: crop }),
  };
}

/**
 * Indian states and union territories, offered as suggestions only.
 *
 * Manual typing always works, so this list is a convenience rather than a
 * constraint, and the server does not reject a state that is not listed.
 */
export const STATE_SUGGESTIONS: readonly string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];
