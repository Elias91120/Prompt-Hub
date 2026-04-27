import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { SUPPORTED_LANGS, type Lang } from '../../i18n'

/**
 * Compact dropdown to switch UI language. The user's choice is persisted
 * to `localStorage` automatically by i18next-browser-languagedetector.
 *
 * Designed to live in the top-bar of `AppShell`. Falls back gracefully if
 * the current language isn't in `SUPPORTED_LANGS`.
 */
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (SUPPORTED_LANGS as readonly string[]).includes(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as Lang)
    : 'fr'

  return (
    <label className="relative flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
      <Globe className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{t('language')}</span>
      <select
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/40 focus-visible:outline-none"
        aria-label={t('language')}
      >
        {SUPPORTED_LANGS.map((l) => (
          <option key={l} value={l}>
            {t(`languages.${l}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
