import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import i18n from '../i18n'

const STORAGE_KEY = 'promptHub.langGateDone'

/**
 * One-time fullscreen language picker (mobile-first), shown before the app
 * until the user picks FR / EN or skips. Copy is bilingual so it stays
 * understandable regardless of detector language.
 */
export default function LanguageFirstVisitGate() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch {
      setOpen(false)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore quota / private mode */
    }
    setOpen(false)
  }

  function choose(lang: 'fr' | 'en') {
    void i18n.changeLanguage(lang)
    dismiss()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--color-surface)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-gate-title"
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute left-1/2 top-[18%] h-[min(420px,55vw)] w-[min(420px,90vw)] -translate-x-1/2 rounded-full bg-[var(--color-accent)]/[0.07] blur-3xl" />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4ade80] to-[var(--color-accent-hover)] shadow-[var(--shadow-glow-sm)]">
            <Sparkles className="h-6 w-6 text-[#04140b]" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
            Prompt Hub
          </span>
        </div>

        <p
          id="lang-gate-title"
          className="mb-8 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]"
        >
          Select language · Choisir la langue
        </p>

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => choose('fr')}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-5 py-4 text-left transition-colors hover:border-[var(--color-accent)]/35 hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <span className="text-base font-bold text-[var(--color-text-primary)]">FR</span>
            <span className="text-sm text-[var(--color-text-secondary)]">Français</span>
          </button>
          <button
            type="button"
            onClick={() => choose('en')}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-5 py-4 text-left transition-colors hover:border-[var(--color-accent)]/35 hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <span className="text-base font-bold text-[var(--color-text-primary)]">EN</span>
            <span className="text-sm text-[var(--color-text-secondary)]">English</span>
          </button>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-8 text-sm font-medium text-[var(--color-text-tertiary)] underline-offset-4 transition-colors hover:text-[var(--color-text-secondary)] hover:underline"
        >
          Passer · Skip
        </button>
      </div>
    </div>
  )
}
