import type { CorsConfig } from './env.ts';
import { isOriginAllowed } from './env.ts';

export const ALLOWED_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
export const ALLOWED_HEADERS = 'Content-Type, Authorization, Accept';
export const EXPOSED_HEADERS = 'Content-Type';
export const PREFLIGHT_MAX_AGE_SECONDS = '600';

/**
 * Builds the CORS headers for an approved origin.
 *
 * The exact origin is echoed back rather than `*`, because the policy also
 * sets `Access-Control-Allow-Credentials: true`, and a wildcard is illegal
 * whenever credentials are allowed (AGENTS.md section 5).
 */
export function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS);
  headers.set('Access-Control-Max-Age', PREFLIGHT_MAX_AGE_SECONDS);
  // Required so a shared cache does not serve one origin's headers to another.
  headers.set('Vary', 'Origin');
  return headers;
}

export type CorsDecision =
  | { kind: 'no-origin' }
  | { kind: 'allowed'; origin: string }
  | { kind: 'rejected'; origin: string | null };

/**
 * Decides how to treat a request's `Origin` header.
 *
 * - No `Origin` at all means a same-origin or server-to-server call. CORS does
 *   not apply, so the request is allowed through untouched.
 * - A listed origin is allowed and receives the CORS headers.
 * - Anything else, including a malformed origin, is rejected.
 */
export function decideCors(origin: string | null, config: CorsConfig): CorsDecision {
  if (origin === null || origin.trim() === '') return { kind: 'no-origin' };
  if (isOriginAllowed(origin, config)) {
    return { kind: 'allowed', origin: origin.replace(/\/+$/, '').toLowerCase() };
  }
  return { kind: 'rejected', origin };
}

export function rejectedResponse(status: number, message: string): Response {
  const body = JSON.stringify({
    success: false,
    error: { code: 'FORBIDDEN', message },
  });
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', Vary: 'Origin' },
  });
}
