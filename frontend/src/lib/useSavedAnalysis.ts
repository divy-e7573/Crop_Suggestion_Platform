import { useCallback, useEffect, useState } from 'react';

import { ApiRequestError } from './apiClient';
import { readAnalysisToken } from './analysisTokenStorage';
import { fetchSavedAnalysis, type SavedProfileAnalysisDto } from './farmProfileApi';

/**
 * The state behind the crop suggestions page.
 *
 * The page shows the analysis of the profile this browser saved, so the
 * hook owns the single request and the retry button. The result is only
 * shown when it belongs to the request that is current, and the loading state
 * is worked out during the render instead of being set from inside an effect.
 *
 * The access token lives in session storage, so no profile is read when the
 * browser has no token. That is what keeps one farmer's details away from
 * another visitor (Phase 9 privacy review).
 */

/** The result of the request, together with the key it was made for. */
type RequestState = {
  key: string;
  data: SavedProfileAnalysisDto | null;
  error: string | null;
};

/** What the page shows. */
export type SavedAnalysisView = {
  data: SavedProfileAnalysisDto | null;
  error: string | null;
  loading: boolean;
  /** True when this browser has no saved profile to show. */
  hasNoProfile: boolean;
  /** Runs the request again. */
  retry: () => void;
};

/** Turns a failed request into a message the farmer can act on. */
function messageFor(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return 'Something went wrong while loading the suggestions. Please try again.';
}

/**
 * True when the failure means "there is no profile for this token any more".
 *
 * The token can outlive its profile: the retention script removes profiles
 * older than the window, and the farmer may have cleared the browser data.
 * In that case the page should offer to save the profile again rather than
 * showing an error the farmer cannot act on.
 */
function isMissingProfile(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}

/** Reads a request result, ignoring one that belongs to an older request. */
function readRequest(state: RequestState, key: string) {
  if (state.key !== key) {
    return { data: null, error: null, loading: true };
  }
  return { data: state.data, error: state.error, loading: false };
}

/** Loads the analysis of the profile this browser saved. */
export function useSavedAnalysis(): SavedAnalysisView {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RequestState>({
    key: '',
    data: null,
    error: null,
  });

  const key = 'saved-' + attempt;

  useEffect(() => {
    let active = true;
    const token = readAnalysisToken();

    if (token === null) {
      setState({ key, data: null, error: null });
      return () => {
        active = false;
      };
    }

    fetchSavedAnalysis(token)
      .then((data) => {
        if (!active) return;
        setState({ key, data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          key,
          data: null,
          // A token that no longer matches a profile is an empty state, not
          // a failure, so the page asks for the profile again.
          error: isMissingProfile(error) ? null : messageFor(error),
        });
      });

    return () => {
      active = false;
    };
  }, [key]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const current = readRequest(state, key);
  const hasNoProfile =
    !current.loading && current.error === null && current.data === null;

  return { ...current, hasNoProfile, retry };
}
