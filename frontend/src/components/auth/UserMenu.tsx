import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn, LogOut, UserPlus, UserRound } from 'lucide-react'
import { useAuth } from '../../lib/auth'

/**
 * Top-bar slot that switches between "Sign in / Sign up" links for
 * anonymous visitors and a small dropdown showing the user's email +
 * a logout action when authenticated.
 */
export default function UserMenu() {
  const { t } = useTranslation('auth')
  const { user, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (loading) {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)]"
        aria-hidden
      />
    )
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          state={{ from: location }}
          className="btn-ghost hidden sm:inline-flex"
        >
          <LogIn className="h-4 w-4" />
          <span>{t('topbar.signIn')}</span>
        </Link>
        <Link
          to="/signup"
          state={{ from: location }}
          className="btn-primary"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('topbar.signUp')}</span>
          <span className="sm:hidden">{t('topbar.signUpShort')}</span>
        </Link>
      </div>
    )
  }

  const email = user.email ?? ''
  const initial = (email[0] ?? '?').toUpperCase()

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] pl-1 pr-3 text-xs font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#4ade80] to-[var(--color-accent-hover)] text-[11px] font-bold text-[#04140b]"
          aria-hidden
        >
          {initial}
        </span>
        <span className="hidden max-w-[160px] truncate text-[var(--color-text-secondary)] sm:inline">
          {email}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-card-hover)]"
        >
          <div className="border-b border-[var(--color-border)] px-3.5 py-3">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <UserRound className="h-3.5 w-3.5" />
              {t('topbar.signedInAs')}
            </div>
            <div className="mt-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
              {email}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            role="menuitem"
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          >
            <LogOut className="h-4 w-4" />
            {t('topbar.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
