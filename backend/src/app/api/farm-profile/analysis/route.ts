import { connection } from 'next/server';

import { jsonOk, noStore, toErrorResponse } from '@/lib/api/response';
import { NotFoundError, ValidationError } from '@/lib/api/errors';
import { findFarmProfileByTokenHash } from '@/lib/db/repositories';
import { getMandiProvider } from '@/lib/providers/registry';
import {
  ANALYSIS_TOKEN_HEADER,
  hashAnalysisToken,
  isAnalysisToken,
} from '@/lib/services/analysisToken';
import { createAiNarrativeProvider } from '@/lib/services/aiNarrativeProvider';
import { toAcres } from '@/lib/services/farmProfileService';
import {
  computeProfileAnalysis,
  createDatabaseSuitabilityRuleSource,
  type SavedProfileAnalysisDto,
} from '@/lib/services/profileAnalysisService';

/**
 * Reads one saved farmer profile back, and recomputes its analysis.
 *
 * The caller must present the access token that was handed out when the
 * profile was created. There is deliberately **no** "give me the most recent
 * profile" endpoint any more: the Phase 9 privacy review found that one
 * exposed a farmer's state, district, soil type and land area to every other
 * visitor of a shared deployment. CORS is not authentication, and a profile
 * is personal data (PRD section 13, AGENTS.md section 5).
 *
 * The token travels in a request header rather than in the query string, so
 * it does not end up in a URL, a browser history, or a server access log.
 *
 * The analysis is recomputed from the current data on every request, so a
 * stale price is never shown as if it were current.
 */
export async function GET(request: Request): Promise<Response> {
  // Marks the route as request-dependent, so it is never prerendered.
  await connection();

  try {
    const token = request.headers.get(ANALYSIS_TOKEN_HEADER);

    if (!isAnalysisToken(token)) {
      throw new ValidationError(
        'This analysis can only be read with the access token that was returned ' +
          'when the profile was saved. Save your profile again to get a new one.',
        [
          {
            field: ANALYSIS_TOKEN_HEADER,
            message: 'The access token is missing or malformed.',
            code: 'invalid_token',
          },
        ],
      );
    }

    const stored = await findFarmProfileByTokenHash(hashAnalysisToken(token));

    // An unknown token is reported as "not found" rather than as a separate
    // error, so the response says nothing about which tokens exist.
    if (!stored) {
      throw new NotFoundError(
        'No saved profile matches this access token. Save your profile again to ' +
          'get a new analysis.',
      );
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

    const body: SavedProfileAnalysisDto = {
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
        'These suggestions and insights were worked out from your own saved farm ' +
        'profile. Nothing here is a promise about yield, price, or profit.',
    };

    // The profile is personal data: it must not be kept by a shared cache.
    return noStore(jsonOk(body));
  } catch (error) {
    return toErrorResponse(error);
  }
}
