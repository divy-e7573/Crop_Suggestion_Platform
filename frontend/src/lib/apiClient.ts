/**
 * A small client for the backend's JSON envelope.
 *
 * Every API response is `{ success: true, data }` or
 * `{ success: false, error }`, so one helper can handle both shapes and the
 * caller can rely on a typed value or a typed failure.
 */
import { apiUrl } from './apiConfig';

export type ApiErrorDetail = {
  /** The form field the error belongs to, when the error is about one field. */
  field: string;
  message: string;
  code: string;
};

/** A failed API call, with the backend's own error code and field details. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the request never reached the backend. */
  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }
}

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: ApiErrorDetail[] } };

/** Fetches a resource and returns the `data` block of a successful response. */
export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Sends a JSON body and returns the `data` block of a successful response. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Performs one request and unwraps the standard response envelope. */
async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check that the backend is running, then try again.',
    );
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text === '' ? null : JSON.parse(text);
  } catch {
    throw new ApiRequestError(
      response.status,
      'INVALID_RESPONSE',
      'The server sent a response the app could not read. Please try again.',
    );
  }

  const envelope = payload as ApiEnvelope<T> | null;

  if (!envelope || typeof envelope !== 'object' || !('success' in envelope)) {
    throw new ApiRequestError(
      response.status,
      'INVALID_RESPONSE',
      'The server sent a response the app could not read. Please try again.',
    );
  }

  if (!envelope.success) {
    throw new ApiRequestError(
      response.status,
      envelope.error.code,
      envelope.error.message,
      envelope.error.details ?? [],
    );
  }

  return envelope.data;
}
