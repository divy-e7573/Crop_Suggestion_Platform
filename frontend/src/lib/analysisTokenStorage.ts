/**
 * Where the browser keeps the access token for the saved farm profile.
 *
 * The token is what allows the app to read a saved profile back. It is kept
 * in **session storage**, which has two useful properties for this case:
 *
 * - it belongs to one browser tab, so it is never shared with another person
 *   using the same machine, and
 * - it disappears when the tab is closed, so the token does not linger on a
 *   shared computer.
 *
 * The token is a capability for reading the profile that this browser just
 * created. It is not an account, it grants no other access, and the server
 * stores only its hash.
 *
 * If session storage is unavailable (a private window with storage blocked,
 * for example), the app simply has no token and the crop suggestions page
 * explains that the profile has to be saved again.
 */

/** The session storage key. */
export const ANALYSIS_TOKEN_STORAGE_KEY = 'krishi-mandi.analysis-token';

/** Reads the stored token, or null when there is none. */
export function readAnalysisToken(): string | null {
  try {
    const value = window.sessionStorage.getItem(ANALYSIS_TOKEN_STORAGE_KEY);
    return value === null || value === '' ? null : value;
  } catch {
    // Storage can be unavailable, for example in a locked-down browser.
    return null;
  }
}

/** Stores the token for this tab. */
export function writeAnalysisToken(token: string): void {
  try {
    window.sessionStorage.setItem(ANALYSIS_TOKEN_STORAGE_KEY, token);
  } catch {
    // The app still works for this page view; only the reload does not.
  }
}

/** Removes the stored token, for example when the farmer starts again. */
export function clearAnalysisToken(): void {
  try {
    window.sessionStorage.removeItem(ANALYSIS_TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to do when storage is unavailable.
  }
}
