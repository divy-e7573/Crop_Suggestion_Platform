/**
 * Error types for the API layer.
 *
 * Only `ApiError` and its subclasses ever reach the client. Anything else is
 * treated as an unexpected internal fault and is reported with a generic
 * message, so stack traces, SQL text, and environment values can never leak
 * (AGENTS.md section 4).
 */

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'FORBIDDEN',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorDetail = {
  /** Dotted path of the offending field, for example `landArea`. */
  field: string;
  message: string;
  code: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: ApiErrorDetail[] | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'The requested resource was not found.') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
