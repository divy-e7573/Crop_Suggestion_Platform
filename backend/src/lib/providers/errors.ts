/**
 * Provider failures.
 *
 * These errors are deliberately HTTP-agnostic: the provider layer says what
 * went wrong with the data source, and the service layer decides which HTTP
 * status and error code to expose. A provider never falls back to demo rows
 * when its upstream fails, because that would quietly pass demo data off as
 * real data (PRD section 12, AGENTS.md section 3).
 */

export type ProviderErrorKind =
  | 'not-configured'
  | 'unavailable'
  | 'rate-limited'
  | 'invalid-response';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;

  constructor(kind: ProviderErrorKind, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
  }
}

/** The provider is selected but cannot run, for example a missing API key. */
export class ProviderNotConfiguredError extends ProviderError {
  constructor(message: string) {
    super('not-configured', message);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** The upstream could not be reached, timed out, or answered with an error. */
export class ProviderUnavailableError extends ProviderError {
  constructor(message: string) {
    super('unavailable', message);
    this.name = 'ProviderUnavailableError';
  }
}

/** The upstream refused the request because of a request budget. */
export class ProviderRateLimitedError extends ProviderError {
  constructor(message: string) {
    super('rate-limited', message);
    this.name = 'ProviderRateLimitedError';
  }
}

/** The upstream answered, but the payload was not usable. */
export class ProviderInvalidResponseError extends ProviderError {
  constructor(message: string) {
    super('invalid-response', message);
    this.name = 'ProviderInvalidResponseError';
  }
}

export function isProviderError(value: unknown): value is ProviderError {
  return value instanceof ProviderError;
}
