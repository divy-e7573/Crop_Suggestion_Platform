/**
 * The client for the farmer profile endpoint.
 *
 * The shapes here mirror the backend response exactly, so the form never has
 * to guess what the API returned. The API is still the authority: whatever
 * the browser checks, the server checks again before storing anything.
 */
import { postJson } from './apiClient';
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

/** Sends the profile to the API and returns the stored profile. */
export function postFarmProfile(body: FarmProfileRequest): Promise<FarmProfileAnalysisDto> {
  return postJson<FarmProfileAnalysisDto>('/api/farm-profile/analyze', body);
}

