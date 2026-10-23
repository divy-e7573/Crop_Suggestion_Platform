import { NextResponse, type NextRequest } from 'next/server';

import { corsHeaders, decideCors, rejectedResponse } from '@/lib/api/cors';
import { loadCorsConfig } from '@/lib/api/env';

// Next.js 16 names this file proxy.ts (the former middleware.ts). It runs
// before any route handler, which is the only place that can answer a browser
// preflight: an OPTIONS request never reaches a GET-only route.
//
// Only /api/* is matched, so the SSG and SSR demonstration pages are untouched.
export function proxy(request: NextRequest) {
  const config = loadCorsConfig();
  const origin = request.headers.get('origin');
  const decision = decideCors(origin, config);
  const isPreflight = request.method === 'OPTIONS';

  if (decision.kind === 'rejected') {
    return rejectedResponse(
      403,
      'This origin is not allowed to call the Krishi Mandi API. Add it to ' +
        'CORS_ALLOWED_ORIGINS on the backend if it should be permitted.',
    );
  }

  if (decision.kind === 'allowed') {
    const cors = corsHeaders(decision.origin);

    // Answer the preflight here and stop before the route handler runs.
    if (isPreflight) {
      return new NextResponse(null, { status: 204, headers: cors });
    }

    const response = NextResponse.next();
    cors.forEach((value, key) => response.headers.set(key, value));
    return response;
  }

  // Same-origin, curl, or server-to-server: CORS does not apply.
  if (isPreflight) {
    return rejectedResponse(400, 'A preflight request must include an Origin header.');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
