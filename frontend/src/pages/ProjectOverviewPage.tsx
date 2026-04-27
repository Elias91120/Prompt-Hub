import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { Project, ProjectRecap, StepStatus } from '../types'
import { getProject, getProjectRecap } from '../api'
import AppShell from '../components/layout/AppShell'
import AIWorkspace from '../components/AIWorkspace'
import { ErrorBanner, Skeleton } from '../components/ui'

import ProjectSettingsModal from '../components/ProjectSettingsModal'

interface Props {
  projectId: string
  /** Initial project data (may be slightly stale). Page refetches in background.
   *  When omitted (e.g. arrival via deep link), the page fetches first and shows
   *  a skeleton until the response is in. */
  initialProject?: Project
  onBack: () => void
  onOpenPlan: (project: Project) => void
}

/* ------------------------------------------------------------------ */
/* Helpers — all pure, derived strictly from the project data         */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return formatDate(iso)
}

interface Stats {
  phaseCount: number
  topSteps: number
  subSteps: number
  completed: number
  inProgress: number
  notStarted: number
  pct: number
}

function computeStats(project: Project): Stats {
  const phaseCount = project.phases.length
  let topSteps = 0
  let subSteps = 0
  let completed = 0
  let inProgress = 0
  let notStarted = 0
  for (const ph of project.phases) {
    for (const s of ph.steps) {
      topSteps += 1
      if (s.status === 'completed') completed += 1
      else if (s.status === 'in_progress') inProgress += 1
      else if (s.status === 'not_started') notStarted += 1
      for (const sub of s.sub_steps) {
        subSteps += 1
        if (sub.status === 'completed') completed += 1
        else if (sub.status === 'in_progress') inProgress += 1
        else if (sub.status === 'not_started') notStarted += 1
      }
    }
  }
  const total = topSteps + subSteps
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { phaseCount, topSteps, subSteps, completed, inProgress, notStarted, pct }
}

const STATUS_DOT: Record<StepStatus, string> = {
  not_started: 'bg-neutral-600',
  in_progress: 'bg-[var(--color-accent)]',
  completed: 'bg-emerald-500',
  replanned: 'bg-amber-500',
}

const STATUS_LABEL: Record<StepStatus, string> = {
  not_started: 'Todo',
  in_progress: 'In progress',
  completed: 'Done',
  replanned: 'Replanned',
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ProjectOverviewPage({
  projectId,
  initialProject,
  onBack,
  onOpenPlan,
}: Props) {
  const { t } = useTranslation('common')
  const [project, setProject] = useState<Project | null>(initialProject ?? null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [recap, setRecap] = useState<ProjectRecap | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapError, setRecapError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Refresh project data in the background so stats are accurate.
  useEffect(() => {
    let active = true
    getProject(projectId)
      .then((p) => {
        if (active) {
          setProject(p)
          setLoadError(null)
        }
      })
      .catch((err) => {
        if (active && !initialProject) setLoadError(err)
      })
    return () => {
      active = false
    }
  }, [projectId, initialProject])

  const stats = useMemo(() => (project ? computeStats(project) : null), [project])
  const hasPlan = stats ? stats.phaseCount > 0 : false
  const workspaceRef = useRef<HTMLDivElement>(null)

  function scrollToWorkspace() {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleGenerateRecap() {
    setRecapLoading(true)
    setRecapError(null)
    try {
      setRecap(await getProjectRecap(projectId))
    } catch (e) {
      setRecapError(String(e))
    } finally {
      setRecapLoading(false)
    }
  }

  if (!project || !stats) {
    return (
      <AppShell onBack={onBack} backLabel="Mes projets">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          {loadError ? (
            <ErrorBanner
              error={loadError}
              title="Impossible de charger le projet"
              onRetry={() => {
                setLoadError(null)
                getProject(projectId)
                  .then(setProject)
                  .catch((e) => setLoadError(e))
              }}
            />
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
              <Skeleton className="h-48 w-full" />
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      onBack={onBack}
      backLabel={t('breadcrumbs.projects')}
      breadcrumbs={[
        { label: t('breadcrumbs.projects'), to: '/' },
        { label: project.name },
      ]}
      leftSlot={
        <div className="flex items-center gap-3">
          <span className="kpi-icon h-7 w-7">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {project.name}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Project overview
            </span>
          </div>
        </div>
      }
      rightSlot={
        hasPlan ? (
          <button
            onClick={() => onOpenPlan(project)}
            className="btn-primary"
            aria-label="Ouvrir la vue plan"
          >
            Ouvrir le plan
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button onClick={scrollToWorkspace} className="btn-primary">
            Générer le plan
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        )
      }
    >
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        {/* ── Hero card: identity ── */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                {project.name}
              </h1>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {project.objective || (
                  <em className="text-[var(--color-text-tertiary)]">No objective set.</em>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-medium text-[var(--color-text-tertiary)]">
                Created {formatDate(project.created_at)}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
                Updated {formatRelative(project.updated_at)}
              </div>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Phases" value={stats.phaseCount} />
            <Stat label="Top steps" value={stats.topSteps} />
            <Stat label="Sub-steps" value={stats.subSteps} />
            <Stat label="Progress" value={`${stats.pct}%`} accent />
          </div>

          {/* Progress bar */}
          {hasPlan && (
            <div className="mt-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${stats.pct}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-tertiary)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {stats.completed} done
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                  {stats.inProgress} in progress
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                  {stats.notStarted} todo
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── Atelier IA — Chat + Quick prompt (always available) ── */}
        <div ref={workspaceRef} id="workspace" className="mt-6 scroll-mt-24">
          <AIWorkspace
            projectId={projectId}
            project={project}
            hasPlan={hasPlan}
            onProjectUpdated={(p) => setProject(p)}
            onOpenPlan={() => onOpenPlan(project)}
          />
        </div>

        {/* ── AI recap ── */}
        <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                AI recap
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
                Factual summary based on plan + step statuses · advisory · never modifies anything
              </p>
            </div>
            <button
              onClick={handleGenerateRecap}
              disabled={recapLoading || !hasPlan}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {recapLoading ? 'Generating…' : recap ? 'Re-generate' : 'Generate recap'}
            </button>
          </div>

          {!hasPlan && (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
              No plan yet — open the plan view to generate one first.
            </p>
          )}
          {recapError && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              {recapError}
            </div>
          )}
          {recap && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-surface)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                  Where we are · {recap.momentum}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-primary)]">
                  {recap.where_we_are}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <RecapList
                  title="What was done"
                  tone="emerald"
                  items={recap.what_was_done}
                  empty="Nothing completed yet."
                />
                <RecapList
                  title="What remains"
                  tone="sky"
                  items={recap.what_remains}
                  empty="Nothing left — plan is complete."
                />
              </div>
            </div>
          )}
        </section>

        {/* ── Project facts ── */}
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Project Settings & Facts
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
                Règles du projet, palette de couleurs, stack technique et contraintes globales.
              </p>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] shadow-sm transition-all hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.5 2.5a2.121 2.121 0 0 1 0 3L6 13l-4 1 1-4 7.5-7.5a2.121 2.121 0 0 1 3 0z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Modifier les paramètres
            </button>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <FactCard title="Constraints" content={project.constraints} />
            <FactCard title="Stack" content={project.stack} />
            <FactCard
              title="Règles / Palette / Décisions techniques"
              content={project.decisions_log}
              className="lg:col-span-2"
            />
          </div>
        </section>

        {/* ── Phase / step breakdown ── */}
        {hasPlan && (
          <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Plan breakdown
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
              Read-only outline of every phase and step.
            </p>
            <div className="mt-4 space-y-5">
              {[...project.phases]
                .sort((a, b) => a.order - b.order)
                .map((ph) => {
                  const topSteps = ph.steps
                    .filter((s) => s.parent_step_id === null)
                    .sort((a, b) => a.order - b.order)
                  return (
                    <div key={ph.id}>
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-1.5">
                        <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                          Phase {ph.order + 1} · {ph.name}
                        </h3>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          {topSteps.length} step{topSteps.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {topSteps.map((s) => (
                          <li key={s.id} className="rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-hover)]">
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`}
                                title={STATUS_LABEL[s.status]}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">
                                    {s.name}
                                  </span>
                                  <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                    {s.step_type}
                                  </span>
                                </div>
                                {s.objective && (
                                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                                    {s.objective}
                                  </p>
                                )}
                                {s.sub_steps.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5 border-l border-[var(--color-border)] pl-3">
                                    {[...s.sub_steps]
                                      .sort((a, b) => a.order - b.order)
                                      .map((sub) => (
                                        <li
                                          key={sub.id}
                                          className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]"
                                        >
                                          <span
                                            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[sub.status]}`}
                                          />
                                          <span className="truncate">{sub.name}</span>
                                        </li>
                                      ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={() => onOpenPlan(project)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)]"
          >
            Open plan view
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      
      {project && (
        <ProjectSettingsModal
          project={project}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onProjectUpdated={(p) => setProject(p)}
        />
      )}
    </AppShell>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xl font-bold tabular-nums ${
          accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function FactCard({
  title,
  content,
  className,
}: {
  title: string
  content: string | null | undefined
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 ${
        className ?? ''
      }`}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      {content && content.trim() ? (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {content}
        </p>
      ) : (
        <p className="mt-2 text-[12px] italic text-[var(--color-text-tertiary)]">
          Not specified.
        </p>
      )}
    </div>
  )
}

function RecapList({
  title,
  items,
  tone,
  empty,
}: {
  title: string
  items: string[]
  tone: 'emerald' | 'sky'
  empty: string
}) {
  const dot = tone === 'emerald' ? 'bg-emerald-500' : 'bg-sky-400'
  const ring = tone === 'emerald' ? 'border-emerald-500/20' : 'border-sky-500/20'
  return (
    <div className={`rounded-xl border ${ring} bg-[var(--color-surface)] p-4`}>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] italic text-[var(--color-text-tertiary)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-[var(--color-text-secondary)]">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
