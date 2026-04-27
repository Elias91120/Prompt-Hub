import { useId, useState, type ReactNode } from 'react'

interface Props {
  label: string
  children: ReactNode
  /** Where to place the tooltip relative to the trigger. */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Lightweight CSS-positioned tooltip. Visible on hover and on keyboard
 * focus of the wrapped element. Suitable for icon-only buttons that
 * already carry an aria-label.
 *
 * Usage:
 * ```tsx
 * <Tooltip label="Régénérer le plan">
 *   <button aria-label="Régénérer le plan" className="icon-btn">
 *     <RefreshCw size={16} />
 *   </button>
 * </Tooltip>
 * ```
 */
export default function Tooltip({ label, children, side = 'top' }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()

  const positionCls = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side]

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 text-xs font-medium text-[var(--color-text-primary)] shadow-lg ${positionCls}`}
        >
          {label}
        </span>
      )}
    </span>
  )
}
