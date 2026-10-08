import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  deps: any[] = []
): UseAsyncReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction();
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    execute();
  }, [execute]);

  return {
    data,
    loading,
    error,
    reload: execute
  };
}
