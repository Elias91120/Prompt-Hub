import type { ReactNode } from 'react'
import { Sparkles, ArrowLeft, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageBackground from './PageBackground'
import LanguageSwitcher from './LanguageSwitcher'
import UserMenu from '../auth/UserMenu'
import { Breadcrumbs, type Crumb } from '../ui'

interface AppShellProps {
  children: ReactNode
  /** Optional left-side content in the top-bar (e.g. project title). */
  leftSlot?: ReactNode
  /** Optional right-side content (action buttons). */
  rightSlot?: ReactNode
  /** Hide the brand logo + show a back arrow that calls this handler. */
  onBack?: () => void
  /** Title shown next to the back arrow when `onBack` is set. */
  backLabel?: string
  /** When true, top-bar uses a glass blur over content (for landing). */
  transparentTopBar?: boolean
  /** Optional breadcrumb trail rendered as a secondary bar under the top-bar. */
  breadcrumbs?: Crumb[]
}

export default function AppShell({
  children,
  leftSlot,
  rightSlot,
  onBack,
  backLabel,
  transparentTopBar = false,
  breadcrumbs,
}: AppShellProps) {
  const { t } = useTranslation()
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Skip link for keyboard users — visible on focus only. */}
      <a href="#main-content" className="skip-link">
        {t('actions.skipToContent')}
      </a>
      <PageBackground />

      {/* Beta Banner — animated gradient strip */}
      <div className="relative overflow-hidden px-4 py-2.5 text-center text-xs font-semibold tracking-wide text-white/90 sm:text-sm" style={{background: 'linear-gradient(90deg, #070808 0%, #0a2818 20%, #15803d 50%, #083344 80%, #070808 100%)'}}>
        {/* Animated shimmer bar */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent" style={{animation: 'gradient-x 3s ease-in-out infinite', backgroundSize: '200% 100%'}} />
        </div>
        <span className="relative inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            <Zap className="h-2.5 w-2.5" /> Beta
          </span>
          100% gratuit — créez un compte pour générer votre premier plan.
          <span className="hidden sm:inline text-white/60">
            · Par <strong className="text-[var(--color-accent)]">Webgen</strong>
          </span>
        </span>
      </div>

      <header
        className={
          transparentTopBar
            ? 'sticky top-0 z-30 border-b border-transparent backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--color-surface)]/60'
            : 'sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl'
        }
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {onBack ? (
              <button
                onClick={onBack}
                className="btn-ghost -ml-2"
                aria-label={backLabel ?? t('actions.back')}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                <span>{backLabel ?? t('actions.back')}</span>
              </button>
            ) : (
              <Link to="/" className="group flex items-center gap-2.5" aria-label={t('actions.home')}>
                <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#4ade80] to-[var(--color-accent-hover)] shadow-[var(--shadow-glow-sm)] transition-all duration-300 group-hover:shadow-[var(--shadow-glow)]">
                  <Sparkles className="h-4 w-4 text-[#04140b] transition-transform duration-700 group-hover:rotate-[30deg]" aria-hidden />
                  {/* Subtle ring on hover */}
                  <span className="absolute inset-0 rounded-xl ring-0 ring-[var(--color-accent)] transition-all duration-300 group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-offset-[var(--color-surface)]" />
                </span>
                <span className="font-display text-sm font-semibold tracking-tight transition-colors group-hover:text-[var(--color-accent)]">
                  {t('appName')}
                </span>
              </Link>
            )}
            {leftSlot && <div className="min-w-0 truncate">{leftSlot}</div>}
          </div>

          <div className="flex items-center gap-2">
            {rightSlot}
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/40">
            <div className="mx-auto flex h-9 max-w-6xl items-center px-4 sm:px-6">
              <Breadcrumbs items={breadcrumbs} />
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="relative flex-1">
        {children}
      </main>
    </div>
  )
}
