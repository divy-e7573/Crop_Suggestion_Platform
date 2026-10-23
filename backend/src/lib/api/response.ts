import { ApiError, type ApiErrorCode, type ApiErrorDetail, isApiError } from './errors.ts';

/**
 * The single JSON shape every route returns.
 *
 * Success: `{ success: true, data: ... }`
 * Failure: `{ success: false, error: { code, message, details? } }`
 *
 * Clients can therefore branch on `success` alone instead of guessing from
 * the HTTP status (PRD FR-09).
 *
 * This module deliberately uses the standard `Response` rather than
 * `NextResponse`, so the error-handling logic can be unit tested without the
 * Next.js runtime.
 */
export type ApiSuccess<T> = { success: true; data: T };

export type ApiFailure = {
  success: false;
  error: { code: ApiErrorCode; message: string; details?: ApiErrorDetail[] };
};

export function jsonOk<T>(data: T, status = 200): Response {
  const body: ApiSuccess<T> = { success: true, data };
  return Response.json(body, { status });
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetail[],
): Response {
  const body: ApiFailure = {
    success: false,
    error: details && details.length > 0 ? { code, message, details } : { code, message },
  };
  return Response.json(body, { status });
}

/**
 * Maps any thrown value onto a safe HTTP response.
 *
 * A known `ApiError` keeps its status and message. Anything else becomes a
 * generic 500: the original error is logged on the server only, and neither
 * its message nor its stack reaches the client.
 */
export function toErrorResponse(error: unknown): Response {
  if (isApiError(error)) {
    return jsonError(error.status, error.code, error.message, error.details);
  }

  // Server-side only. Deliberately logs the raw error for local debugging.
  console.error('[api] Unhandled error:', error);

  return jsonError(
    500,
    'INTERNAL_ERROR',
    'The server could not complete the request. Please try again.',
  );
}

export { ApiError };
