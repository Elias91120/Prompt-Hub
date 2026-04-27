import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ArrowRight, FolderPlus } from 'lucide-react'

export default function CTASection({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation('marketing')
  return (
    <section className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="glass-card relative overflow-hidden p-10 text-center sm:p-14"
        >
          <div
            aria-hidden
            className="absolute inset-x-0 -top-20 mx-auto h-40 w-40 rounded-full bg-[var(--color-accent)]/30 blur-3xl"
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('cta.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-text-secondary)]">
              {t('cta.subtitle')}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={onCreate} className="btn-primary">
                <FolderPlus className="h-4 w-4" />
                {t('cta.primary')}
              </button>
              <a href="#features" className="btn-ghost">
                {t('cta.secondary')}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
