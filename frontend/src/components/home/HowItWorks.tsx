import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { PenLine, Wand2, MessagesSquare, Rocket } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

interface Step {
  key: string
  num: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const STEPS: Step[] = [
  { key: 'describe', num: '01', icon: PenLine },
  { key: 'structure', num: '02', icon: Wand2 },
  { key: 'refine', num: '03', icon: MessagesSquare },
  { key: 'execute', num: '04', icon: Rocket },
]

export default function HowItWorks() {
  const { t } = useTranslation('marketing')
  return (
    <section id="how-it-works" className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow mb-3 justify-center">{t('howItWorks.eyebrow')}</span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('howItWorks.title')}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="glass-card-hover relative p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="kpi-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs font-semibold text-[var(--color-text-tertiary)]">
                    {step.num}
                  </span>
                </div>
                <h3 className="mt-5 text-sm font-semibold text-[var(--color-text-primary)]">
                  {t(`howItWorks.steps.${step.key}.title`)}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {t(`howItWorks.steps.${step.key}.description`)}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
