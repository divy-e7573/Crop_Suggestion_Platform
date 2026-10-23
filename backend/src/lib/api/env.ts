/**
 * Server-only environment access.
 *
 * Nothing in this module may be imported by client code: it reads process
 * environment variables, which must never reach the browser bundle
 * (AGENTS.md section 5).
 */

export const CORS_ENV_VAR = 'CORS_ALLOWED_ORIGINS';

/** Origins assumed when the variable is missing during local development. */
export const DEV_FALLBACK_ORIGINS = ['http://localhost:5173'] as const;

export type CorsConfig = {
  /** Normalised, lower-cased origins that may receive CORS headers. */
  allowedOrigins: readonly string[];
  /** Human-readable configuration problems, logged server-side only. */
  issues: readonly string[];
  /** True when the allowlist came from the development fallback. */
  usingFallback: boolean;
};

/**
 * Accepts only absolute `http(s)` origins such as `http://localhost:5173`.
 *
 * Rejects wildcards, `null`, and anything carrying a path, query, or hash,
 * because those are not valid CORS origins and would widen access.
 */
export function isValidOrigin(value: string): boolean {
  if (value === '*' || value === 'null') return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') {
    return false;
  }

  // `url.origin` drops any path and trailing slash, so requiring an exact match
  // rejects entries such as `http://localhost:5173/app`.
  return url.origin === value.replace(/\/+$/, '');
}

function splitOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Builds the CORS allowlist from `CORS_ALLOWED_ORIGINS`.
 *
 * Fails closed: when the variable is missing or contains no usable entry in
 * production, the allowlist is empty and no cross-origin request is granted.
 * In development only, `http://localhost:5173` is assumed so the documented
 * two-terminal setup works without extra configuration.
 */
export function resolveCorsConfig(
  raw: string | undefined,
  isProduction: boolean,
): CorsConfig {
  const issues: string[] = [];
  const candidates = raw === undefined ? [] : splitOrigins(raw);

  if (raw === undefined || candidates.length === 0) {
    if (isProduction) {
      issues.push(
        `${CORS_ENV_VAR} is not set. Cross-origin API access is disabled in production.`,
      );
      return { allowedOrigins: [], issues, usingFallback: false };
    }

    issues.push(
      `${CORS_ENV_VAR} is not set. Falling back to the development origin ${DEV_FALLBACK_ORIGINS[0]}.`,
    );
    return { allowedOrigins: DEV_FALLBACK_ORIGINS, issues, usingFallback: true };
  }

  const allowed: string[] = [];
  for (const candidate of candidates) {
    if (!isValidOrigin(candidate)) {
      issues.push(`Ignored invalid origin "${candidate}". Use a full origin such as http://localhost:5173.`);
      continue;
    }
    const normalised = candidate.replace(/\/+$/, '').toLowerCase();
    if (!allowed.includes(normalised)) allowed.push(normalised);
  }

  if (allowed.length === 0) {
    issues.push(`${CORS_ENV_VAR} contained no valid origins. Cross-origin API access is disabled.`);
  }

  return { allowedOrigins: allowed, issues, usingFallback: false };
}

export function isOriginAllowed(origin: string | null, config: CorsConfig): boolean {
  if (origin === null) return false;
  return config.allowedOrigins.includes(origin.replace(/\/+$/, '').toLowerCase());
}

/** Reads the live CORS configuration from the server environment. */
export function loadCorsConfig(): CorsConfig {
  return resolveCorsConfig(process.env[CORS_ENV_VAR], process.env.NODE_ENV === 'production');
}
