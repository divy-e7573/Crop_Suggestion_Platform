/**
 * The crop suitability rule engine (PRD FR-06).
 *
 * The rules live in the CropSuitabilityRule table, but the decision logic
 * lives here, in one pure module with no database, no network, and no React.
 * That keeps the ranking testable on its own and keeps it out of the route
 * handlers and the UI (AGENTS.md section 2 and section 4).
 *
 * How a crop is judged:
 *
 * 1. The land area is converted to acres, because the rule limits are stored
 *    in acres while the farmer may enter hectares (PRD FR-02).
 * 2. Every factor the profile can contradict is checked: soil type, season,
 *    state, land area, and irrigation.
 * 3. A factor that contradicts the rule removes the crop from the shortlist,
 *    and the reason is reported so the exclusion is never silent.
 * 4. A factor that cannot be checked because an optional detail was left
 *    blank keeps the crop in the shortlist, but it lowers the score and the
 *    confidence and is listed as missing information. Missing information is
 *    never counted as a confirmed match.
 * 5. The score is the share of the rule's restricted factors that the
 *    profile confirmed. Factors the rule does not restrict are reported but
 *    do not raise the score.
 * 6. The order is score, then confidence, then the crop name, so the same
 *    profile always produces the same list.
 *
 * The rules are guidance, not a verdict. Nothing here promises a yield, a
 * price, or a profit (PRD section 4, AGENTS.md section 3).
 */

import { toAcres } from './landArea.ts';

/** Plain-language names, so a farmer reads a sentence and not an enum. */
const SOIL_LABELS: Record<string, string> = {
  ALLUVIAL: 'alluvial',
  BLACK: 'black',
  RED: 'red',
  LATERITE: 'laterite',
  SANDY: 'sandy',
  OTHER: 'other',
};

const SEASON_LABELS: Record<string, string> = {
  KHARIF: 'kharif',
  RABI: 'rabi',
  ZAID: 'zaid',
  WHOLE_YEAR: 'whole year',
  OTHER: 'other',
};

const IRRIGATION_LABELS: Record<string, string> = {
  RAINFED: 'rainfed',
  DRIP: 'drip',
  SPRINKLER: 'sprinkler',
  FLOOD: 'flood',
  CANAL: 'canal',
  WELL: 'well',
  OTHER: 'other',
};

/** The factors a rule can constrain. */
export type SuitabilityFactor = 'soil' | 'season' | 'state' | 'landArea' | 'irrigation';

/** How one factor was resolved against one rule. */
export type FactorStatus = 'matched' | 'not_restricted' | 'unknown' | 'contradicted';

/** One factor of one rule, with the sentence shown to the farmer. */
export type FactorOutcome = {
  factor: SuitabilityFactor;
  status: FactorStatus;
  /** Plain-language sentence describing the outcome. */
  detail: string;
};

/** One rule row, as the repository hands it over. */
export type SuitabilityRule = {
  cropId: string;
  cropSlug: string;
  cropName: string;
  cropCategory: string;
  ruleVersion: string;
  soilTypes: string[];
  seasons: string[];
  irrigationTypes: string[];
  applicableStates: string[];
  minLandAreaAcre: number | null;
  maxLandAreaAcre: number | null;
  explanation: string;
  dataStatus: string;
  source: string;
};

/** The farmer's profile, in the shape the engine needs. */
export type SuitabilityProfile = {
  state: string;
  district: string;
  soilType: string;
  season: string;
  landArea: number;
  landAreaUnit: string;
  /** Optional in the product, so it may be missing. */
  irrigationType?: string | null;
  /** Optional in the product, so it may be missing. */
  currentCrop?: string | null;
};

/** How much the rule set could be checked, as a short label. */
export type SuitabilityConfidence = 'high' | 'medium' | 'low';

/** One ranked suggestion. */
export type CropSuggestionDto = {
  rank: number;
  crop: { slug: string; name: string; category: string };
  /** Share of the rule's restricted factors the profile confirmed, 0 to 100. */
  score: number;
  confidence: SuitabilityConfidence;
  /** The inputs that matched, one sentence each. */
  matchedCriteria: string[];
  /** The details that were missing and therefore could not be checked. */
  missingInformation: string[];
  /** Why this crop was suggested, in plain language. */
  explanation: string;
  /** The stored rule guidance, which is local advice rather than a result. */
  guidance: string;
  rule: { version: string; source: string; dataStatus: string };
  /** True when the farmer said this is the crop they already grow or plan. */
  isCurrentCrop: boolean;
};

/** A crop that was left out, with the reason it was left out. */
export type NotRecommendedCropDto = {
  crop: { slug: string; name: string };
  reason: string;
  /** The factors that contradicted the rule. */
  failedCriteria: string[];
};

/** The full result of ranking the crops for one profile. */
export type CropSuitabilityResult = {
  suggestions: CropSuggestionDto[];
  notRecommended: NotRecommendedCropDto[];
  /** The rule version the ranking was produced from. */
  ruleVersion: string;
  /** The ranking method, shown so the result can be understood. */
  method: string;
  /** Details the farmer did not give, which limited the check. */
  missingInformation: string[];
  /** The land area used for every rule comparison. */
  landAreaInAcres: number;
  /** The status of the rules themselves, so demo rules are never hidden. */
  ruleDataStatus: string;
  ruleSource: string;
};

/** The ranking method, kept in one place so the API and the UI agree. */
export const RANKING_METHOD =
  'Each crop is scored by the share of its rule that the profile confirmed. ' +
  'The rule factors are soil type, season, state, land area in acres, and irrigation. ' +
  'A factor that contradicts the rule removes the crop from the list. A factor that ' +
  'could not be checked because an optional detail was not given lowers the score and ' +
  'the confidence instead of counting as a match. Crops are ordered by score, then ' +
  'confidence, then crop name, so the same profile always produces the same order.';

/** Converts the entered land area into acres. */
export function landAreaInAcres(landArea: number, landAreaUnit: string): number {
  return toAcres(landArea, landAreaUnit);
}

/** Joins a list of values into a readable list. */
function listOf(values: string[]): string {
  if (values.length === 1) return values[0];
  if (values.length === 2) return values[0] + ' or ' + values[1];
  return values.slice(0, -1).join(', ') + ' or ' + values[values.length - 1];
}

/** Writes an area with the right word, so it never says "1 acres". */
function areaInAcres(value: number): string {
  return value === 1 ? '1 acre' : value + ' acres';
}

/** Checks the soil type against the rule. */
function checkSoil(rule: SuitabilityRule, profile: SuitabilityProfile): FactorOutcome {
  if (rule.soilTypes.length === 0) {
    return {
      factor: 'soil',
      status: 'not_restricted',
      detail: 'This rule does not restrict the soil type.',
    };
  }

  const wanted = rule.soilTypes.map((soil) => SOIL_LABELS[soil] ?? soil.toLowerCase());

  if (profile.soilType === 'OTHER') {
    return {
      factor: 'soil',
      status: 'unknown',
      detail:
        'Your soil type was recorded as other, so this rule could not be checked against it.',
    };
  }

  if (rule.soilTypes.includes(profile.soilType)) {
    return {
      factor: 'soil',
      status: 'matched',
      detail:
        'Your soil type (' +
        (SOIL_LABELS[profile.soilType] ?? profile.soilType.toLowerCase()) +
        ') is one this rule allows.',
    };
  }

  return {
    factor: 'soil',
    status: 'contradicted',
    detail:
      'This rule needs ' +
      listOf(wanted) +
      ' soil, and your soil type is ' +
      (SOIL_LABELS[profile.soilType] ?? profile.soilType.toLowerCase()) +
      '.',
  };
}

/** Checks the season against the rule. */
function checkSeason(rule: SuitabilityRule, profile: SuitabilityProfile): FactorOutcome {
  if (rule.seasons.length === 0) {
    return {
      factor: 'season',
      status: 'not_restricted',
      detail: 'This rule does not restrict the season.',
    };
  }

  const wanted = rule.seasons.map((season) => SEASON_LABELS[season] ?? season.toLowerCase());

  if (profile.season === 'OTHER') {
    return {
      factor: 'season',
      status: 'unknown',
      detail:
        'Your season was recorded as other, so this rule could not be checked against it.',
    };
  }

  if (rule.seasons.includes(profile.season)) {
    return {
      factor: 'season',
      status: 'matched',
      detail:
        'The ' +
        (SEASON_LABELS[profile.season] ?? profile.season.toLowerCase()) +
        ' season you plan to farm in is one this rule allows.',
    };
  }

  return {
    factor: 'season',
    status: 'contradicted',
    detail:
      'This rule is for the ' +
      listOf(wanted) +
      ' season, and you plan to farm in the ' +
      (SEASON_LABELS[profile.season] ?? profile.season.toLowerCase()) +
      ' season.',
  };
}

/** Checks the state against the rule. */
function checkState(rule: SuitabilityRule, profile: SuitabilityProfile): FactorOutcome {
  if (rule.applicableStates.length === 0) {
    return {
      factor: 'state',
      status: 'not_restricted',
      detail: 'This rule applies across states, so your state does not restrict it.',
    };
  }

  const state = profile.state.trim();
  if (state === '') {
    return {
      factor: 'state',
      status: 'unknown',
      detail: 'Your state was not given, so this rule could not be checked against it.',
    };
  }

  const matches = rule.applicableStates.some(
    (applicable) => applicable.trim().toLowerCase() === state.toLowerCase(),
  );

  if (matches) {
    return {
      factor: 'state',
      status: 'matched',
      detail: 'Your state (' + state + ') is one this rule applies to.',
    };
  }

  return {
    factor: 'state',
    status: 'contradicted',
    detail:
      'This rule is listed for ' +
      listOf(rule.applicableStates) +
      ', and your state is ' +
      state +
      '.',
  };
}

/** Checks the land area against the rule, after converting it to acres. */
function checkLandArea(
  rule: SuitabilityRule,
  acres: number,
): FactorOutcome {
  const min = rule.minLandAreaAcre;
  const max = rule.maxLandAreaAcre;

  if (min === null && max === null) {
    return {
      factor: 'landArea',
      status: 'not_restricted',
      detail: 'This rule does not restrict the size of the farm.',
    };
  }

  let range = '';
  if (min !== null && max !== null) {
    range = 'between ' + areaInAcres(min) + ' and ' + areaInAcres(max);
  } else if (min !== null) {
    range = 'at least ' + areaInAcres(min);
  } else if (max !== null) {
    range = 'at most ' + areaInAcres(max);
  }

  if ((min !== null && acres < min) || (max !== null && acres > max)) {
    return {
      factor: 'landArea',
      status: 'contradicted',
      detail:
        'This rule is written for farms of ' +
        range +
        ', and your farm is ' +
        areaInAcres(acres) +
        '.',
    };
  }

  return {
    factor: 'landArea',
    status: 'matched',
    detail:
      'Your farm of ' +
      areaInAcres(acres) +
      ' fits the range this rule expects (' +
      range +
      ').',
  };
}

/** Checks the irrigation against the rule. Irrigation is optional, so it can be unknown. */
function checkIrrigation(rule: SuitabilityRule, profile: SuitabilityProfile): FactorOutcome {
  if (rule.irrigationTypes.length === 0) {
    return {
      factor: 'irrigation',
      status: 'not_restricted',
      detail: 'This rule does not restrict the irrigation type.',
    };
  }

  const wanted = rule.irrigationTypes.map(
    (irrigation) => IRRIGATION_LABELS[irrigation] ?? irrigation.toLowerCase(),
  );

  const given = (profile.irrigationType ?? '').trim();
  if (given === '') {
    return {
      factor: 'irrigation',
      status: 'unknown',
      detail:
        'You did not say how you irrigate, so this rule could not be checked against that ' +
        'detail. It usually needs ' +
        listOf(wanted) +
        ' irrigation.',
    };
  }

  if (given === 'OTHER') {
    return {
      factor: 'irrigation',
      status: 'unknown',
      detail:
        'Your irrigation was recorded as other, so this rule could not be checked against it.',
    };
  }

  if (rule.irrigationTypes.includes(given)) {
    return {
      factor: 'irrigation',
      status: 'matched',
      detail:
        'Your ' +
        (IRRIGATION_LABELS[given] ?? given.toLowerCase()) +
        ' irrigation is one this rule allows.',
    };
  }

  return {
    factor: 'irrigation',
    status: 'contradicted',
    detail:
      'This rule is written for ' +
      listOf(wanted) +
      ' irrigation, and you use ' +
      (IRRIGATION_LABELS[given] ?? given.toLowerCase()) +
      '.',
  };
}

/** Checks every factor of one rule against one profile. */
function evaluateRule(
  rule: SuitabilityRule,
  profile: SuitabilityProfile,
  acres: number,
): FactorOutcome[] {
  return [
    checkSoil(rule, profile),
    checkSeason(rule, profile),
    checkState(rule, profile),
    checkLandArea(rule, acres),
    checkIrrigation(rule, profile),
  ];
}

/** The confidence order used when two crops have the same score. */
const CONFIDENCE_ORDER: Record<SuitabilityConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Works out the confidence from how much of the rule was confirmed. */
function confidenceFor(matched: number, unknown: number): SuitabilityConfidence {
  if (unknown === 0 && matched >= 3) return 'high';
  if (matched >= 3) return 'medium';
  return 'low';
}

/** True when the farmer's crop name matches this crop. */
function matchesCurrentCrop(
  rule: SuitabilityRule,
  currentCrop: string | null | undefined,
): boolean {
  const wanted = (currentCrop ?? '').trim().toLowerCase();
  if (wanted === '') return false;
  return wanted === rule.cropSlug.toLowerCase() || wanted === rule.cropName.toLowerCase();
}

/** Builds the sentence that says why the crop was suggested. */
function buildExplanation(
  outcomes: FactorOutcome[],
  isCurrentCrop: boolean,
): string {
  const matched = outcomes.filter((outcome) => outcome.status === 'matched');

  if (matched.length === 0) {
    return (
      'This rule only says what to check locally before you plant, so your profile could ' +
      'not confirm it. Read it before you decide.'
    );
  }

  const parts = matched.map((outcome) => outcome.detail.replace(/\.$/, '').toLowerCase());
  const list =
    parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];

  const current = isCurrentCrop
    ? ' You also said this is the crop you already grow or plan to grow.'
    : '';

  return 'It matches your profile because ' + list + '.' + current;
}

/** Ranks the crops for one profile against the supplied rules. */
export function rankCropsForProfile(
  profile: SuitabilityProfile,
  rules: SuitabilityRule[],
): CropSuitabilityResult {
  const acres = landAreaInAcres(profile.landArea, profile.landAreaUnit);

  const suggestions: CropSuggestionDto[] = [];
  const notRecommended: NotRecommendedCropDto[] = [];

  for (const rule of rules) {
    const outcomes = evaluateRule(rule, profile, acres);
    const contradictions = outcomes.filter((outcome) => outcome.status === 'contradicted');

    if (contradictions.length > 0) {
      notRecommended.push({
        crop: { slug: rule.cropSlug, name: rule.cropName },
        reason:
          'Left out because your profile does not match this rule: ' +
          contradictions.map((outcome) => outcome.detail).join(' '),
        failedCriteria: contradictions.map((outcome) => outcome.detail),
      });
      continue;
    }

    const matched = outcomes.filter((outcome) => outcome.status === 'matched').length;
    const unknown = outcomes.filter((outcome) => outcome.status === 'unknown').length;
    const checkable = matched + unknown;
    const score = checkable === 0 ? 0 : Math.round((matched / checkable) * 100);
    const isCurrentCrop = matchesCurrentCrop(rule, profile.currentCrop);

    suggestions.push({
      rank: 0,
      crop: { slug: rule.cropSlug, name: rule.cropName, category: rule.cropCategory },
      score,
      confidence: confidenceFor(matched, unknown),
      matchedCriteria: outcomes
        .filter((outcome) => outcome.status === 'matched' || outcome.status === 'not_restricted')
        .map((outcome) => outcome.detail),
      missingInformation: outcomes
        .filter((outcome) => outcome.status === 'unknown')
        .map((outcome) => outcome.detail),
      explanation: buildExplanation(outcomes, isCurrentCrop),
      guidance: rule.explanation,
      rule: { version: rule.ruleVersion, source: rule.source, dataStatus: rule.dataStatus },
      isCurrentCrop,
    });
  }

  suggestions.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    const byConfidence = CONFIDENCE_ORDER[left.confidence] - CONFIDENCE_ORDER[right.confidence];
    if (byConfidence !== 0) return byConfidence;
    return left.crop.name.localeCompare(right.crop.name);
  });

  suggestions.forEach((suggestion, index) => {
    suggestion.rank = index + 1;
  });

  notRecommended.sort((left, right) => left.crop.name.localeCompare(right.crop.name));

  const missingInformation: string[] = [];
  if (!profile.irrigationType) {
    missingInformation.push(
      'You did not give an irrigation type, so the rules that depend on irrigation were ' +
        'scored with lower confidence instead of being treated as a match.',
    );
  }

  return {
    suggestions,
    notRecommended,
    ruleVersion: rules[0]?.ruleVersion ?? 'none',
    method: RANKING_METHOD,
    missingInformation,
    landAreaInAcres: acres,
    ruleDataStatus: rules[0]?.dataStatus ?? 'UNAVAILABLE',
    ruleSource: rules[0]?.source ?? 'unknown',
  };
}
