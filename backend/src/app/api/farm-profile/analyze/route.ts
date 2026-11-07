import { connection } from 'next/server';

import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validation';
import { createFarmProfile } from '@/lib/db/repositories';
import { getMandiProvider } from '@/lib/providers/registry';
import { createAiNarrativeProvider } from '@/lib/services/aiNarrativeProvider';
import {
  farmProfileSchema,
  isRecoverableProviderFailure,
  summariseMatchingData,
  toAcres,
  unavailableMatchingData,
} from '@/lib/services/farmProfileService';
import {
  computeProfileAnalysis,
  createDatabaseSuitabilityRuleSource,
  type FarmProfileAnalysisDto,
} from '@/lib/services/profileAnalysisService';

/**
 * The farmer profile endpoint.
 *
 * The body is validated again on the server, whatever the browser did
 * (AGENTS.md section 5). The profile is stored, and the response then
 * carries the Phase 8 analysis: the ranked crop suggestions and the
 * selling-period insights.
 *
 * A provider failure is never fatal and never falls back to demonstration
 * rows. The profile is still stored, the crop suggestions still stand, and
 * the market part of the analysis says why it is empty (PRD section 12).
 */
export async function POST(request: Request): Promise<Response> {
  // Marks the route as request-dependent, so it is never prerendered. The
  // call sits outside the try block on purpose: during a build it rejects to
  // tell Next.js to render this route on demand.
  await connection();

  try {
    const input = await parseJsonBody(farmProfileSchema, request);
    const provider = getMandiProvider();

    let matching;
    let marketDataUnavailable: string | null = null;

    try {
      matching = await summariseMatchingData(provider, input);
    } catch (error) {
      if (!isRecoverableProviderFailure(error)) throw error;

      // The profile itself is valid, so it is still stored. The response says
      // the data source could not be read instead of pretending it was.
      marketDataUnavailable =
        error instanceof Error ? error.message : 'The data source could not be read.';
      matching = unavailableMatchingData(provider, marketDataUnavailable);
    }

    const stored = await createFarmProfile({
      state: input.state,
      district: input.district,
      soilType: input.soilType,
      season: input.season,
      landArea: input.landArea,
      landAreaUnit: input.landAreaUnit,
      villageOrPin: input.villageOrPin ?? null,
      irrigationType: input.irrigationType ?? null,
      currentCrop: input.currentCrop ?? null,
      dataSourceId: provider.id,
      dataStatus: matching.dataStatus,
      matchingObservations: matching.priceObservations,
      matchingMarkets: matching.markets,
      matchingIsComplete: matching.isComplete,
    });

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
      marketDataUnavailable,
    });

    const body: FarmProfileAnalysisDto = {
      profileId: stored.id,
      savedAt: stored.createdAt.toISOString(),
      profile: {
        id: stored.id,
        state: stored.state,
        district: stored.district,
        soilType: stored.soilType,
        season: stored.season,
        landArea: Number(stored.landArea),
        landAreaUnit: stored.landAreaUnit,
        landAreaInAcres: toAcres(Number(stored.landArea), stored.landAreaUnit),
        villageOrPin: stored.villageOrPin,
        irrigationType: stored.irrigationType,
        currentCrop: stored.currentCrop,
        createdAt: stored.createdAt.toISOString(),
      },
      matchingData: matching,
      analysis: {
        status: analysis.status,
        message: analysis.message,
        cropSuggestions: analysis.cropSuggestions,
        sellingInsights: analysis.sellingInsights,
      },
      notice:
        'Your details were checked and stored so the app can find matching markets. ' +
        'Nothing here is a promise about yield, price, or profit.',
    };

    return jsonOk(body, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
