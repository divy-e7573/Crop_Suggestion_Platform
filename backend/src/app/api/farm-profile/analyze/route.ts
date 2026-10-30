import { connection } from 'next/server';

import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validation';
import { createFarmProfile } from '@/lib/db/repositories';
import { getMandiProvider } from '@/lib/providers/registry';
import {
  farmProfileSchema,
  isRecoverableProviderFailure,
  summariseMatchingData,
  toAcres,
  unavailableMatchingData,
  type FarmProfileAnalysisDto,
} from '@/lib/services/farmProfileService';

/**
 * `POST /api/farm-profile/analyze` - validate and store a farmer profile.
 *
 * The body is validated again on the server, whatever the browser did
 * (AGENTS.md section 5). The profile is then stored and the response reports
 * what the active data source could resolve for that location.
 *
 * Crop suggestions and selling-period insights are not computed here: that is
 * the Phase 8 rule engine. The response says so explicitly, so an empty
 * suggestion list is never mistaken for "no crops suit this farm".
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
    try {
      matching = await summariseMatchingData(provider, input);
    } catch (error) {
      if (!isRecoverableProviderFailure(error)) throw error;

      // The profile itself is valid, so it is still stored. The response says
      // the data source could not be read instead of pretending it was
      // (PRD section 12).
      matching = unavailableMatchingData(
        provider,
        error instanceof Error ? error.message : 'The data source could not be read.',
      );
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
        status: 'not_computed',
        cropSuggestions: null,
        sellingInsights: null,
        message:
          'Your profile was validated and saved. Crop suggestions and selling-period ' +
          'insights are added in a later phase, so no ranking is shown yet.',
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
