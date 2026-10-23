import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Minimal data hook over the api/* layer.
 *
 * Returns the envelope split into `data` and `meta` so a screen can render the
 * values and the source tag from one call. `deps` behaves like an effect
 * dependency list; `refetch` re-runs without clearing what is on screen, which
 * keeps the tracker from flashing every time it refreshes.
 */
export function useApi(fn, deps = [], { enabled = true, keepPreviousData = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null });
  const mounted = useRef(true);
  const requestId = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!enabled) {
        setState({ data: null, meta: null, loading: false, error: null });
        return;
      }
      const id = ++requestId.current;
      setState((previous) => ({
        data: keepPreviousData ? previous.data : null,
        meta: keepPreviousData ? previous.meta : null,
        loading: !quiet,
        error: quiet ? previous.error : null,
      }));
      try {
        const result = await run();
        if (!mounted.current || id !== requestId.current) return;
        setState({ data: result?.data ?? null, meta: result?.meta ?? null, loading: false, error: null });
      } catch (error) {
        if (!mounted.current || id !== requestId.current) return;
        setState({ data: null, meta: null, loading: false, error });
      }
    },
    [run, enabled, keepPreviousData],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return useMemo(
    () => ({
      ...state,
      refetch: () => load(true),
      reload: () => load(false),
      setData: (updater) =>
        setState((previous) => ({
          ...previous,
          data: typeof updater === 'function' ? updater(previous.data) : updater,
        })),
    }),
    [state, load],
  );
}

/**
 * Imperative action hook, for submits and mutations.
 * Keeps the pending flag and the field errors an ApiError carries.
 */
export function useAction(fn, { onSuccess, onError } = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (...args) => {
      setPending(true);
      setError(null);
      try {
        const result = await fn(...args);
        onSuccess?.(result?.data ?? result, result?.meta);
        return result;
      } catch (caught) {
        setError(caught);
        onError?.(caught);
        return null;
      } finally {
        setPending(false);
      }
    },
    [fn, onSuccess, onError],
  );

  return {
    run,
    pending,
    error,
    fieldErrors: error?.fields ?? null,
    reset: () => setError(null),
  };
}

/** A ticking clock, for the UTC readout and the live countdowns. */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Debounce a fast-changing value, used by the search inputs. */
export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Per-viewer convenience storage. Falls back silently when blocked. */
export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Private window or blocked storage: the preference just does not stick. */
    }
  }, [key, value]);

  return [value, setValue];
}
