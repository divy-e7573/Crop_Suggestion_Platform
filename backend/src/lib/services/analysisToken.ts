import { createHash, randomBytes } from 'node:crypto';

/**
 * The access token that authorises reading a farmer profile back.
 *
 * The Phase 9 privacy review found that `GET /api/farm-profile/latest`
 * returned the most recently saved farmer profile to anybody who asked for
 * it. On a shared or deployed backend that means one farmer's state,
 * district, soil type and land area could be read by another visitor.
 * CORS is not authentication: it only tells a browser whether it may read a
 * response, and it says nothing about who the caller is.
 *
 * The fix is a capability token. Each profile gets one unguessable token,
 * which is handed to the browser that created the profile and is required to
 * read that profile back. No account, cookie, or session system is involved,
 * so the product still has no authentication (PRD section 4, AGENTS.md
 * section 2).
 *
 * Only the hash of the token is stored. A copy of the database therefore
 * cannot be used to read anybody's profile, and the raw token is shown once
 * and then only lives in the browser that asked for it.
 */

/** The request header the token is sent in. */
export const ANALYSIS_TOKEN_HEADER = 'x-analysis-token';

/** How many random bytes the token is built from. */
const TOKEN_BYTES = 32;

/** The length of a token, in base64url characters. */
const TOKEN_LENGTH = 43;

/** Builds a new unguessable token. */
export function createAnalysisToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Hashes a token for storage.
 *
 * The hash is what is written to the database, so a leaked database cannot be
 * turned back into a working token.
 */
export function hashAnalysisToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Checks that a token has the expected shape before it is hashed.
 *
 * A malformed token is rejected with a clear message instead of being looked
 * up, which keeps junk out of the database query.
 */
export function isAnalysisToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** The expected length of a token, used in the error message. */
export const ANALYSIS_TOKEN_LENGTH = TOKEN_LENGTH;
