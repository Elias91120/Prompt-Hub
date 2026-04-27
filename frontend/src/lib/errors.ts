/**
 * Typed API errors. Centralised here so every component can pattern-match
 * on `instanceof` and render contextual recovery UI.
 *
 * Note: `LLMUnreachableError` historically lives in `api.ts` for backwards
 * compatibility with existing imports. We re-export it here.
 */
export { LLMUnreachableError } from '../api'

/** Generic network failure (fetch threw a TypeError before reaching the server). */
export class NetworkError extends Error {
  constructor(message = 'Network error') {
    super(message)
    this.name = 'NetworkError'
  }
}

/** HTTP 404 — resource not found. */
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

/** HTTP 4xx (other than 404) — client/validation error. */
export class ValidationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ValidationError'
    this.status = status
  }
}

/** HTTP 5xx — server-side failure (not LLM-specific). */
export class ServerError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'ServerError'
    this.status = status
  }
}

/**
 * Convert any thrown value into a short, user-friendly sentence suitable
 * for toast or banner display.
 *
 * The i18n version reads from the `errors` namespace. Falls back to the
 * raw message when nothing matches.
 */
import i18n from '../i18n'

export function friendlyMessage(err: unknown): string {
  const t = i18n.t.bind(i18n)
  if (err instanceof Error) {
    if (err.name === 'LLMUnreachableError') return t('errors:llmUnreachable')
    if (err instanceof NetworkError) return t('errors:network')
    if (err instanceof NotFoundError) return t('errors:notFound')
    if (err instanceof ValidationError) return err.message || t('errors:validation')
    if (err instanceof ServerError) return t('errors:server')
    return err.message
  }
  return String(err)
}
