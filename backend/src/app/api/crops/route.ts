import { jsonOk, toErrorResponse } from '@/lib/api/response';
import { getMandiProvider } from '@/lib/providers/registry';
import { listSupportedCrops } from '@/lib/services/cropService';
import { connection } from 'next/server';

/**
 * `GET /api/crops` - the crops this platform supports.
 *
 * The endpoint exists because the price list cannot tell a client which
 * crops exist: it only returns the crops that happen to match a filter.
 * The catalogue is reference data and says so in its own block, so it is
 * never read as a live price feed.
 */
export async function GET(): Promise<Response> {
  // The status is built per request, so the route is never prerendered. The
  // call sits outside the try block on purpose: during a build it rejects to
  // tell Next.js to render this route on demand.
  await connection();

  try {
    const provider = getMandiProvider();
    const result = await listSupportedCrops(provider);
    return jsonOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

