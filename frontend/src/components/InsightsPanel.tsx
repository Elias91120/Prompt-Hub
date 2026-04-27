import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  IssueSeverity,
  NextStepRecommendation,
  PlanConsistencyReport,
  Project,
  Step,
} from '../types'
import { analysePlanConsistency, recommendNextStep } from '../api'

interface Props {
  project: Project
  onClose: () => void
  /** Centre / select a step in the graph when the user clicks on a name. */
  onJumpToStep?: (step: Step) => void
}

const SEVERITY_TONE: Record<IssueSeverity, { tone: string; bg: string; ring: string }> = {
  info: {
    tone: 'text-sky-400',
    bg: 'bg-sky-500/10',
    ring: 'ring-sky-500/20',
  },
  warning: {
    tone: 'text-amber-400',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/20',
  },
  critical: {
    tone: 'text-red-400',
    bg: 'bg-red-500/10',
    ring: 'ring-red-500/20',
  },
}

const PRIORITY_TONE: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-sky-400',
}

function findStepByName(project: Project, name: string): Step | null {
  for (const ph of project.phases) {
    for (const s of ph.steps) {
      if (s.name === name) return s
      for (const sub of s.sub_steps) if (sub.name === name) return sub
    }
  }
  return null
}

export default function InsightsPanel({ project, onClose, onJumpToStep }: Props) {
  const { t } = useTranslation('plan')
  const [consistency, setConsistency] = useState<PlanConsistencyReport | null>(null)
  const [nextStep, setNextStep] = useState<NextStepRecommendation | null>(null)
  const [loading, setLoading] = useState<'consistency' | 'next' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runConsistency() {
    setLoading('consistency')
    setError(null)
    try {
      setConsistency(await analysePlanConsistency(project.id))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(null)
    }
  }

  async function runNextStep() {
    setLoading('next')
    setError(null)
    try {
      setNextStep(await recommendNextStep(project.id))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(null)
    }
  }

  function handleJump(name: string) {
    const s = findStepByName(project, name)
    if (s && onJumpToStep) onJumpToStep(s)
  }

  return (
    <aside
      role="complementary"
      aria-label="Insights"
      className="fixed inset-0 z-40 flex shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] lg:static lg:z-auto lg:w-[460px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
              Insights
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Advisory · never auto-edits
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t('drawers.closeInsights')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M12 4L4 12M4 4L12 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Plan consistency */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Plan consistency
            </h4>
            <button
              onClick={runConsistency}
              disabled={loading === 'consistency'}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {loading === 'consistency' ? 'Analysing…' : consistency ? 'Re-run' : 'Analyse'}
            </button>
          </div>
          {!consistency && loading !== 'consistency' && (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Audit your plan for gaps, duplicates and ordering issues. Read-only.
            </p>
          )}
          {consistency && (
            <>
              <p className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                {consistency.overall_assessment}
              </p>
              {consistency.issues.length === 0 ? (
                <p className="text-[11px] text-emerald-400">No issues found.</p>
              ) : (
                <ul className="space-y-2">
                  {consistency.issues.map((iss, idx) => {
                    const s = SEVERITY_TONE[iss.severity]
                    return (
                      <li
                        key={idx}
                        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ring-1 ${s.ring}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.bg} ${s.tone}`}
                          >
                            {iss.severity}
                          </span>
                          <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            {iss.kind.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] font-semibold text-[var(--color-text-primary)]">
                          {iss.title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                          {iss.detail}
                        </p>
                        {iss.affected_step_names.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {iss.affected_step_names.map((n) => (
                              <button
                                key={n}
                                onClick={() => handleJump(n)}
                                className="rounded-md bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Next step */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Recommended next step
            </h4>
            <button
              onClick={runNextStep}
              disabled={loading === 'next'}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {loading === 'next' ? 'Thinking…' : nextStep ? 'Re-run' : 'Suggest'}
            </button>
          </div>
          {!nextStep && loading !== 'next' && (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Get a one-step recommendation based on current progress.
            </p>
          )}
          {nextStep && (
            <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-surface)] p-3">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${PRIORITY_TONE[nextStep.priority]} bg-[var(--color-surface-hover)]`}
                >
                  {nextStep.priority} priority
                </span>
                <button
                  onClick={() => handleJump(nextStep.step_name)}
                  className="text-[10px] font-medium text-[var(--color-accent)] hover:underline"
                >
                  Jump →
                </button>
              </div>
              <p className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">
                {nextStep.step_name}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                {nextStep.reason}
              </p>
            </div>
          )}
        </section>

        <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-[10px] leading-snug text-[var(--color-text-tertiary)]">
          ⓘ These analyses are advisory. Nothing here modifies the plan — you decide what to act on.
        </p>
      </div>
    </aside>
  )
}
