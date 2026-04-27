import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" styles the confirm button red. */
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Accessible confirmation dialog. Replaces native `window.confirm()`.
 * Traps focus minimally (auto-focuses confirm), closes on Esc, blocks
 * background scroll while open.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      } else if (e.key === 'Tab') {
        // 2-element focus trap
        const a = confirmRef.current
        const b = cancelRef.current
        if (!a || !b) return
        if (document.activeElement === a && e.shiftKey) {
          e.preventDefault()
          b.focus()
        } else if (document.activeElement === b && !e.shiftKey) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onCancel])

  if (!open || typeof document === 'undefined') return null

  const confirmCls =
    variant === 'danger'
      ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-300'
      : 'btn-primary'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[1100] flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md surface-card p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          {variant === 'danger' && (
            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-rose-400" aria-hidden />
          )}
          <div className="flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            {message && (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="icon-btn -mr-2 -mt-2"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={confirmCls}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
