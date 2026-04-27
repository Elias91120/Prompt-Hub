import { useEffect, useState } from 'react'
import type { ProjectEvent, ProjectEventType } from '../types'
import { listProjectEvents } from '../api'
import { ErrorBanner, Skeleton, EmptyState } from './ui'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  projectId: string
  /** When set, increment to force a re-fetch (e.g. after an action) */
  refreshKey?: number
  /** Optional step filter — if set, only events for this step are shown */
  stepId?: string | null
  onClose: () => void
}

interface EventMeta {
  label: string
  icon: string
  tone: string // tailwind text color
  bg: string // tailwind bg color (low alpha)
}

const META: Record<ProjectEventType, EventMeta> = {
  project_created: {
    label: 'Project created',
    icon: '✦',
    tone: 'text-[var(--color-accent)]',
    bg: 'bg-[var(--color-accent)]/10',
  },
  project_updated: {
    label: 'Project edited',
    icon: '✎',
    tone: 'text-sky-400',
    bg: 'bg-sky-500/10',
  },
  plan_generated: {
    label: 'Plan generated',
    icon: '◧',
    tone: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  prompt_generated: {
    label: 'Prompt generated',
    icon: '↗',
    tone: 'text-[var(--color-accent)]',
    bg: 'bg-[var(--color-accent)]/10',
  },
  sub_steps_generated: {
    label: 'Sub-steps generated',
    icon: '↳',
    tone: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
  },
  step_status_changed: {
    label: 'Status changed',
    icon: '◉',
    tone: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  feedback_applied: {
    label: 'Feedback applied',
    icon: '✓',
    tone: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  plan_adapted: {
    label: 'Plan adapted',
    icon: '⟲',
    tone: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  plan_reverted: {
    label: 'Plan reverted',
    icon: '↺',
    tone: 'text-neutral-400',
    bg: 'bg-neutral-500/10',
  },
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.round(day / 7)
  if (wk < 5) return `${wk}w ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(day / 365)}y ago`
}

function payloadString(ev: ProjectEvent, key: string): string | null {
  const p = ev.payload as Record<string, unknown>
  return typeof p[key] === 'string' ? (p[key] as string) : null
}

function payloadNumber(ev: ProjectEvent, key: string): number | null {
  const p = ev.payload as Record<string, unknown>
  return typeof p[key] === 'number' ? (p[key] as number) : null
}

function describeEvent(ev: ProjectEvent): string {
  const safe = (k: string) => payloadString(ev, k)
  const num = (k: string) => payloadNumber(ev, k)

  switch (ev.event_type) {
    case 'project_created':
      return `Created “${safe('name') ?? 'project'}”`
    case 'project_updated':
      return `Edited project “${safe('name') ?? ''}”`
    case 'plan_generated': {
      const phases = num('phase_count')
      const steps = num('step_count')
      return `Generated plan — ${phases ?? '?'} phases, ${steps ?? '?'} steps`
    }
    case 'prompt_generated':
      return `Generated prompt for “${safe('step_name') ?? 'step'}”`
    case 'sub_steps_generated': {
      const n = num('sub_step_count')
      return `Generated ${n ?? '?'} sub-steps under “${safe('parent_step_name') ?? 'step'}”`
    }
    case 'step_status_changed':
      return `“${safe('step_name') ?? 'step'}”: ${safe('previous_status') ?? '?'} → ${safe('new_status') ?? '?'}`
    case 'feedback_applied': {
      const sum = safe('summary')
      return `Feedback on “${safe('step_name') ?? 'step'}”${sum ? ` — ${sum}` : ''}`
    }
    default:
      return ev.event_type
  }
}

export default function TimelinePanel({ projectId, refreshKey = 0, stepId, onClose }: Props) {
  const { t } = useTranslation('plan')
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listProjectEvents(projectId, { stepId: stepId ?? undefined, limit: 200 })
      .then((data) => {
        if (active) setEvents(data)
      })
      .catch((e) => {
        if (active) setError(String(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [projectId, refreshKey, stepId])

  return (
    <aside
      role="complementary"
      aria-label="Journal d'audit"
      className="fixed inset-0 z-40 flex shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] lg:static lg:z-auto lg:w-[420px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="var(--color-accent)" strokeWidth="1.5" />
              <path
                d="M8 5v3l2 1.5"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
              {t('timeline.title')}
            </span>
            {stepId && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {t('timeline.filteredByStep')}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t('drawers.closeTimeline')}
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
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="space-y-3" aria-label="Chargement de l'historique">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        )}

        {error && (
          <ErrorBanner
            error={error}
            title={t('timeline.loadError')}
            onDismiss={() => setError(null)}
          />
        )}

        {!loading && !error && events.length === 0 && (
          <EmptyState
            icon={Clock}
            title={t('timeline.empty.title')}
            description={t('timeline.empty.description')}
          />
        )}

        {!loading && events.length > 0 && (
          <ol className="relative space-y-3 pl-6">
            {/* Vertical line */}
            <span
              aria-hidden
              className="absolute left-[10px] top-1 bottom-1 w-px bg-[var(--color-border)]"
            />
            {events.map((ev) => {
              const meta = META[ev.event_type] ?? {
                label: ev.event_type,
                icon: '•',
                tone: 'text-[var(--color-text-secondary)]',
                bg: 'bg-[var(--color-surface)]',
              }
              return (
                <li key={ev.id} className="relative">
                  {/* Dot */}
                  <span
                    className={`absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-[10px] font-bold ${meta.bg} ${meta.tone}`}
                  >
                    {meta.icon}
                  </span>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                      <span
                        className="text-[10px] tabular-nums text-[var(--color-text-tertiary)]"
                        title={ev.created_at}
                      >
                        {formatRelativeTime(ev.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--color-text-primary)]">
                      {describeEvent(ev)}
                    </p>
                    {renderAgentChain(ev)}
                    {renderSliceScope(ev)}
                    {renderPromptRevision(ev)}
                    {ev.source !== 'manual' && (
                      <span className="mt-1.5 inline-block rounded-md bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-tertiary)]">
                        by {ev.source}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Squad-inspired metadata renderers                                   */
/* ------------------------------------------------------------------ */

function renderAgentChain(ev: ProjectEvent) {
  const raw = (ev.payload as Record<string, unknown>).agent_chain
  if (!Array.isArray(raw) || raw.length === 0) return null
  const chain = raw.filter((s): s is string => typeof s === 'string')
  if (chain.length === 0) return null
  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]"
      title="Agents involved in producing this event (in order)"
    >
      {chain.map((name, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden>→</span>}
          <code className="rounded bg-[var(--color-surface-hover)] px-1 py-px text-[10px] font-medium text-[var(--color-text-secondary)]">
            {name}
          </code>
        </span>
      ))}
    </div>
  )
}

function renderSliceScope(ev: ProjectEvent) {
  const slice = (ev.payload as Record<string, unknown>).slice_scope
  if (!slice || typeof slice !== 'object') return null
  const s = slice as Record<string, unknown>
  const phase = typeof s.phase === 'string' ? s.phase : null
  const parent = typeof s.parent_step === 'string' ? s.parent_step : null
  const siblings = typeof s.sibling_count === 'number' ? s.sibling_count : null
  const prereqs =
    typeof s.completed_prerequisite_count === 'number'
      ? s.completed_prerequisite_count
      : null
  const skills =
    typeof s.applicable_skill_count === 'number' ? s.applicable_skill_count : null

  const chips: string[] = []
  if (phase) chips.push(`phase: ${phase}`)
  if (parent) chips.push(`under: ${parent}`)
  if (siblings !== null) chips.push(`${siblings} sibling${siblings === 1 ? '' : 's'}`)
  if (prereqs !== null) chips.push(`${prereqs} prereq${prereqs === 1 ? '' : 's'}`)
  if (skills !== null) chips.push(`${skills} skill${skills === 1 ? '' : 's'}`)
  if (chips.length === 0) return null

  return (
    <div
      className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-[var(--color-text-tertiary)]"
      title="Context slice the agent received"
    >
      <span className="font-semibold uppercase tracking-wider opacity-70">slice:</span>
      {chips.map((c, i) => (
        <span
          key={i}
          className="rounded bg-[var(--color-surface-hover)] px-1 py-px text-[10px] text-[var(--color-text-secondary)]"
        >
          {c}
        </span>
      ))}
    </div>
  )
}

function renderPromptRevision(ev: ProjectEvent) {
  const rev = payloadString(ev, 'prompt_revision')
  if (!rev) return null
  return (
    <div className="mt-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 px-2 py-1.5 text-[11px] leading-snug text-violet-200">
      <span className="mr-1 font-semibold uppercase tracking-wide">Prompt revision:</span>
      {rev}
    </div>
  )
}
