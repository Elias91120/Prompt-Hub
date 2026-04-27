import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Workflow,
  MessageSquare,
  FileCode,
  Network,
  Sparkles,
  History,
  Layers,
  ScanSearch,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type Tone = 'green' | 'sky' | 'amber' | 'rose' | 'indigo' | 'teal'

interface Feature {
  key: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: Tone
}

const FEATURES: Feature[] = [
  { key: 'plan', icon: Workflow, tone: 'green' },
  { key: 'prompts', icon: FileCode, tone: 'sky' },
  { key: 'chat', icon: MessageSquare, tone: 'teal' },
  { key: 'substeps', icon: Layers, tone: 'indigo' },
  { key: 'graph', icon: Network, tone: 'amber' },
  { key: 'analyse', icon: ScanSearch, tone: 'rose' },
  { key: 'history', icon: History, tone: 'green' },
  { key: 'skills', icon: Sparkles, tone: 'sky' },
]

const TONE_STYLES: Record<Tone, string> = {
  green: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] ring-[var(--color-accent)]/20',
  sky: 'bg-sky-500/10 text-sky-300 ring-sky-500/20',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-300 ring-rose-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/20',
  teal: 'bg-teal-500/10 text-teal-300 ring-teal-500/20',
}

export default function Features() {
  const { t } = useTranslation('marketing')
  return (
    <section id="features" className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow mb-3 justify-center">{t('features.eyebrow')}</span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('features.title')}
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon
            const title = t(`features.items.${feature.key}.title`)
            const description = t(`features.items.${feature.key}.description`)
            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="glass-card-hover p-5"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${TONE_STYLES[feature.tone]}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">
                  {title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
