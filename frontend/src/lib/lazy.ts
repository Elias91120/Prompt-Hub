import { lazy, type ComponentType } from 'react'

/**
 * Wraps a dynamic import with a reload-on-fail policy.
 * 
 * In a deployed Single Page App (SPA), a new deployment usually invalidates
 * previous asset hashes. If a user has an old version of index.html open and
 * tries to navigate to a route that requires a new chunk, the browser will
 * fail to fetch the old chunk (404 or MIME type error).
 * 
 * This utility catches those errors and triggers a window.location.reload(),
 * which fetches the latest index.html and resolves the new asset hashes.
 */
export function lazyRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFn()
    } catch (error) {
      // Detect fetch errors (network down or chunk missing)
      console.error('Dynamic import failed:', error)
      
      // We only reload once to avoid infinite loops if the error is persistent
      const hasReloaded = sessionStorage.getItem('last-chunk-reload')
      const now = Date.now()
      
      if (!hasReloaded || now - parseInt(hasReloaded) > 10000) {
        sessionStorage.setItem('last-chunk-reload', now.toString())
        window.location.reload()
      }
      
      // Return a dummy component while the page reloads
      return { default: (() => null) as unknown as T }
    }
  })
}
