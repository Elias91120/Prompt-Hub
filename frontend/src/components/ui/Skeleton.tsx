import type { CSSProperties } from 'react'

interface Props {
  /** Tailwind classes for sizing/shape. e.g. "h-4 w-32" or "h-32 w-full rounded-xl". */
  className?: string
  style?: CSSProperties
  /** Hint for screen readers; defaults to "Chargement". */
  label?: string
}

/**
 * Animated placeholder block. Uses a custom shimmer keyframe defined in
 * index.css. Always renders with `aria-busy="true"` for assistive tech.
 */
export default function Skeleton({ className = '', style, label = 'Chargement' }: Props) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`skeleton-shimmer rounded-md ${className}`}
      style={style}
    />
  )
}
