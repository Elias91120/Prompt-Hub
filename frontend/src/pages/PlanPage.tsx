import { Suspense, useEffect, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { Phase, Project, Step } from '../types'
import { generatePlan, getProject } from '../api'
import PlanGraph from '../components/PlanGraph/PlanGraph'
import { ErrorBanner, Skeleton, Spinner, Breadcrumbs, useToast } from '../components/ui'
import { friendlyMessage } from '../lib/errors'
import { lazyRetry } from '../lib/lazy'

// Side panels and step detail are only opened on demand. Lazy-loading them
// keeps the initial Plan view lighter (chart, sparkline icons, skills CRUD,
// audit log don't ship until the user actually opens the corresponding
// drawer).
const ChatPanel = lazyRetry(() => import('../components/ChatPanel'))
const SkillsPanel = lazyRetry(() => import('../components/SkillsPanel'))
const TimelinePanel = lazyRetry(() => import('../components/TimelinePanel'))
const InsightsPanel = lazyRetry(() => import('../components/InsightsPanel'))
const StepDetail = lazyRetry(() => import('./StepDetail'))

interface Props {
  projectId: string
  /** Step id from the URL (when arriving on /plan/steps/:stepId). */
  selectedStepId?: string | null
  /** Notifies the router so the URL stays in sync with the open drawer. */
  onSelectStep?: (stepId: string | null) => void
  onBack: () => void
}

export default function PlanPage({
  projectId,
  selectedStepId = null,
  onSelectStep,
  onBack,
}: Props) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [selectedStep, setSelectedStepInternal] = useState<Step | null>(null)
  const [generating, setGenerating] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const toast = useToast()
  const { t } = useTranslation('plan')

  /**
   * Wrap setSelectedStep so the URL stays in sync (deep-link friendly).
   * Components inside the page keep using `setSelectedStep` exactly as before.
   */
  const setSelectedStep = (s: Step | null) => {
    onSelectStep?.(s ? s.id : null)
  }
  // "Discuter de ce step": when set, the next chat message is sent with
  // focus_step_id and the input is pre-filled with `chatPendingPrompt`.
  const [focusStepId, setFocusStepId] = useState<string | null>(null)
  const [chatPendingPrompt, setChatPendingPrompt] = useState('')
  // Step names to flash for 3 s after an `adapt_plan` action.
  const [flashStepNames, setFlashStepNames] = useState<string[]>([])

  function triggerFlash(names: string[]) {
    if (!names.length) return
    setFlashStepNames(names)
    window.setTimeout(() => setFlashStepNames([]), 3100)
  }
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getProject(projectId)
      .then((data) => {
        if (active) setProject(data)
      })
      .catch((e) => {
        if (active) setError(e)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [projectId])

  // Resolve a `selectedStepId` from the URL into the actual Step object once
  // the project is loaded. Walks both top-level steps and sub-steps.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!project) return

    // Case: URL has no step id (e.g. /plan) -> clear drawer state
    if (!selectedStepId) {
      if (selectedStep) setSelectedStepInternal(null)
      return
    }

    // Case: URL step id is already reflected in state -> do nothing
    if (selectedStep?.id === selectedStepId) return

    // Case: URL step id needs to be resolved from project data
    for (const ph of project.phases) {
      for (const s of ph.steps) {
        if (s.id === selectedStepId) {
          setSelectedStepInternal(s)
          return
        }
        for (const sub of s.sub_steps) {
          if (sub.id === selectedStepId) {
            setSelectedStepInternal(sub)
            return
          }
        }
      }
    }
    // If the URL step id is unknown for this project (e.g. stale link),
    // we silently leave the drawer closed.
  }, [project, selectedStepId, selectedStep])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Global Escape: close whichever drawer/overlay is currently open.
  // Order matters — StepDetail (modal) wins over side panels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selectedStep) {
        setSelectedStep(null)
        return
      }
      if (chatOpen) return setChatOpen(false)
      if (timelineOpen) return setTimelineOpen(false)
      if (skillsOpen) return setSkillsOpen(false)
      if (insightsOpen) return setInsightsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function handleGeneratePlan(instructions?: string) {
    setGenerating(true)
    setError(null)
    try {
      const updated = await generatePlan(projectId, instructions ?? '')
      setProject(updated)
      setSelectedStep(null)
      setChatOpen(false)
      setTimelineRefreshKey((k) => k + 1)
      toast.success(t('toasts.planGenerated'))
    } catch (e) {
      setError(e)
      toast.error(friendlyMessage(e), {
        action: { label: t('common:actions.retry', { defaultValue: 'Réessayer' }), onClick: () => handleGeneratePlan(instructions) },
      })
    } finally {
      setGenerating(false)
    }
  }

  // Find phase & parent step for breadcrumb in StepDetail.
  // Must be called BEFORE any early return to keep hook order stable.
  const selectedStepCtx: { phase: Phase | null; parent: Step | null } = useMemo(() => {
    if (!selectedStep || !project) return { phase: null, parent: null }
    for (const ph of project.phases) {
      for (const s of ph.steps) {
        if (s.id === selectedStep.id) return { phase: ph, parent: null }
        for (const sub of s.sub_steps) {
          if (sub.id === selectedStep.id) return { phase: ph, parent: s }
        }
      }
    }
    return { phase: null, parent: null }
  }, [selectedStep, project])

  if (loading)
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)] px-6 py-6">
        <div className="flex items-center gap-3 pb-6">
          <Spinner label="Chargement du projet et de son plan…" />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-full w-full rounded-2xl" label="Plan en chargement" />
          <div className="hidden flex-col gap-4 lg:flex">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-60 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  if (error && !project)
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-surface)] px-6">
        <div className="w-full max-w-md">
          <ErrorBanner
            error={error}
            title="Impossible de charger le plan"
            hint="Vérifiez votre connexion ou que le backend tourne."
            onRetry={() => {
              setError(null)
              setLoading(true)
              getProject(projectId)
                .then(setProject)
                .catch(setError)
                .finally(() => setLoading(false))
            }}
          />
          <button onClick={onBack} className="btn-ghost mt-4">
            Retour
          </button>
        </div>
      </div>
    )
  if (!project) return null

  const hasPlan = project.phases.length > 0
  const totalSteps = project.phases.reduce(
    (n, p) => n + p.steps.reduce((m, s) => m + 1 + s.sub_steps.length, 0),
    0,
  )
  const completedSteps = project.phases.reduce(
    (n, p) =>
      n +
      p.steps.reduce(
        (m, s) =>
          m +
          (s.status === 'completed' ? 1 : 0) +
          s.sub_steps.filter((sub) => sub.status === 'completed').length,
        0,
      ),
    0,
  )
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  /* ================================================================ */
  /*  NEW PROJECT — No plan yet                                       */
  /* ================================================================ */
  if (!hasPlan) {
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)]">
        {/* Header */}
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
          <div className="flex items-center gap-4 px-6 py-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t('overview:noPlan.cta', { defaultValue: 'Vue du projet' })}
            </button>
            <div className="h-5 w-px bg-[var(--color-border)]" />
            <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
              {project.name}
            </h1>
          </div>
        </header>

        {/* Error banner */}
        {error ? (
          <div className="px-6 pt-3">
            <ErrorBanner
              error={error}
              onDismiss={() => setError(null)}
            />
          </div>
        ) : null}

        {/* Body — empty state pointing back to the Atelier IA in overview */}
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 ring-1 ring-inset ring-[var(--color-accent)]/20">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                  fill="#3ecf8e"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              {t('overview:noPlan.title', { defaultValue: 'Aucun plan pour ce projet' })}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              <Trans
                i18nKey="overview:noPlan.description"
                components={{ strong: <strong />, em: <em /> }}
              />
            </p>
            <button
              onClick={onBack}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)]"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Aller à l'Atelier IA
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ================================================================ */
  /*  EXISTING PROJECT — Plan view (Graph)                            */
  /* ================================================================ */

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      {/* ── Header ── */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-4">
          {/* Back button */}
          <button
            onClick={onBack}
            aria-label={t('common:actions.back')}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t('header.back')}
          </button>

          <div className="h-5 w-px bg-[var(--color-border)]" />

          {/* Project info */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
              {project.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-[var(--color-text-secondary)]">
              {project.objective}
            </p>
          </div>

          {/* Stats pills */}
          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
              <span className="text-sm font-semibold text-[var(--color-accent)]">
                {project.phases.length}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                phase{project.phases.length !== 1 && 's'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {completedSteps}/{totalSteps}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)]">{t('common:breadcrumbs.plan')}</span>
            </div>
          </div>

          {/* Progress bar */}
          {totalSteps > 0 && (
            <div className="hidden w-28 flex-col gap-1 sm:flex">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                  {t('overview:stats.progress', { defaultValue: 'Progression' })}
                </span>
                <span className="text-xs font-semibold text-[var(--color-accent)]">
                  {progressPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-surface-hover)]">
                <div
                  className="h-2 rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Chat toggle */}
          <button
            onClick={() => {
              setChatOpen((v) => !v)
              if (!chatOpen) {
                setTimelineOpen(false)
                setSkillsOpen(false)
                setInsightsOpen(false)
              }
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              chatOpen
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 3C2 2.44772 2.44772 2 3 2H13C13.5523 2 14 2.44772 14 3V10C14 10.5523 13.5523 11 13 11H5L2 14V3Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden md:inline">{t('panels.assistant')}</span>
          </button>

          {/* Timeline toggle */}
          <button
            onClick={() => {
              setTimelineOpen((v) => !v)
              if (!timelineOpen) {
                setChatOpen(false)
                setSkillsOpen(false)
                setInsightsOpen(false)
                setTimelineRefreshKey((k) => k + 1)
              }
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              timelineOpen
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
            }`}
            title={t('panels.timelineTitle')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 5v3l2 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden md:inline">{t('panels.timeline')}</span>
          </button>

          {/* Skills toggle */}
          <button
            onClick={() => {
              setSkillsOpen((v) => !v)
              if (!skillsOpen) {
                setChatOpen(false)
                setTimelineOpen(false)
                setInsightsOpen(false)
              }
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              skillsOpen
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
            }`}
            title={t('panels.skillsTitle')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8l3 3 7-7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden md:inline">{t('panels.skills')}</span>
          </button>

          {/* Insights toggle (read-only analysis agents) */}
          <button
            onClick={() => {
              setInsightsOpen((v) => !v)
              if (!insightsOpen) {
                setChatOpen(false)
                setTimelineOpen(false)
                setSkillsOpen(false)
              }
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              insightsOpen
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
            }`}
            title={t('panels.insightsTitle')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5a5.5 5.5 0 0 0-3.3 9.9V13a1 1 0 0 0 1 1h4.6a1 1 0 0 0 1-1v-1.6A5.5 5.5 0 0 0 8 1.5zM6 14.5h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden md:inline">{t('panels.insights')}</span>
          </button>

          {/* Suggest next step */}
          <button
            onClick={() => {
              // Heuristic: first in_progress step, else first not_started step
              const flat: Step[] = []
              for (const ph of project.phases) {
                for (const s of ph.steps) {
                  flat.push(s)
                  for (const sub of s.sub_steps) flat.push(sub)
                }
              }
              const next =
                flat.find((s) => s.status === 'in_progress') ??
                flat.find((s) => s.status === 'not_started')
              if (next) setSelectedStep(next)
            }}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
            title={t('header.nextTitle')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10m0 0L9 4m4 4l-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">{t('header.next')}</span>
          </button>

          {/* Regenerate */}
          <button
            onClick={() => handleGeneratePlan()}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-md disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Génération…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                    fill="currentColor"
                    opacity="0.9"
                  />
                </svg>
                <span className="hidden sm:inline">{t('header.regenerate')}</span>
              </>
            )}
          </button>
        </div>
        <div className="border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/40">
          <div className="flex h-9 items-center px-6">
            <Breadcrumbs
              items={[
                { label: t('common:breadcrumbs.projects'), to: '/' },
                { label: project.name, to: `/projects/${project.id}` },
                { label: t('common:breadcrumbs.plan') },
                ...(selectedStep ? [{ label: selectedStep.name }] : []),
              ]}
            />
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error ? (
        <div className="px-6 pt-3">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      {/* ── Body ── */}
      <Suspense fallback={null}>
      <div className="relative flex min-h-0 flex-1">
        {/* Plan graph */}
        <div className="relative flex-1">
          <PlanGraph
            project={project}
            selectedStepId={selectedStep?.id ?? null}
            onSelectStep={(s) => setSelectedStep(s)}
            flashStepNames={flashStepNames}
          />
          {/* Floating helper hint */}
          {!selectedStep && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)]/80 px-4 py-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)] backdrop-blur-md">
              {t('graph.hint')}
            </div>
          )}
        </div>

        {/* Detail drawer (floats over the graph via fixed positioning) */}
        {selectedStep && (
          <StepDetail
            projectId={project.id}
            step={selectedStep}
            phaseName={selectedStepCtx.phase?.name}
            parentStepName={selectedStepCtx.parent?.name ?? null}
            onJumpToStep={(s) => setSelectedStep(s)}
            onClose={() => setSelectedStep(null)}
            onDiscussInChat={(s) => {
              setFocusStepId(s.id)
              setChatPendingPrompt(
                `Je suis bloqué sur « ${s.name} ». Voici ce qui me coince : `,
              )
              setSelectedStep(null)
              setChatOpen(true)
            }}
            onProjectUpdated={(updated) => {
              setProject(updated)
              setTimelineRefreshKey((k) => k + 1)
              const findStep = (steps: Step[]): Step | null => {
                for (const s of steps) {
                  if (s.id === selectedStep.id) return s
                  const inner = findStep(s.sub_steps)
                  if (inner) return inner
                }
                return null
              }
              for (const ph of updated.phases) {
                const found = findStep(ph.steps)
                if (found) {
                  setSelectedStep(found)
                  break
                }
              }
            }}
          />
        )}

        {/* ── Chat drawer (side panel) ── */}
        {chatOpen && !selectedStep && (
          <aside
            role="complementary"
            aria-label="Assistant du projet"
            className="fixed inset-0 z-40 flex shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] lg:static lg:z-auto lg:w-[420px]"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                      fill="#22c55e"
                    />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t('chat.title')}
                </span>
                {focusStepId && (
                  <button
                    onClick={() => setFocusStepId(null)}
                    title={t('chat.focusTitle')}
                    className="ml-2 inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
                  >
                    Focus step ×
                  </button>
                )}
              </div>
              <button
                onClick={() => setChatOpen(false)}
                aria-label={t('drawers.closeAssistant')}
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
            {/* Chat body */}
            <ChatPanel
              projectId={projectId}
              onReadyToPlan={(c) => handleGeneratePlan(c)}
              compact
              generating={generating}
              onProjectUpdated={(p) => setProject(p)}
              focusStepId={focusStepId}
              pendingPrompt={chatPendingPrompt}
              onPendingPromptConsumed={() => setChatPendingPrompt('')}
              onPlanAdapted={({ stepNames }) => triggerFlash(stepNames)}
            />
          </aside>
        )}

        {/* ── Timeline drawer ── */}
        {timelineOpen && !selectedStep && (
          <TimelinePanel
            projectId={projectId}
            refreshKey={timelineRefreshKey}
            onClose={() => setTimelineOpen(false)}
          />
        )}

        {/* ── Skills drawer ── */}
        {skillsOpen && !selectedStep && (
          <SkillsPanel projectId={projectId} onClose={() => setSkillsOpen(false)} />
        )}

        {/* ── Insights drawer (Axe D — non-executive analysis) ── */}
        {insightsOpen && !selectedStep && project && (
          <InsightsPanel
            project={project}
            onClose={() => setInsightsOpen(false)}
            onJumpToStep={(s) => setSelectedStep(s)}
          />
        )}
      </div>
      </Suspense>
    </div>
  )
}
