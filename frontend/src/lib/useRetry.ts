import { useCallback, useRef, useState } from 'react'

/**
 * Hook for fetch-on-mount data loading with explicit `retry()`.
 *
 * Pass a memoised `loader` (use `useCallback`) — the hook does NOT auto-run;
 * you trigger the first load yourself via `retry()` inside a `useEffect`.
 * This keeps the surface symmetric: the same call refreshes data later.
 *
 * Example:
 * ```ts
 * const loader = useCallback(() => listProjects(), [])
 * const { data, loading, error, retry } = useRetry(loader)
 * useEffect(() => { retry() }, [retry])
 * ```
 */
export function useRetry<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const callIdRef = useRef(0)

  const retry = useCallback(async (): Promise<T | null> => {
    const myCall = ++callIdRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await loader()
      if (callIdRef.current === myCall) {
        setData(result)
        setLoading(false)
      }
      return result
    } catch (err) {
      if (callIdRef.current === myCall) {
        setError(err)
        setLoading(false)
      }
      return null
    }
  }, [loader])

  return { data, loading, error, retry, setData }
}
