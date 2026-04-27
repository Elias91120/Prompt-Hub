import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  /** Visible text. */
  label: string
  /** If set, render as a link. If undefined, render as the current page. */
  to?: string
}

interface Props {
  items: Crumb[]
  className?: string
}

/**
 * Accessible breadcrumb navigation. Renders the last item without a link
 * and adds `aria-current="page"`.
 */
export default function Breadcrumbs({ items, className = '' }: Props) {
  return (
    <nav aria-label="Fil d'Ariane" className={className}>
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <Fragment key={`${item.label}-${idx}`}>
              <li className="flex items-center">
                {item.to && !isLast ? (
                  <Link
                    to={item.to}
                    className="rounded-md px-1.5 py-0.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="px-1.5 py-0.5 font-medium text-[var(--color-text-primary)]"
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden className="text-[var(--color-text-tertiary)]">
                  <ChevronRight size={14} />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
