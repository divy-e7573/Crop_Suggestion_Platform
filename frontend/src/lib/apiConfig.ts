/**
 * Runtime configuration for reaching the Next.js backend.
 *
 * The value is injected at build time from VITE_API_BASE_URL (see `.env.example`).
 * Everything in this module is bundled for the browser, so no database URL,
 * provider key, or other secret may ever be referenced here.
 */

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function normaliseBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = normaliseBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
);

/** Builds an absolute backend URL from a path such as `/api/health`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
