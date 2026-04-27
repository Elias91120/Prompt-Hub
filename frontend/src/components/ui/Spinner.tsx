import { Loader2 } from 'lucide-react'

interface Props {
  /** Pixel size of the spinning icon. */
  size?: number
  /** Optional contextual label — also serves as accessible name. */
  label?: string
  /** Render label inline next to the spinner. */
  inline?: boolean
  className?: string
}

/**
 * Loading spinner with optional contextual label. Always exposes the label
 * to assistive tech via `aria-label`, even when visually hidden.
 */
export default function Spinner({ size = 18, label, inline = true, className = '' }: Props) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Chargement'}
      className={`inline-flex items-center gap-2 text-[var(--color-text-secondary)] ${className}`}
    >
      <Loader2 size={size} className="animate-spin" aria-hidden />
      {label && inline && <span className="text-sm">{label}</span>}
    </span>
  )
}
