/* eslint-disable react-refresh/only-export-components */
/**
 * Tiny home-grown toast system. Uses a React context + a portal to
 * `document.body`. No external deps.
 *
 * Usage:
 * ```tsx
 * const toast = useToast()
 * toast.success('Projet créé')
 * toast.error('Échec', { action: { label: 'Réessayer', onClick: retry } })
 * ```
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, Info, X, Undo2 } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastInput {
  message: string
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. Set to 0 to keep visible until manually closed. */
  duration?: number
  action?: ToastAction
}

interface ToastEntry extends ToastInput {
  id: number
}

interface ToastApi {
  show: (input: ToastInput) => number
  success: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => number
  error: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => number
  info: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current
      const entry: ToastEntry = { ...input, id }
      setToasts((prev) => [...prev, entry])
      const duration = input.duration ?? (input.action ? 8000 : 4000)
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timersRef.current.set(id, timer)
      }
      return id
    },
    [dismiss],
  )

  const api: ToastApi = useMemo(
    () => ({
      show,
      success: (message, opts) => show({ ...opts, message, variant: 'success' }),
      error: (message, opts) => show({ ...opts, message, variant: 'error' }),
      info: (message, opts) => show({ ...opts, message, variant: 'info' }),
      dismiss,
    }),
    [show, dismiss],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-emerald-500/40 text-emerald-100' },
  error: { icon: AlertTriangle, cls: 'border-rose-500/40 text-rose-100' },
  info: { icon: Info, cls: 'border-sky-500/40 text-sky-100' },
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[]
  onDismiss: (id: number) => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[1000] flex w-full max-w-sm flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const variant = t.variant ?? 'info'
        const { icon: Icon, cls } = VARIANT_STYLES[variant]
        return (
          <div
            key={t.id}
            role={variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--color-surface-raised)]/95 px-4 py-3 shadow-xl backdrop-blur-md ${cls} animate-toast-in`}
          >
            <Icon size={18} className="mt-0.5 flex-shrink-0" aria-hidden />
            <div className="flex-1 text-sm leading-snug">{t.message}</div>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  onDismiss(t.id)
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-white/5"
              >
                <Undo2 size={12} aria-hidden />
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="rounded-md p-1 text-[var(--color-text-tertiary)] hover:bg-white/5 hover:text-[var(--color-text-primary)]"
              aria-label="Fermer la notification"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
