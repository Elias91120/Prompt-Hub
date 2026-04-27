import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Workflow,
  GitBranch,
  Layers,
  Search,
  FileText,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

interface Agent {
  key: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const AGENTS: Agent[] = [
  { key: 'plan', icon: Workflow },
  { key: 'substeps', icon: Layers },
  { key: 'chat', icon: MessageSquare },
  { key: 'prompt', icon: FileText },
  { key: 'analyse', icon: Search },
  { key: 'feedback', icon: CheckCircle2 },
  { key: 'recap', icon: GitBranch },
]

export default function AgentsShowcase() {
  const { t } = useTranslation('marketing')
  return (
    <section id="agents" className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow mb-3 justify-center">{t('agentsShowcase.eyebrow')}</span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('agentsShowcase.title')}
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            {t('agentsShowcase.subtitle')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent, idx) => {
            const Icon = agent.icon
            return (
              <motion.div
                key={agent.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="kpi-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t(`agentsShowcase.items.${agent.key}.name`)}
                    </h3>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      {t(`agentsShowcase.items.${agent.key}.role`)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {t(`agentsShowcase.items.${agent.key}.description`)}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
