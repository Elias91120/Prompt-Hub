import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation('marketing')
  return (
    <footer className="relative border-t border-[var(--color-border)] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-[var(--color-text-tertiary)] sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#4ade80] to-[var(--color-accent-hover)]">
            <Sparkles className="h-3 w-3 text-[#04140b]" />
          </span>
          <span className="font-semibold text-[var(--color-text-secondary)]">
            Prompt Hub
          </span>
          <span>·</span>
          <span>{t('footer.tagline')}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="hover:text-[var(--color-text-primary)]">
            {t('footer.links.features')}
          </a>
          <a href="#how-it-works" className="hover:text-[var(--color-text-primary)]">
            {t('footer.links.howItWorks')}
          </a>
          <a href="#agents" className="hover:text-[var(--color-text-primary)]">
            {t('footer.links.agents')}
          </a>
          <a href="#projects" className="hover:text-[var(--color-text-primary)]">
            {t('footer.links.projects')}
          </a>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-[var(--color-text-secondary)] sm:items-end">
          <div className="flex items-center gap-2">
            <span>Développé avec passion par</span>
            <a
              href="https://web-gen-lyart.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-webgen flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold tracking-wide transition-all"
            >
              Webgen
            </a>
          </div>
          <span className="text-[10px] text-[var(--color-text-tertiary)]">© {new Date().getFullYear()} Prompt Hub. Tous droits réservés.</span>
        </div>
      </div>
    </footer>
  )
}
