import { useCallback, useEffect, useState } from 'react';

import { ApiRequestError } from './apiClient';
import {
  fetchLatestAnalysis,
  type LatestProfileAnalysisDto,
} from './farmProfileApi';

/**
 * The state behind the crop suggestions page.
 *
 * The page shows the analysis of the profile that was saved most recently,
 * so the hook owns the single request and the retry button. The result is
 * only shown when it belongs to the request that is current, and the loading
 * state is worked out during the render instead of being set from inside an
 * effect.
 */

/** The result of the request, together with the key it was made for. */
type RequestState = {
  key: string;
  data: LatestProfileAnalysisDto | null;
  error: string | null;
};

/** What the page shows. */
export type LatestAnalysisView = {
  data: LatestProfileAnalysisDto | null;
  error: string | null;
  loading: boolean;
  /** Runs the request again. */
  retry: () => void;
};

/** Turns a failed request into a message the farmer can act on. */
function messageFor(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return 'Something went wrong while loading the suggestions. Please try again.';
}

/** Reads a request result, ignoring one that belongs to an older request. */
function readRequest(state: RequestState, key: string) {
  if (state.key !== key) {
    return { data: null, error: null, loading: true };
  }
  return { data: state.data, error: state.error, loading: false };
}

/** Loads the analysis of the most recently saved profile. */
export function useLatestAnalysis(): LatestAnalysisView {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RequestState>({
    key: '',
    data: null,
    error: null,
  });

  const key = 'latest-' + attempt;

  useEffect(() => {
    let active = true;

    fetchLatestAnalysis()
      .then((data) => {
        if (!active) return;
        setState({ key, data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({ key, data: null, error: messageFor(error) });
      });

    return () => {
      active = false;
    };
  }, [key]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  return { ...readRequest(state, key), retry };
}
