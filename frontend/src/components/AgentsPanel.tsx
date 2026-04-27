import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentCharter, AgentKind } from '../types'
import { listAgents } from '../api'

const KIND_TONE: Record<AgentKind, string> = {
  planner: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  generator: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  analyser: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  router: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
  summariser: 'bg-slate-500/10 text-slate-300 ring-slate-500/30',
}

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Read-only panel that lists every Prompt-Hub agent and its declared
 * charter (role, inputs/outputs, hard limits). Squad-inspired: makes
 * orchestration legible — the user can see *who* is involved before
 * trusting the output.
 */
export default function AgentsPanel({ open, onClose }: Props) {
  const { t } = useTranslation('editor')
  const [agents, setAgents] = useState<AgentCharter[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    listAgents()
      .then((data) => {
        if (active) {
          setAgents(data)
          setError(null)
        }
      })
      .catch((e) => {
        if (active) setError(String(e))
      })
    return () => {
      active = false
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('agentsPanel.title')}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
              {t('agentsPanel.title')}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
              {t('agentsPanel.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('agentsPanel.close')}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
          {!agents && !error && (
            <p className="text-xs text-[var(--color-text-tertiary)]">{t('agentsPanel.loading')}</p>
          )}
          {agents && (
            <ul className="flex flex-col gap-3">
              {agents.map((a) => (
                <li
                  key={a.name}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 p-4"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <code className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {a.name}
                    </code>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${KIND_TONE[a.kind]}`}
                    >
                      {t(`agentsPanel.kinds.${a.kind}`)}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                      v{a.version}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">{a.role}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{a.purpose}</p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <CharterList title={t('agentsPanel.labels.inputs')} items={a.inputs} />
                    <CharterList title={t('agentsPanel.labels.outputs')} items={a.outputs} />
                    <CharterList
                      title={t('agentsPanel.labels.doesNot')}
                      items={a.does_not}
                      tone="text-red-300/90"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function CharterList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone?: string
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {title}
      </p>
      <ul className={`space-y-0.5 text-[11px] ${tone ?? 'text-[var(--color-text-secondary)]'}`}>
        {items.map((it, i) => (
          <li key={i} className="leading-snug">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
