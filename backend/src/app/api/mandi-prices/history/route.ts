import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { parseQuery } from '@/lib/api/validation';
import { getMandiProvider } from '@/lib/providers/registry';
import { getPriceHistorySeries, priceHistoryQuerySchema } from '@/lib/services/mandiService';
import { connection } from 'next/server';

/**
 * `GET /api/mandi-prices/history` - the price series for one crop at one
 * market.
 *
 * `crop` and `market` are both required, so the answer is always a
 * single series that a chart can draw without mixing two commodities or two
 * markets into one line (PRD FR-04).
 */
export async function GET(request: Request): Promise<Response> {
  // Marks the route as request-dependent, so it is never prerendered. The
  // call sits outside the try block on purpose: during a build it rejects to
  // tell Next.js to render this route on demand.
  await connection();

  try {
    const query = parseQuery(priceHistoryQuerySchema, request);
    const provider = getMandiProvider();
    const result = await getPriceHistorySeries(provider, query);
    return jsonOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

