/**
 * The client for the farmer profile endpoints.
 *
 * The shapes here mirror the backend response exactly, so the interface
 * never has to guess what the API returned. The API is still the authority:
 * whatever the browser checks, the server checks again before storing
 * anything.
 */
import { getJson, postJson } from './apiClient';
import type { FarmProfileRequest } from './farmProfileValidation';

/** The freshness of the data that was matched for the profile. */
export type ProfileDataStatus = 'LIVE' | 'RECENT' | 'DEMO' | 'UNAVAILABLE';

/** The stored profile, as the API returns it. */
export type FarmProfileDto = {
  id: string;
  state: string;
  district: string;
  soilType: string;
  season: string;
  landArea: number;
  landAreaUnit: string;
  /** The same area converted to acres, so two entries can be compared. */
  landAreaInAcres: number;
  villageOrPin: string | null;
  irrigationType: string | null;
  currentCrop: string | null;
  createdAt: string;
};

/** What the data source could resolve for the submitted location. */
export type MatchingDataDto = {
  priceObservations: number;
  markets: number;
  /** False when the source could only read part of the records. */
  isComplete: boolean;
  dataStatus: ProfileDataStatus;
  source: string;
  notice: string;
};

/** How much of the rule set could be checked. */
export type SuitabilityConfidence = 'high' | 'medium' | 'low';

/** One ranked crop suggestion. */
export type CropSuggestionDto = {
  rank: number;
  crop: { slug: string; name: string; category: string };
  /** Share of the rule the profile confirmed, from 0 to 100. */
  score: number;
  confidence: SuitabilityConfidence;
  matchedCriteria: string[];
  missingInformation: string[];
  explanation: string;
  guidance: string;
  rule: { version: string; source: string; dataStatus: string };
  isCurrentCrop: boolean;
};

/** A crop that was left out, with the reason. */
export type NotRecommendedCropDto = {
  crop: { slug: string; name: string };
  reason: string;
  failedCriteria: string[];
};

/** The ranked crop suggestions and the method behind them. */
export type CropSuitabilityDto = {
  suggestions: CropSuggestionDto[];
  notRecommended: NotRecommendedCropDto[];
  ruleVersion: string;
  method: string;
  missingInformation: string[];
  landAreaInAcres: number;
  ruleDataStatus: string;
  ruleSource: string;
};

/** The direction the observed prices moved in. */
export type TrendDirection = 'rising' | 'falling' | 'stable' | 'insufficient_data';

/** The observed price trend. */
export type TrendAnalysisDto = {
  direction: TrendDirection;
  metric: 'MODAL_PRICE';
  summary: string;
  reason: string | null;
  observationCount: number;
  distinctDates: number;
  period: { from: string; to: string; days: number } | null;
  unit: string;
  unitLabel: string;
  currency: 'INR';
  firstPrice: number | null;
  lastPrice: number | null;
  meanPrice: number | null;
  changePercent: number | null;
  dataStatus: ProfileDataStatus;
  isDemoData: boolean;
  source: string;
  method: string;
};

/** The baseline forecast, when the data supported one. */
export type ForecastDto = {
  status: 'ok' | 'insufficient_data';
  metric: 'MODAL_PRICE';
  /** Always false. A forecast is never an observed price. */
  isObserved: false;
  pointEstimate: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  unit: string;
  unitLabel: string;
  currency: 'INR';
  horizonDays: number;
  horizonLabel: string;
  evidence: {
    from: string;
    to: string;
    observations: number;
    distinctDates: number;
    coverageDays: number;
    droppedObservations: number;
  } | null;
  dataQuality: 'low' | 'medium' | 'high' | null;
  dataStatus: ProfileDataStatus;
  isDemoData: boolean;
  source: string;
  method: string;
  reason: string | null;
};

/** The selling-period insights. */
export type SellingInsightsDto = {
  status: 'available' | 'insufficient_data';
  summary: string;
  points: string[];
  caveats: string[];
  observedTrend: TrendAnalysisDto | null;
  forecast: ForecastDto | null;
  narrative: string | null;
  dataStatus: ProfileDataStatus;
  isDemoData: boolean;
  method: string;
};

/** How complete the analysis is. */
export type ProfileAnalysisStatus = 'computed' | 'partial' | 'unavailable';

/** The analysis block shared by both profile endpoints. */
export type ProfileAnalysisBlock = {
  status: ProfileAnalysisStatus;
  /** A plain-language sentence describing what was computed. */
  message: string;
  cropSuggestions: CropSuitabilityDto | null;
  sellingInsights: SellingInsightsDto | null;
};

export type FarmProfileAnalysisDto = {
  profileId: string;
  /**
   * The unguessable token that authorises reading this profile back.
   *
   * The backend returns it once, here, and stores only its hash. The browser
   * keeps it in session storage, so it is never shared with another
   * browser and never leaves this tab.
   */
  analysisToken: string;
  savedAt: string;
  profile: FarmProfileDto;
  matchingData: MatchingDataDto;
  analysis: ProfileAnalysisBlock;
  notice: string;
};

/**
 * The analysis of one saved profile.
 *
 * The optional village or PIN detail is not repeated here, because the
 * analysis does not use it and the page does not need it.
 */
export type SavedProfileAnalysisDto = {
  profileId: string;
  savedAt: string;
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
  };
  analysis: ProfileAnalysisBlock;
  notice: string;
};

/** Sends the profile to the API and returns the stored profile and analysis. */
export function postFarmProfile(body: FarmProfileRequest): Promise<FarmProfileAnalysisDto> {
  return postJson<FarmProfileAnalysisDto>('/api/farm-profile/analyze', body);
}

/**
 * Reads a saved profile back, using the access token that was handed out
 * when it was created.
 *
 * The token travels in a request header rather than in the query string, so
 * it never appears in a URL or in a browser history entry.
 */
export function fetchSavedAnalysis(
  analysisToken: string,
): Promise<SavedProfileAnalysisDto> {
  return getJson<SavedProfileAnalysisDto>('/api/farm-profile/analysis', {
    headers: { 'X-Analysis-Token': analysisToken },
  });
}
