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
  /** If true this card spans 2 columns on desktop (bento large) */
  large?: boolean
  /** Short tag shown in the card corner */
  tag?: string
}

const FEATURES: Feature[] = [
  { key: 'plan', icon: Workflow, tone: 'green', large: true, tag: 'Core' },
  { key: 'prompts', icon: FileCode, tone: 'sky', tag: 'Éditeur' },
  { key: 'chat', icon: MessageSquare, tone: 'teal', tag: 'Chat' },
  { key: 'substeps', icon: Layers, tone: 'indigo', large: true, tag: 'IA' },
  { key: 'graph', icon: Network, tone: 'amber', tag: 'Visuel' },
  { key: 'analyse', icon: ScanSearch, tone: 'rose', tag: 'Analyse' },
  { key: 'history', icon: History, tone: 'green', tag: 'Log' },
  { key: 'skills', icon: Sparkles, tone: 'sky', tag: 'Skills' },
]

const TONE_STYLES: Record<Tone, {
  icon: string;
  glow: string;
  tag: string;
  border: string;
}> = {
  green: {
    icon: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    glow: '0 0 40px -10px rgba(62,207,142,0.3)',
    tag: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10',
    border: 'rgba(62,207,142,0.25)',
  },
  sky: {
    icon: 'bg-sky-500/10 text-sky-300',
    glow: '0 0 40px -10px rgba(14,165,233,0.3)',
    tag: 'text-sky-300 bg-sky-500/10',
    border: 'rgba(14,165,233,0.25)',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-300',
    glow: '0 0 40px -10px rgba(245,158,11,0.3)',
    tag: 'text-amber-300 bg-amber-500/10',
    border: 'rgba(245,158,11,0.25)',
  },
  rose: {
    icon: 'bg-rose-500/10 text-rose-300',
    glow: '0 0 40px -10px rgba(244,63,94,0.3)',
    tag: 'text-rose-300 bg-rose-500/10',
    border: 'rgba(244,63,94,0.25)',
  },
  indigo: {
    icon: 'bg-indigo-500/10 text-indigo-300',
    glow: '0 0 40px -10px rgba(99,102,241,0.3)',
    tag: 'text-indigo-300 bg-indigo-500/10',
    border: 'rgba(99,102,241,0.25)',
  },
  teal: {
    icon: 'bg-teal-500/10 text-teal-300',
    glow: '0 0 40px -10px rgba(20,184,166,0.3)',
    tag: 'text-teal-300 bg-teal-500/10',
    border: 'rgba(20,184,166,0.25)',
  },
}

export default function Features() {
  const { t } = useTranslation('marketing')
  return (
    <section id="features" className="relative px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="eyebrow mb-4 justify-center">{t('features.eyebrow')}</span>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('features.title')}
          </h2>
          <p className="mt-4 text-[var(--color-text-secondary)] leading-relaxed">
            {t('features.subtitle')}
          </p>
        </div>

        {/* Bento grid — asymmetric layout */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 auto-rows-fr">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon
            const title = t(`features.items.${feature.key}.title`)
            const description = t(`features.items.${feature.key}.description`)
            const styles = TONE_STYLES[feature.tone]

            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: idx * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`bento-card group relative flex flex-col p-6 overflow-hidden ${
                  feature.large ? 'lg:col-span-2' : ''
                }`}
                style={{
                  '--hover-glow': styles.glow,
                } as React.CSSProperties}
              >
                {/* Hover glow overlay */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[1.25rem] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ boxShadow: `inset 0 0 60px -20px ${styles.border}` }}
                />

                {/* Top row: icon + tag */}
                <div className="flex items-start justify-between mb-auto">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${styles.icon} transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  {feature.tag && (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${styles.tag}`}>
                      {feature.tag}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="mt-5">
                  <h3 className="font-display text-sm font-bold text-[var(--color-text-primary)] tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    {description}
                  </p>
                </div>

                {/* Bottom decorative line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, transparent, ${styles.border}, transparent)` }}
                />
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
