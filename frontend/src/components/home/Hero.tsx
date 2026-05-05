import { motion } from 'framer-motion'
import { ArrowRight, FolderPlus, Sparkles, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  isAuthed: boolean
  onCreate: () => void
  onScrollToProjects: () => void
}

export default function Hero({ isAuthed, onCreate, onScrollToProjects }: Props) {
  const { t } = useTranslation('home')
  return (
    <section
      id="top"
      className="relative overflow-hidden px-6 pt-16 pb-20 sm:pt-24 sm:pb-28"
    >
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center"
        >
          <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <span className="eyebrow">
              <Sparkles className="h-3 w-3" />
              {t('hero.eyebrow')}
            </span>
            <span className="hidden h-4 w-px bg-[var(--color-border)] sm:block" />
            <a href="https://web-gen-lyart.vercel.app" target="_blank" rel="noopener noreferrer" className="btn-webgen flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all">
              Développé par Webgen
            </a>
          </div>

          <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            {t('hero.title1')}{' '}
            <span className="gradient-text">{t('hero.titleHighlight')}</span>
            <br className="hidden sm:block" /> {t('hero.title2')}
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
            {t('hero.subtitle')}
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <button onClick={onCreate} className="btn-primary">
              {isAuthed ? (
                <>
                  <FolderPlus className="h-4 w-4" />
                  {t('hero.ctaPrimaryAuthed')}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {t('hero.ctaPrimaryAnon')}
                </>
              )}
            </button>
            <button onClick={onScrollToProjects} className="btn-secondary">
              {t('hero.ctaSecondary')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <span className="badge badge-success">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              {t('hero.badges.free')}
            </span>
            <span className="badge badge-neutral">{t('hero.badges.vllm')}</span>
            <span className="badge badge-neutral">{t('hero.badges.agents')}</span>
            <span className="badge badge-neutral">{t('hero.badges.local')}</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
