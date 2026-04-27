import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  /** Secondary action shown below the primary (e.g. link). */
  secondary?: ReactNode
  className?: string
}

/**
 * Generic empty-state placeholder. Use everywhere a list / panel has no
 * data yet. Pair with an inline CTA action whenever possible.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  className = '',
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]/40 px-6 py-10 text-center ${className}`}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-glow)] text-[var(--color-accent)]">
          <Icon size={22} aria-hidden />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {description && (
          <p className="mx-auto max-w-md text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
      {secondary && <div className="text-xs text-[var(--color-text-tertiary)]">{secondary}</div>}
    </div>
  )
}
