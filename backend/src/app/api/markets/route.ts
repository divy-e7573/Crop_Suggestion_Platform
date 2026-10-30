import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { parseQuery } from '@/lib/api/validation';
import { getMandiProvider } from '@/lib/providers/registry';
import { listMandiMarkets, marketQuerySchema } from '@/lib/services/mandiService';
import { connection } from 'next/server';

/**
 * `GET /api/markets` - markets and their latest available price.
 *
 * Query parameters: `market`, `state`, `district`, `limit` and `offset`.
 * A market only reports a distance when its source published verified
 * coordinates; otherwise `hasVerifiedCoordinates` is false.
 */
export async function GET(request: Request): Promise<Response> {
  // Marks the route as request-dependent, so it is never prerendered. The
  // call sits outside the try block on purpose: during a build it rejects to
  // tell Next.js to render this route on demand.
  await connection();

  try {
    const query = parseQuery(marketQuerySchema, request);
    const provider = getMandiProvider();
    const result = await listMandiMarkets(provider, query);
    return jsonOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
