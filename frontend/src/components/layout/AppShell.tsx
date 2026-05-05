import type { ReactNode } from 'react'
import { Sparkles, ArrowLeft } from 'lucide-react'
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

      {/* Beta Banner */}
      <div className="bg-gradient-to-r from-[var(--color-surface)] via-[#15803d] to-[var(--color-surface)] px-4 py-2 text-center text-xs font-medium tracking-wide text-white shadow-md sm:text-sm">
        <span className="mr-2 inline-block rounded-md bg-white/20 px-2 py-0.5 uppercase">Beta</span>
        100% gratuit pour l'instant — créez un compte pour générer votre premier plan.
        <span className="ml-2 hidden sm:inline text-white/70">
          • Développé avec passion par <strong className="text-white">Webgen</strong>
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
              <Link to="/" className="flex items-center gap-2.5" aria-label={t('actions.home')}>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#4ade80] to-[var(--color-accent-hover)] shadow-[var(--shadow-glow-sm)]">
                  <Sparkles className="h-4 w-4 text-[#04140b]" aria-hidden />
                </span>
                <span className="text-sm font-semibold tracking-tight">
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
