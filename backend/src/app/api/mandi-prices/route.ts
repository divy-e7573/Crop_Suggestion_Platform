import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { parseQuery } from '@/lib/api/validation';
import { getMandiProvider } from '@/lib/providers/registry';
import { listMandiPrices, priceQuerySchema } from '@/lib/services/mandiService';
import { connection } from 'next/server';

/**
 * `GET /api/mandi-prices` - recent price observations.
 *
 * Query parameters: `crop`, `market`, `state`, `district`, `from`, `to`,
 * `limit` and `offset`. Every response carries a `dataSource` block, and
 * every observation carries its own `dataStatus` and `source`, so a client
 * can never present a seeded price as a live one.
 */
export async function GET(request: Request): Promise<Response> {
  // Marks the route as request-dependent, so it is never prerendered. The
  // call sits outside the try block on purpose: during a build it rejects to
  // tell Next.js to render this route on demand.
  await connection();

  try {
    const query = parseQuery(priceQuerySchema, request);
    const provider = getMandiProvider();
    const result = await listMandiPrices(provider, query);
    return jsonOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
