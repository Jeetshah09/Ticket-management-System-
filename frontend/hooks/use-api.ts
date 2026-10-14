"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, toApiError } from "@/lib/api-error";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  /** Normalized API error (network/HTTP) or null. */
  error: ApiError | null;
}

/**
 * Minimal data-fetching hook: loading / error / retry semantics with
 * request de-duplication (StrictMode double-invoke safe) and cleanup
 * on unmount. Deliberately small — no cache layer needed here.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): UseApiState<T> & { reload: () => void } {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const inFlight = useRef<Promise<T> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const run =
      inFlight.current ??
      fetcherRef.current().finally(() => {
        inFlight.current = null;
      });
    inFlight.current = run;

    run
      .then((data) => {
        if (!cancelled && mounted.current) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && mounted.current) {
          setState({ data: null, loading: false, error: toApiError(error) });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { ...state, reload };
}
