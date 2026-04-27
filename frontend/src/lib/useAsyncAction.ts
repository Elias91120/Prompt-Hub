import { useCallback, useRef, useState } from 'react'

/**
 * Hook to wrap an async function with loading / error / cancellation state.
 *
 * Example:
 * ```tsx
 * const { run, loading, error, reset } = useAsyncAction(generatePlan)
 * <button disabled={loading} onClick={() => run(projectId)}>Generate</button>
 * ```
 *
 * The hook ignores stale results when the same handler is invoked again
 * before the previous call resolved (last-write-wins).
 */
export function useAsyncAction<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [data, setData] = useState<Result | null>(null)
  const callIdRef = useRef(0)

  const run = useCallback(
    async (...args: Args): Promise<Result | null> => {
      const myCall = ++callIdRef.current
      setLoading(true)
      setError(null)
      try {
        const result = await fn(...args)
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
    },
    [fn],
  )

  const reset = useCallback(() => {
    callIdRef.current++
    setLoading(false)
    setError(null)
    setData(null)
  }, [])

  return { run, loading, error, data, reset }
}
