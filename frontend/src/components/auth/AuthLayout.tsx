import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import PageBackground from '../layout/PageBackground'

interface Props {
  /** Title shown above the card. */
  title: string
  /** Subtitle / description below the title. */
  subtitle?: string
  /** Card body (form). */
  children: ReactNode
  /** Optional footer link row (e.g. "Already have an account?"). */
  footer?: ReactNode
}

/**
 * Minimal page chrome shared by every auth screen (login, signup,
 * password reset, callback). Keeps the brand visible and centers a
 * glass card on the existing background gradient.
 */
export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <PageBackground />

      <header className="relative z-10 px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Accueil">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#4ade80] to-[var(--color-accent-hover)] shadow-[var(--shadow-glow-sm)]">
            <Sparkles className="h-4 w-4 text-[#04140b]" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">Prompt Hub</span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-md">
          <div className="glass-card relative p-8 sm:p-10">
            <div className="mb-7 text-center">
              <span className="badge badge-success mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                100% gratuit pour l'instant
              </span>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              {subtitle && (
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {subtitle}
                </p>
              )}
            </div>

            {children}
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
