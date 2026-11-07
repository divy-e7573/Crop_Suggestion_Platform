import { connection } from 'next/server';

import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { findLatestFarmProfile } from '@/lib/db/repositories';
import { getMandiProvider } from '@/lib/providers/registry';
import { createAiNarrativeProvider } from '@/lib/services/aiNarrativeProvider';
import { toAcres } from '@/lib/services/farmProfileService';
import {
  computeProfileAnalysis,
  createDatabaseSuitabilityRuleSource,
  type LatestProfileAnalysisDto,
} from '@/lib/services/profileAnalysisService';

/**
 * The most recently saved analysis.
 *
 * The crop-suggestions page needs to show the analysis for the profile that
 * was already saved, and it must still work after a page reload. The
 * analysis is recomputed from the stored profile and the current data, so
 * it never shows a stale price as if it were current.
 *
 * The optional village or PIN detail is not repeated in this response: the
 * analysis never uses it and the page does not need it (PRD section 13).
 */
export async function GET(): Promise<Response> {
  // Marks the route as request-dependent, so it is never prerendered.
  await connection();

  try {
    const stored = await findLatestFarmProfile();

    if (!stored) {
      const empty: LatestProfileAnalysisDto = {
        profileId: null,
        savedAt: null,
        profile: null,
        analysis: {
          status: 'unavailable',
          message:
            'No farm profile has been saved yet, so there is nothing to analyse. Save ' +
            'your profile first and the suggestions will use it.',
          cropSuggestions: null,
          sellingInsights: null,
        },
        notice:
          'Crop suggestions and selling insights are worked out from a saved farm profile.',
      };

      return jsonOk(empty);
    }

    const provider = getMandiProvider();
    const analysis = await computeProfileAnalysis({
      profile: {
        id: stored.id,
        state: stored.state,
        district: stored.district,
        soilType: stored.soilType,
        season: stored.season,
        landArea: Number(stored.landArea),
        landAreaUnit: stored.landAreaUnit,
        villageOrPin: stored.villageOrPin,
        irrigationType: stored.irrigationType,
        currentCrop: stored.currentCrop,
        createdAt: stored.createdAt.toISOString(),
      },
      provider,
      rules: createDatabaseSuitabilityRuleSource(),
      ai: createAiNarrativeProvider(),
    });

    const body: LatestProfileAnalysisDto = {
      profileId: stored.id,
      savedAt: stored.createdAt.toISOString(),
      profile: {
        state: stored.state,
        district: stored.district,
        soilType: stored.soilType,
        season: stored.season,
        landArea: Number(stored.landArea),
        landAreaUnit: stored.landAreaUnit,
        landAreaInAcres: toAcres(Number(stored.landArea), stored.landAreaUnit),
        irrigationType: stored.irrigationType,
        currentCrop: stored.currentCrop,
      },
      analysis: {
        status: analysis.status,
        message: analysis.message,
        cropSuggestions: analysis.cropSuggestions,
        sellingInsights: analysis.sellingInsights,
      },
      notice:
        'These suggestions and insights were worked out from your most recently saved ' +
        'farm profile. Nothing here is a promise about yield, price, or profit.',
    };

    return jsonOk(body);
  } catch (error) {
    return toErrorResponse(error);
  }
}
