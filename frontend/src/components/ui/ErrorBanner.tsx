import { AlertTriangle, RotateCcw, X } from 'lucide-react'
import { friendlyMessage } from '../../lib/errors'

interface Props {
  error: unknown
  /** Show a Retry button that calls this handler. */
  onRetry?: () => void
  /** Show a dismiss (×) button. */
  onDismiss?: () => void
  /** Optional title above the message. */
  title?: string
  /** Extra hint shown under the message. */
  hint?: string
  className?: string
}

/**
 * Inline error banner with optional retry / dismiss actions.
 * Renders the error via `friendlyMessage()` for a concise French sentence.
 */
export default function ErrorBanner({
  error,
  onRetry,
  onDismiss,
  title,
  hint,
  className = '',
}: Props) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 ${className}`}
    >
      <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-rose-300" aria-hidden />
      <div className="flex-1 text-sm">
        {title && <div className="mb-1 font-semibold text-rose-100">{title}</div>}
        <div className="text-rose-100/90">{friendlyMessage(error)}</div>
        {hint && <div className="mt-1 text-xs text-rose-200/60">{hint}</div>}
      </div>
      <div className="flex items-center gap-1">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
          >
            <RotateCcw size={12} aria-hidden />
            Réessayer
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Masquer l'erreur"
            className="rounded-md p-1 text-rose-200/70 hover:bg-rose-500/10 hover:text-rose-100"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
